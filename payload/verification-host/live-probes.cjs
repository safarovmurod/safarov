const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(test, message, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await test()) return;
    await pause(100);
  }
  throw Error(message);
}

exports.prepare = async function () {
  const extension = vscode.extensions.getExtension('mansur.runtime-monitor');
  const { RuntimeMonitorCoordinator } = require(path.join(extension.extensionPath, 'out/panel/runtimeMonitorCoordinator.js'));
  const state = {};
  // Exercise the installed coordinator with real VS Code services and an isolated browser profile.
  state.statusBar = vscode.window.createStatusBarItem();
  state.server = http.createServer((request, response) => {
    if (request.url.startsWith('/api')) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ ok: true, probe: 'portable-setup' }));
    } else {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Portable verification</title><p>Local verification only</p>');
    }
  });
  await new Promise(resolve => state.server.listen(0, '127.0.0.1', resolve));
  state.url = 'http://127.0.0.1:' + state.server.address().port;
  await vscode.workspace.getConfiguration('runtimeMonitor').update('devUrl', state.url, vscode.ConfigurationTarget.Workspace);
  state.coordinator = new RuntimeMonitorCoordinator(extension.extensionUri, vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'browser-profile')), state.statusBar);
  return state;
};

exports.monitor = async function (state, check) {
  const coordinator = state.coordinator;
  await check('Live Runtime Monitor coordinator connects to local fixture', async () => {
    await coordinator.connect();
    assert(coordinator.getConnected(), 'Actual Runtime Monitor did not connect');
    assert.equal(coordinator.getDevUrl(), state.url);
  });
  if (!coordinator || !coordinator.getConnected()) return;
  await check('Live Runtime Monitor console and completed network response', async () => {
    await coordinator.cdpClient.send('Runtime.evaluate', {
      expression: 'console.log("portable-runtime-once"); fetch("/api?probe=first")'
    });
    await until(() => coordinator.getConsoleEntries().some(entry => JSON.stringify(entry).includes('portable-runtime-once')) &&
      coordinator.getNetworkRequests().some(entry => entry.url.includes('probe=first') && entry.status === 200), 'Console/network event not delivered to actual stores');
    assert.equal(coordinator.getConsoleEntries().filter(entry => JSON.stringify(entry).includes('portable-runtime-once')).length, 1);
  });
  await check('Live Runtime Monitor refresh, one session and no duplicate events', async () => {
    const port = coordinator.launcher.port;
    await coordinator.connect();
    assert.equal(coordinator.launcher.port, port);
    await coordinator.reloadPage();
    await pause(700);
    await coordinator.cdpClient.send('Runtime.evaluate', { expression: 'console.log("portable-after-refresh"); fetch("/api?probe=refresh")' });
    await until(() => coordinator.getNetworkRequests().some(entry => entry.url.includes('probe=refresh') && entry.status === 200), 'Refresh network request missing');
    await until(() => coordinator.getConsoleEntries().some(entry => JSON.stringify(entry).includes('portable-after-refresh')), 'Refresh console entry missing');
    assert.equal(coordinator.getConsoleEntries().filter(entry => JSON.stringify(entry).includes('portable-after-refresh')).length, 1);
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    assert.equal(targets.filter(target => target.type === 'page').length, 1);
  });
  await check('Live Runtime Monitor clear and disconnect', async () => {
    coordinator.clearConsole();
    coordinator.clearNetwork();
    assert.equal(coordinator.getConsoleEntries().length, 0);
    assert.equal(coordinator.getNetworkRequests().length, 0);
    coordinator.disconnect();
    assert.equal(coordinator.getConnected(), false);
    assert.equal(coordinator.cdpClient.pendingRequests.size, 0);
  });
};

exports.visual = async function (check) {
  const extension = vscode.extensions.getExtension('mansur.runtime-monitor');
  const { CdpClient } = require(path.join(extension.extensionPath, 'out/cdp/cdpClient.js'));
  const client = new CdpClient();
  client.on('error', () => {});
  try {
    const targets = await (await fetch('http://127.0.0.1:' + process.env.PORTABLE_RENDERER_PORT + '/json/list')).json();
    const target = targets.find(row => row.type === 'page' && /workbench/i.test(row.url));
    assert(target, 'IDE renderer debugging target missing');
    await client.connect(target.webSocketDebuggerUrl);
    const evaluate = async expression => {
      const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
      return result.result.value;
    };
    await check('Live renderer has one Jelly layer and visible TypeScript editor', async () => {
      await until(() => evaluate('document.querySelectorAll(".jelly-cursor-layer").length === 1 && !!document.querySelector(".monaco-editor .view-lines")'), 'Jelly/editor DOM not ready');
    });
    await check('Live renderer Ripple creates, animates and removes its SVG circle', async () => {
      const actual = await evaluate(`(async () => {
        const editor = document.querySelector('.monaco-editor');
        if (!editor) throw Error('Editor missing');
        const rect = editor.getBoundingClientRect();
        editor.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.x + 100, clientY: rect.y + 35, pointerType: 'mouse' }));
        const circles = document.querySelectorAll('.jelly-cursor-svg circle');
        const circle = circles[0];
        let maximumRadius = Number(circle?.getAttribute('r'));
        await new Promise(resolve => {
          const deadline = performance.now() + 4000;
          function inspect() {
            maximumRadius = Math.max(maximumRadius, Number(circle?.getAttribute('r')) || 0);
            if (!circle?.isConnected || performance.now() > deadline) return resolve();
            requestAnimationFrame(inspect);
          }
          requestAnimationFrame(inspect);
          setTimeout(resolve, 4200);
        });
        return { count: circles.length, maximumRadius, removed: !circle?.isConnected, width: rect.width };
      })()`);
      assert.equal(actual.count, 1);
      assert(actual.width > 0);
      assert(actual.maximumRadius > 3, 'Ripple did not animate');
      assert(actual.removed, 'Ripple did not clean up');
    });
    await check('Live renderer source dark theme, font size and icon stylesheet', async () => {
      const config = vscode.workspace.getConfiguration();
      assert.equal(config.get('workbench.colorTheme'), 'Dark+');
      assert.equal(config.get('workbench.iconTheme'), 'material-icon-theme');
      const actual = await evaluate(`(() => {
        const lines = document.querySelector('.monaco-editor .view-lines');
        const css = [...document.querySelectorAll('style')].map(style => style.textContent).join('\\n');
        return { dark: !!document.querySelector('.vs-dark'), size: lines && getComputedStyle(lines).fontSize,
          family: lines && getComputedStyle(lines).fontFamily, icons: css.includes('material-icon-theme'), dpi: devicePixelRatio };
      })()`);
      assert(actual.dark, 'Dark theme not applied');
      assert.equal(actual.size, config.get('editor.fontSize') + 'px');
      assert(actual.family.includes('JetBrains Mono'), 'Source font family missing');
      assert(actual.icons, 'Material icon theme stylesheet not loaded');
    });
  } finally { client.disconnect(); }
};

exports.cleanup = async function (state) {
  if (!state) return;
  if (state.coordinator) { state.coordinator.disconnect(); state.coordinator.dispose(); }
  state.statusBar.dispose();
  state.server.closeAllConnections();
  await new Promise(resolve => state.server.close(resolve));
};
