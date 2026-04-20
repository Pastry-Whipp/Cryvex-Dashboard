const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { queryTargetDb } = require('../conn/targetDb');

function hashString(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Canonical string representation of a single value — mirrors Python's _canon()
 * in merkle_tree.py so Node.js and Python always produce identical leaf hashes.
 *
 * Rules (matching Python):
 *   null / undefined        → 'None'
 *   boolean                 → 'True' / 'False'  (Python str(True) = 'True')
 *   NaN                     → 'None'
 *   Date object (midnight UTC) → 'YYYY-MM-DD'
 *   Date object (with time) → 'YYYY-MM-DD HH:MM:SS'
 *   ISO string timestamp    → normalised to date or datetime
 *   everything else         → String(v)
 */
function canonValue(v) {
  if (v === null || v === undefined) return 'None';

  // Booleans: Python str(True)='True', str(False)='False'
  if (typeof v === 'boolean') return v ? 'True' : 'False';

  // NaN
  if (typeof v === 'number' && isNaN(v)) return 'None';

  // JavaScript Date objects returned by pg for TIMESTAMP columns
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return 'None';
    const y  = v.getUTCFullYear();
    const mo = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d  = String(v.getUTCDate()).padStart(2, '0');
    const H  = v.getUTCHours();
    const Mi = v.getUTCMinutes();
    const S  = v.getUTCSeconds();
    if (H === 0 && Mi === 0 && S === 0) return `${y}-${mo}-${d}`;
    return `${y}-${mo}-${d} ${String(H).padStart(2,'0')}:${String(Mi).padStart(2,'0')}:${String(S).padStart(2,'0')}`;
  }

  // ISO timestamp strings that pg sometimes returns (e.g. '2023-01-15T00:00:00.000Z')
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      const [, date, h, mi, s] = m;
      if (h === '00' && mi === '00' && s === '00') return date;
      return `${date} ${h}:${mi}:${s}`;
    }
  }

  return String(v);
}

/**
 * Compute a Merkle root from an array of row objects.
 * Mirrors MerkleTree.build_tree() in Python's merkle_tree.py exactly:
 *   1. Hash each row (sorted columns, values joined with '|' via canonValue)
 *   2. Sort all leaf hashes (deterministic regardless of DB row order)
 *   3. Build tree bottom-up, combining pairs; duplicate last hash when odd
 */
function computeMerkleRoot(rows) {
  if (!rows || rows.length === 0) throw new Error('Cannot build Merkle tree from empty dataset');

  // Step 1 — leaf hashes
  const leaves = rows.map(row => {
    const sortedCols = Object.keys(row).sort();
    const rowString = sortedCols.map(col => canonValue(row[col])).join('|');
    return hashString(rowString);
  });

  // Step 2 — sort (Python: self.leaves.sort())
  leaves.sort();

  // Step 3 — build tree bottom-up
  let level = [...leaves];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left  = level[i];
      const right = (i + 1 < level.length) ? level[i + 1] : left;
      next.push(hashString(left + right));
    }
    level = next;
  }

  return level[0];
}

function computeLeafHash(rowData) {
  const sortedCols = Object.keys(rowData).sort();
  const rowString = sortedCols.map(col => canonValue(rowData[col])).join('|');
  return hashString(rowString);
}

