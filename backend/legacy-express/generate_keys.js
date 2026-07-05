const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const backupPath = path.join(__dirname, '..', 'chat_encryption_key_backup.txt');

// Generate 32 bytes hex for AES-256 (64 characters)
const encryptionKey = crypto.randomBytes(32).toString('hex');
const jwtSecret = crypto.randomBytes(32).toString('hex');

const envContent = `\n# --- Security Settings (Auto-generated) ---\nCHAT_ENCRYPTION_SECRET=${encryptionKey}\nJWT_SECRET=${jwtSecret}\n`;
fs.appendFileSync(envPath, envContent);

const backupContent = `=========================================================
JIRA DASHBOARD - CHAT ENCRYPTION KEY BACKUP
=========================================================

Please store this key in a secure location (e.g. Password Manager).
If you lose your .env file, you will need this key to decrypt your 
teams.json chat history.

CHAT_ENCRYPTION_SECRET=${encryptionKey}
`;

fs.writeFileSync(backupPath, backupContent);
console.log("Keys generated and saved.");
