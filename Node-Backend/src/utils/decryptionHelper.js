/**
 * decryptionHelper.js
 *
 * Mirrors the Python EncryptionHandler's AES-256 (Fernet) logic so the
 * Node backend can decrypt columns that the ETL pipeline encrypted before
 * storing them in the database.
 *
 * Fernet token layout (after base64url decode):
 *   Version    1 byte  (0x80)
 *   Timestamp  8 bytes (big-endian uint64, seconds since epoch)
 *   IV        16 bytes (random)
 *   Ciphertext variable (AES-128-CBC, PKCS7 padded)
 *   HMAC      32 bytes (HMAC-SHA256 of everything above)
 *
 * The 32-byte key is split:
 *   bytes  0-15  → signing key  (HMAC-SHA256)
 *   bytes 16-31  → cipher key   (AES-128-CBC)
 *
 * Key derivation matches Python encryption_handler.py exactly:
 *   PBKDF2-HMAC-SHA256, salt='cryvex_salt_2025', iterations=100 000, length=32
 *   (skipped when master_key is already exactly 32 bytes)
 */

const crypto = require('crypto');
const yaml   = require('js-yaml');

// ─── Key derivation ───────────────────────────────────────────────────────────

const PBKDF2_SALT       = Buffer.from('cryvex_salt_2025', 'utf-8');
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN     = 32;
const PBKDF2_DIGEST     = 'sha256';

/** Derive (or pass-through) the 32-byte Fernet key from a master key string. */
function deriveFernetKey(masterKey) {
    const keyBytes = Buffer.from(masterKey, 'utf-8');
    if (keyBytes.length === 32) return keyBytes;
    return crypto.pbkdf2Sync(
        keyBytes, PBKDF2_SALT, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST
    );
}

// ─── Fernet decryption ────────────────────────────────────────────────────────

/**
 * Decrypt a single Fernet token (string) using a 32-byte derived key.
 * Returns the original plaintext string, or throws on invalid token / wrong key.
 */
function fernetDecrypt(fernetKey32, token) {
    // Fernet uses standard base64 with url-safe alphabet and '=' padding
    const tokenBytes = Buffer.from(token, 'base64');

    // Minimum length: 1 + 8 + 16 + 16 (one AES block) + 32 = 73
    if (tokenBytes.length < 73) {
        throw new Error('Token too short to be a valid Fernet token');
    }
    if (tokenBytes[0] !== 0x80) {
        throw new Error(`Unexpected Fernet version: 0x${tokenBytes[0].toString(16)}`);
    }

    const signingKey    = fernetKey32.slice(0, 16);
    const encryptionKey = fernetKey32.slice(16, 32);

    // Verify HMAC before decrypting (encrypt-then-MAC)
    const hmacReceived  = tokenBytes.slice(-32);
    const dataToVerify  = tokenBytes.slice(0, -32);
    const hmacExpected  = crypto.createHmac('sha256', signingKey)
                                .update(dataToVerify)
                                .digest();

    if (!crypto.timingSafeEqual(hmacReceived, hmacExpected)) {
        throw new Error('Fernet HMAC verification failed — wrong key or tampered token');
    }

    // Layout: version(1) + timestamp(8) + IV(16) + ciphertext(rest before HMAC)
    const iv         = tokenBytes.slice(9, 25);
    const ciphertext = tokenBytes.slice(25, -32);

    const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf-8');
}

// ─── Config parsing ───────────────────────────────────────────────────────────

/**
 * Parse a pipeline YAML string and return the encryption config.
 * Returns null if encryption is not enabled.
 *
 * @returns {{ masterKey: string, aes256Columns: string[] } | null}
 */
function parseEncryptionConfig(yamlConfig) {
    try {
        const config = yaml.load(yamlConfig);
        if (!config) return null;

        // Support both root-level and global-level encryption blocks
        const enc = config.encryption ?? config.global?.encryption;
        if (!enc || !enc.enabled) return null;

        const masterKey = enc.master_key;
        if (!masterKey) return null;

        const aes256Columns = (enc.columns || [])
            .filter(c => (c.method || '').toLowerCase() === 'aes256')
            .map(c => c.column)
            .filter(Boolean);

        if (aes256Columns.length === 0) return null;

        return { masterKey, aes256Columns };
    } catch {
        return null;
    }
}

// ─── Row decryption ───────────────────────────────────────────────────────────

/**
 * Decrypt AES-256 columns in an array of row objects.
 * Non-encrypted rows / null values / already-plain values are left untouched.
 *
 * @param {object[]} rows         - Array of plain objects from the DB
 * @param {string}   yamlConfig   - Raw YAML string of the pipeline config
 * @returns {object[]}            - Rows with decrypted values in-place (new objects)
 */
function decryptRows(rows, yamlConfig) {
    if (!rows || rows.length === 0) return rows;

    const encConfig = parseEncryptionConfig(yamlConfig);
    if (!encConfig) return rows;   // encryption not configured — return as-is

    const { masterKey, aes256Columns } = encConfig;

    // Derive key once and reuse across all rows
    const fernetKey32 = deriveFernetKey(masterKey);

    return rows.map(row => {
        const decryptedRow = { ...row };

        for (const col of aes256Columns) {
            const raw = decryptedRow[col];
            if (raw == null || raw === '') continue;

            try {
                decryptedRow[col] = fernetDecrypt(fernetKey32, raw);
            } catch {
                // Value not a Fernet token (e.g. already plain, or SHA-256 hash) — leave as-is
            }
        }

        return decryptedRow;
    });
}

module.exports = { decryptRows, parseEncryptionConfig };
