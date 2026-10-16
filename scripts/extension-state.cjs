const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const [file, sourceFile, extensionsFile, mode] = process.argv.slice(2);
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const extensions = JSON.parse(fs.readFileSync(extensionsFile, 'utf8'));
const db = new DatabaseSync(file, { readOnly: mode === 'verify' });
try {
  if (mode !== 'verify') db.exec('CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)');
  const key = 'extensionsIdentifiers/disabled';
  const row = db.prepare('SELECT value FROM ItemTable WHERE key=?').get(key);
  const previous = row ? JSON.parse(Buffer.isBuffer(row.value) || row.value instanceof Uint8Array ? Buffer.from(row.value).toString() : row.value) : [];
  const sourceDisabled = source.disabledExtensions;
  if (mode === 'verify') {
    for (const item of sourceDisabled) if (!previous.some(p => p.id.toLowerCase() === item.id.toLowerCase())) throw new Error('Source disabled extension state missing: ' + item.id);
    for (const item of extensions.filter(e => e.enabled)) if (previous.some(p => p.id.toLowerCase() === item.id.toLowerCase())) throw new Error('Required extension disabled: ' + item.id);
  } else {
    const managed = new Set([...extensions.map(e => e.id.toLowerCase()), ...sourceDisabled.map(e => e.id.toLowerCase())]);
    const next = [...previous.filter(p => !managed.has(p.id.toLowerCase())), ...sourceDisabled];
    const text = JSON.stringify(next);
    if (JSON.stringify(previous) !== text) db.prepare('INSERT OR REPLACE INTO ItemTable(key,value) VALUES (?,?)').run(key, text);
  }
} finally { db.close(); }
