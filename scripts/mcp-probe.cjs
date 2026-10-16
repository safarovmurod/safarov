const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const assert = require('assert');

async function probe(name, entry, args, call) {
  const child = spawn(process.execPath, [entry, ...args], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let sequence = 0;
  // Server diagnostics may contain target paths; do not copy them into the portable payload.
  child.stderr.resume();
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', line => {
    try {
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id); clearTimeout(request.timer);
        if (message.error) request.reject(Error(message.error.message));
        else request.resolve(message.result);
      }
    } catch { /* Ignore non-protocol diagnostic output. */ }
  });
  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(method + ' timed out')); }, 25000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  child.on('error', error => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); } pending.clear(); });
  try {
    const initialized = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'portable-verification', version: '1.0.0' } });
    assert(initialized.serverInfo, 'Missing MCP initialization response');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const listed = await request('tools/list', {});
    assert(listed.tools.some(tool => tool.name === call.name), 'Required tool not listed');
    const result = await request('tools/call', call);
    assert(!result.isError, 'Actual MCP tool call returned an error');
    assert(result.content?.length, 'Actual MCP tool call returned no content');
    return { name, status: 'PASS', serverVersion: initialized.serverInfo.version, tools: listed.tools.length, toolCalled: call.name };
  } finally {
    child.stdin.end();
    for (const item of pending.values()) clearTimeout(item.timer);
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(() => { child.kill(); resolve(); }, 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    lines.close();
  }
}

async function main() {
  const [runtime, browser, output] = process.argv.slice(2);
  const checks = [];
  for (const specification of [
    { name: 'Sequential Thinking MCP initialize/list/call', entry: '@modelcontextprotocol/server-sequential-thinking/dist/index.js', args: [], call: { name: 'sequentialthinking', arguments: { thought: 'Verify local portable runtime.', thoughtNumber: 1, totalThoughts: 1, nextThoughtNeeded: false } } },
    { name: 'Chrome DevTools MCP initialize/list/browser call', entry: 'chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js', args: ['--headless', '--isolated', '--no-usage-statistics', '--no-performance-crux', '--executablePath', browser], call: { name: 'list_pages', arguments: {} } }
  ]) {
    try { checks.push(await probe(specification.name, path.join(runtime, 'node_modules', specification.entry), specification.args, specification.call)); }
    catch (error) { checks.push({ name: specification.name, status: 'FAIL', reason: error.message }); }
  }
  fs.writeFileSync(output, JSON.stringify({ checks, createdAt: new Date().toISOString() }, null, 2));
  for (const row of checks) console.log(row.status + ': ' + row.name + (row.reason ? ': ' + row.reason : ''));
  if (checks.some(row => row.status !== 'PASS')) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