async function getBlockchainRoot(tableName) {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.BLOCKCHAIN_PROVIDER_URL || 'http://ganache:8545';

  // Contract address: env var → shared blockchain_config.json (written by truffle_deployer)
  let contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS || null;
  if (!contractAddress) {
    try {
      const bcConfigPath = path.join(__dirname, '..', '..', 'pipeline_configs', 'blockchain_config.json');
      const bcConfig = JSON.parse(fs.readFileSync(bcConfigPath, 'utf8'));
      contractAddress = bcConfig.contract_address;
    } catch { /* ignore — will throw below */ }
  }
  if (!contractAddress) throw new Error('BLOCKCHAIN_CONTRACT_ADDRESS not set and blockchain_config.json not found');

  // Dynamically require web3 to avoid hard failure if not installed
  const { Web3 } = require('web3');

  // Try multiple ABI paths:
  //   1. /app/pipeline_configs/abi.json       (shared volume, copied by truffle_deployer)
  //   2. Relative path from source tree       (dev / host-only scenario)
  const abiCandidates = [
    path.join(__dirname, '..', '..', 'pipeline_configs', 'abi.json'),
    path.join(__dirname, '..', '..', '..', '..', 'ETL-and-Blockchain', 'ETL', 'include', 'etl_modules', 'abi.json')
  ];
  let abi = null;
  for (const candidate of abiCandidates) {
    if (fs.existsSync(candidate)) {
      abi = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      break;
    }
  }
  if (!abi) throw new Error(`ABI file not found. Searched: ${abiCandidates.join(', ')}`);

  const w3 = new Web3(rpcUrl);
  const connected = await w3.eth.net.isListening().catch(() => false);
  if (!connected) throw new Error(`Cannot connect to blockchain at ${rpcUrl}. Make sure Ganache is running.`);

  // Check if contract bytecode exists at the address — if Ganache was restarted
  // without a persistent volume, the chain is wiped and the contract is gone
  // even though blockchain_config.json still has the old address.
  const bytecode = await w3.eth.getCode(contractAddress).catch(() => '0x');
  if (!bytecode || bytecode === '0x' || bytecode === '0x0') {
    throw new Error(
      `Smart contract not found at ${contractAddress}. ` +
      `Ganache was likely restarted and the chain was wiped. ` +
      `Run: docker compose restart truffle_deployer`
    );
  }

  const contract = new w3.eth.Contract(abi, contractAddress);

  // Check root count BEFORE calling getLatestRoot — the contract does
  // require(entries.length > 0) which causes a Solidity revert (and an
  // unreadable Web3 error) if no root has been stored yet for this table.
  // getRootCount() is a pure view function that never reverts.
  const rootCount = await contract.methods.getRootCount(tableName).call().catch(() => 0n);
  if (!rootCount || rootCount === 0n || rootCount.toString() === '0') {
    throw new Error(
      `No Merkle roots stored on blockchain for table '${tableName}'. ` +
      `Re-run the ETL pipeline to push roots to the new contract.`
    );
  }

  // web3.js v4 returns multi-output calls as an OBJECT (with named and numeric keys)
  const result = await contract.methods.getLatestRoot(tableName).call();
  const root = result?.root ?? result?.[0];
  if (!root) {
    throw new Error(`No Merkle root found on blockchain for table '${tableName}'.`);
  }
  return root;
}

async function verifyRow(req, res) {
  const { table_name, row_data } = req.body;
  if (!table_name || !row_data) {
    return res.status(400).json({ detail: 'table_name and row_data are required' });
  }

  const leaf_hash = computeLeafHash(row_data);

  // Get latest Merkle root from audit table (ETL target DB)
  let stored_root, tx_hash, row_count, block_number;
  try {
    const { rows } = await queryTargetDb(
      `SELECT merkle_root, tx_hash, row_count, block_number, created_at
       FROM merkle_audit WHERE table_name = $1 ORDER BY created_at DESC LIMIT 1`,
      [table_name]
    );
    if (!rows.length) {
      return res.status(404).json({ detail: `No Merkle audit record found for table '${table_name}'. Run the pipeline first.` });
    }
    ({ merkle_root: stored_root, tx_hash, row_count, block_number } = rows[0]);
  } catch (err) {
    console.error('verifyRow DB error:', err.message);
    return res.status(404).json({ detail: `No Merkle audit record found for table '${table_name}'. Run the pipeline first.` });
  }

  // Fetch blockchain root
  let blockchain_root = null;
  let roots_match = false;
  try {
    blockchain_root = await getBlockchainRoot(table_name);
    // Normalize: strip 0x prefix for comparison
    const normalizedBlockchain = blockchain_root?.startsWith('0x')
      ? blockchain_root.slice(2).toLowerCase()
      : blockchain_root?.toLowerCase();
    roots_match = normalizedBlockchain === stored_root?.toLowerCase();
  } catch (err) {
    console.warn(`Could not fetch blockchain root: ${err.message}`);
  }

  const verified = roots_match && !!stored_root;
  const message = verified
    ? `✅ Row verification PASSED. Leaf hash computed successfully. Merkle root matches blockchain. Table '${table_name}' processed ${row_count} rows.`
    : `❌ Row verification FAILED. ${!roots_match ? 'Blockchain root does not match stored root.' : 'No blockchain root found.'}`;

  return res.json({ verified, table_name, leaf_hash, merkle_root: stored_root, blockchain_root, roots_match, row_count, message });
}

