const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const [file, sourceFile, mode] = process.argv.slice(2);
const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8').replace(/^\uFEFF/, ''));
const db = new DatabaseSync(file, { readOnly: mode === 'verify' });
function merge(current, expected) {
  if (Array.isArray(expected)) {
    const previous = Array.isArray(current) ? current : [];
    return [...expected.map(row => ({ ...previous.find(old => old.id === row.id), ...row })), ...previous.filter(old => !expected.some(row => row.id === old.id))];
  }
  const result = current && typeof current === 'object' ? { ...current } : {};
  for (const [key, value] of Object.entries(expected)) result[key] = value && typeof value === 'object' ? merge(result[key], value) : value;
  return result;
}
function contains(current, expected) {
  if (Array.isArray(expected)) return Array.isArray(current) && expected.every(row => current.some(actual => actual.id === row.id && contains(actual, row)));
  if (expected && typeof expected === 'object') return current && Object.entries(expected).every(([key, value]) => contains(current[key], value));
  return current === expected;
}
try {
  if (mode !== 'verify') db.exec('CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB); BEGIN IMMEDIATE');
  for (const [key, expected] of Object.entries(source)) {
    if (!(key.startsWith('workbench.') || key === 'views.customizations')) throw Error('UI storage key is outside allowlist');
    const found = db.prepare('SELECT value FROM ItemTable WHERE key=?').get(key);
    const raw = found ? (typeof found.value === 'string' ? found.value : Buffer.from(found.value).toString()) : null;
    const current = raw && typeof expected === 'object' ? JSON.parse(raw) : raw;
    if (mode === 'verify') {
      if (!contains(current, expected)) throw Error('UI state mismatch: ' + key);
    } else {
      const next = typeof expected === 'object' ? JSON.stringify(merge(current, expected)) : expected;
      if (raw !== next) db.prepare('INSERT OR REPLACE INTO ItemTable(key,value) VALUES (?,?)').run(key, next);
    }
  }
  if (mode !== 'verify') db.exec('COMMIT');
} catch (error) {
  if (mode !== 'verify') { try { db.exec('ROLLBACK'); } catch {} }
  throw error;
} finally { db.close(); }
