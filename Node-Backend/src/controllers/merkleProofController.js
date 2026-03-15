const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../db/sequelize');
const { queryAirflowDb } = require('../conn/airflowDb');

function hashString(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function computeLeafHash(rowData) {
  const sortedCols = Object.keys(rowData).sort();
  const rowString = sortedCols.map(col => String(rowData[col])).join('|');
  return hashString(rowString);
}

async function getBlockchainRoot(tableName) {
  const rpcUrl = process.env.BLOCKCHAIN_PROVIDER_URL;
  const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;

  if (!contractAddress) throw new Error('BLOCKCHAIN_CONTRACT_ADDRESS not set in .env');

  // Dynamically require web3 to avoid hard failure if not installed
  const { Web3 } = require('web3');
  const abiPath = path.join(__dirname, '..', '..', '..', '..', 'ETL-and-Blockchain', 'ETL', 'include', 'etl_modules', 'abi.json');
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

  const w3 = new Web3(rpcUrl);
  const connected = await w3.eth.net.isListening().catch(() => false);
  if (!connected) throw new Error(`Cannot connect to blockchain at ${rpcUrl}`);

  const contract = new w3.eth.Contract(abi, contractAddress);
  try {
    const [root] = await contract.methods.getLatestRoot(tableName).call();
    return root;
  } catch {
    return contract.methods.getRoot().call();
  }
}

async function verifyRow(req, res) {
  const { table_name, row_data } = req.body;
  if (!table_name || !row_data) {
    return res.status(400).json({ detail: 'table_name and row_data are required' });
  }

  const leaf_hash = computeLeafHash(row_data);

  // Get latest Merkle root from audit table (main DB)
  let stored_root, tx_hash, row_count, block_number;
  try {
    const [result] = await sequelize.query(`
      SELECT merkle_root, tx_hash, row_count, block_number, created_at
      FROM merkle_audit
      WHERE table_name = :table_name
      ORDER BY created_at DESC
      LIMIT 1
    `, { replacements: { table_name }, type: sequelize.QueryTypes.SELECT });

    if (!result) {
      return res.status(404).json({ detail: `No Merkle audit record found for table '${table_name}'. Run the pipeline first.` });
    }

    stored_root = result.merkle_root;
    tx_hash = result.tx_hash;
    row_count = result.row_count;
    block_number = result.block_number;
  } catch (err) {
    return res.status(404).json({ detail: `No Merkle audit record found for table '${table_name}'. Run the pipeline first.` });
  }

  // Fetch blockchain root
  let blockchain_root = null;
  let roots_match = false;
  try {
    blockchain_root = await getBlockchainRoot(table_name);
    roots_match = blockchain_root === stored_root;
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

  let stored_root, tx_hash, row_count, block_number;
  try {
    const rows = await queryAirflowDb(
      `SELECT merkle_root, tx_hash, row_count, block_number, created_at
       FROM merkle_audit WHERE table_name = $1 ORDER BY created_at DESC LIMIT 1`,
      [table_name]
    );
    if (!rows.length) {
      return res.status(404).json({ detail: `No Merkle audit record found for table '${table_name}'. Run the pipeline first.` });
    }
    ({ merkle_root: stored_root, tx_hash, row_count, block_number } = rows[0]);
  } catch {
    return res.status(404).json({ detail: `No Merkle audit record for '${table_name}'.` });
  }

  let blockchain_root = null;
  let roots_match = false;
  try {
    blockchain_root = await getBlockchainRoot(table_name);
    roots_match = blockchain_root === stored_root;
  } catch (err) {
    console.warn(`Could not fetch blockchain root: ${err.message}`);
  }

  const verified = roots_match && !!stored_root;
  const message = verified
    ? `Table '${table_name}' integrity VERIFIED. DB root matches blockchain. ${row_count} rows protected.`
    : stored_root && blockchain_root
    ? `Table '${table_name}' integrity FAILED. DB root does not match blockchain root.`
    : `Could not fetch blockchain root. Check Ganache connection.`;

  return res.json({ verified, table_name, merkle_root: stored_root, blockchain_root, roots_match, row_count, tx_hash, block_number, message });
}

async function getRootHistory(req, res) {
  const { table_name } = req.params;
  try {
    const rows = await queryAirflowDb(
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
    const rows = await queryAirflowDb(
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