async function verifyTable(req, res) {
  const { table_name } = req.params;

  // ── Step 1: get the last audit record (for display / tx_hash reference) ──
  let stored_root, tx_hash, block_number;
  try {
    const { rows } = await queryTargetDb(
      `SELECT merkle_root, tx_hash, row_count, block_number, created_at
       FROM merkle_audit WHERE table_name = $1 ORDER BY created_at DESC LIMIT 1`,
      [table_name]
    );
    if (!rows.length) {
      return res.status(404).json({
        detail: `No Merkle audit record found for table '${table_name}'. Run the pipeline first.`
      });
    }
    ({ merkle_root: stored_root, tx_hash, block_number } = rows[0]);
  } catch {
    return res.status(404).json({ detail: `No Merkle audit record for '${table_name}'.` });
  }

  // ── Step 2: recompute Merkle root from the CURRENT live database state ──
  //    This is what actually detects tampering — comparing a freshly-computed
  //    root against the immutable blockchain root, not the stored audit value.
  let computed_root = null;
  let actual_row_count = 0;
  let db_error = null;
  try {
    const { rows: tableRows } = await queryTargetDb(
      `SELECT * FROM "${table_name}"`
    );
    actual_row_count = tableRows.length;
    if (tableRows.length === 0) {
      db_error = `Table '${table_name}' is empty — nothing to verify.`;
    } else {
      computed_root = computeMerkleRoot(tableRows);
    }
  } catch (err) {
    db_error = `Failed to read table '${table_name}': ${err.message}`;
    console.error(`verifyTable DB error for '${table_name}':`, err.message);
  }

  // ── Step 3: get the blockchain root ──
  let blockchain_root = null;
  let blockchain_error = null;
  try {
    blockchain_root = await getBlockchainRoot(table_name);
  } catch (err) {
    blockchain_error = err.message;
    console.warn(`Could not fetch blockchain root for '${table_name}': ${err.message}`);
  }

  // ── Step 4: compare COMPUTED (live DB) root against BLOCKCHAIN root ──
  let roots_match = false;
  if (computed_root && blockchain_root) {
    const normalizedBlockchain = blockchain_root.startsWith('0x')
      ? blockchain_root.slice(2).toLowerCase()
      : blockchain_root.toLowerCase();
    roots_match = normalizedBlockchain === computed_root.toLowerCase();
  }

  const verified = roots_match && !!computed_root && !!blockchain_root;

  const message = verified
    ? `Table '${table_name}' integrity VERIFIED. DB root matches blockchain. ${actual_row_count} rows protected.`
    : db_error
    ? `Database error: ${db_error}`
    : blockchain_error
    ? `Blockchain connection failed: ${blockchain_error}`
    : computed_root && blockchain_root
    ? `Table '${table_name}' integrity FAILED. Current data does not match blockchain record — possible tampering detected.`
    : `Could not complete verification.`;

  return res.json({
    verified,
    table_name,
    merkle_root: computed_root,     // freshly computed from live DB state
    stored_root,                     // what was recorded at ETL time (for reference)
    blockchain_root,
    roots_match,
    row_count: actual_row_count,
    tx_hash,
    block_number,
    message,
    blockchain_error: blockchain_error || undefined,
    db_error: db_error || undefined
  });
}

async function getRootHistory(req, res) {
  const { table_name } = req.params;
  try {
    const { rows } = await queryTargetDb(
      `SELECT merkle_root, tx_hash, row_count, block_number, created_at
       FROM merkle_audit WHERE table_name = $1 ORDER BY created_at ASC`,
      [table_name]
    );
    return res.json({
      table_name,
      total_runs: rows.length,
      history: rows.map((r, i) => ({
        run: i + 1,
        merkle_root: r.merkle_root,
        tx_hash: r.tx_hash,
        row_count: r.row_count,
        block_number: r.block_number,
        timestamp: r.created_at ? r.created_at.toISOString() : null
      }))
    });
  } catch {
    return res.json({ table_name, total_runs: 0, history: [] });
  }
}

async function getVerifiedTables(req, res) {
  try {
    const { rows } = await queryTargetDb(
      `SELECT table_name, COUNT(*) as run_count, MAX(created_at) as last_run, MAX(row_count) as latest_row_count
       FROM merkle_audit GROUP BY table_name ORDER BY last_run DESC`
    );
    return res.json({
      tables: rows.map(r => ({
        table_name: r.table_name,
        run_count: parseInt(r.run_count),
        last_run: r.last_run ? r.last_run.toISOString() : null,
        latest_row_count: r.latest_row_count
      }))
    });
  } catch {
    return res.json({ tables: [] });
  }
}

module.exports = { verifyRow, verifyTable, getRootHistory, getVerifiedTables };
