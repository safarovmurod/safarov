"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class NetworkViewProvider {
    extensionUri;
    coordinator;
    static viewType = 'runtimeRequests.view';
    view;
    constructor(extensionUri, coordinator) {
        this.extensionUri = extensionUri;
        this.coordinator = coordinator;
    }
    resolveWebviewView(webviewView, context, _token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'connect':
                    await this.coordinator.connect();
                    break;
                case 'disconnect':
                    this.coordinator.disconnect();
                    break;
                case 'clearNetwork':
                    this.coordinator.clearNetwork();
                    break;
                case 'reloadPage':
                    await this.coordinator.reloadPage();
                    break;
                case 'openSource':
                    await this.coordinator.openSource(msg.url, msg.line, msg.column);
                    break;
                case 'copy':
                    await this.coordinator.copy(msg.text);
                    break;
                case 'pinNetwork':
                    this.coordinator.togglePinNetwork(msg.id);
                    break;
                case 'getResponseBody':
                    await this.coordinator.fetchResponseBody(msg.requestId);
                    break;
                case 'requestDiff':
                    this.coordinator.compareRequests(msg.id1, msg.id2);
                    break;
                case 'setPreserveLog':
                    this.coordinator.setPreserveLog(msg.value);
                    break;
            }
        });
        // Send initial state
        this.sendInitialState();
        const config = vscode.workspace.getConfiguration('runtimeMonitor');
        if (config.get('autoConnect', true) && !this.coordinator.getConnected()) {
            this.coordinator.startDiscovery();
        }
    }
    getView() {
        return this.view;
    }
    postMessage(msg) {
        if (this.view) {
            this.view.webview.postMessage(msg);
        }
    }
    sendInitialState() {
        const preserve = vscode.workspace.getConfiguration('runtimeMonitor').get('preserveLog', false);
        this.postMessage({
            type: 'init',
            connected: this.coordinator.getConnected(),
            status: this.coordinator.getConnected() ? 'connected' : (this.coordinator.isManuallyDisconnected() ? 'disconnected' : 'waiting'),
            devUrl: this.coordinator.getDevUrl(),
            preserveLog: preserve,
            requests: this.coordinator.getNetworkRequests(),
            summary: {
                console: this.coordinator.getConsoleCounts(),
                network: this.coordinator.getNetworkSummary()
            }
        });
    }
    getHtmlForWebview(webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'runtimeMonitor.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'networkView.js'));
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Запросы</title>
</head>
<body>
  <div class="rm-view-container">
    <!-- Toolbar -->
    <header class="rm-toolbar">
      <div class="rm-toolbar-group">
        <button id="btnClearNetwork" class="rm-toolbar-btn" title="Очистить список запросов">Очистить</button>
        <button id="btnRecordNetwork" class="rm-toolbar-btn active" title="Включить / приостановить запись запросов">Запись</button>
        <button id="btnReloadPage" class="rm-toolbar-btn" title="Перезагрузить страницу (F5)">Перезагрузить</button>
      </div>

      <div class="rm-toolbar-divider"></div>

      <input type="text" id="networkSearch" class="rm-search-input" placeholder="Поиск (URL, метод, статус)..." />

      <div class="rm-filter-group" id="networkTypeFilters">
        <button class="rm-filter-btn active" data-type="all">Все</button>
        <button class="rm-filter-btn" data-type="xhr">Fetch/XHR</button>
        <button class="rm-filter-btn" data-type="doc">Document</button>
        <button class="rm-filter-btn" data-type="css">CSS</button>
        <button class="rm-filter-btn" data-type="js">JS</button>
        <button class="rm-filter-btn" data-type="failed">Failed</button>
        <button class="rm-filter-btn" data-type="slow">Slow</button>
        <button class="rm-filter-btn" data-type="dup">Duplicate</button>
      </div>

      <label class="rm-checkbox-label" title="Сохранять журнал запросов при перезагрузке">
        <input type="checkbox" id="chkPreserveNetwork" /> Preserve log
      </label>

      <button id="btnCompareResponse" class="rm-toolbar-btn" style="display:none;" title="Сравнить ответы двух выбранных запросов">Сравнить (Diff)</button>

      <div class="rm-toolbar-spacer"></div>

      <div class="rm-conn-indicator" id="connIndicator">
        <span class="rm-status-dot waiting" id="statusDot"></span>
        <span class="rm-status-text" id="statusText">Ожидание localhost...</span>
        <button id="btnConnect" class="rm-btn rm-btn-sm" title="Запустить / переподключить headless runtime">Подключить</button>
      </div>
    </header>

    <!-- Network Requests Table -->
    <main class="rm-network-table-wrap">
      <table class="rm-network-table">
        <thead>
          <tr>
            <th class="rm-network-th col-name">Name</th>
            <th class="rm-network-th col-method">Method</th>
            <th class="rm-network-th col-status">Status</th>
            <th class="rm-network-th col-type">Type</th>
            <th class="rm-network-th col-initiator">Initiator</th>
            <th class="rm-network-th col-size">Size</th>
            <th class="rm-network-th col-time">Time</th>
          </tr>
        </thead>
        <tbody id="networkTbody"></tbody>
      </table>
    </main>

    <!-- Response Diff Drawer -->
    <div id="diffDrawer" class="rm-diff-drawer" style="display:none;">
      <div class="rm-diff-header">
        <span id="diffTitle">Сравнение ответов (Response Diff)</span>
        <button id="btnCloseDiff" class="rm-btn rm-btn-sm">Закрыть</button>
      </div>
      <div id="diffContent" class="rm-diff-content"></div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
exports.NetworkViewProvider = NetworkViewProvider;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=networkViewProvider.js.map