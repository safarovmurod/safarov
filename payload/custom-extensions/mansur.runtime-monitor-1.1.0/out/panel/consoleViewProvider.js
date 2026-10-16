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
exports.ConsoleViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class ConsoleViewProvider {
    extensionUri;
    coordinator;
    static viewType = 'runtimeConsole.view';
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
                case 'clearConsole':
                    this.coordinator.clearConsole();
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
                case 'pinConsole':
                    this.coordinator.togglePinConsole(msg.id);
                    break;
                case 'getObjectProperties':
                    await this.coordinator.fetchObjectProperties(msg.objectId);
                    break;
                case 'setPreserveLog':
                    this.coordinator.setPreserveLog(msg.value);
                    break;
            }
        });
        // Send initial state
        this.sendInitialState();
        // Auto connect if configured
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
            logs: this.coordinator.getConsoleEntries(),
            summary: {
                console: this.coordinator.getConsoleCounts(),
                network: this.coordinator.getNetworkSummary()
            }
        });
    }
    getHtmlForWebview(webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'runtimeMonitor.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'consoleView.js'));
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Консоль</title>
</head>
<body>
  <div class="rm-view-container">
    <!-- Toolbar -->
    <header class="rm-toolbar">
      <div class="rm-toolbar-group">
        <button id="btnClearConsole" class="rm-toolbar-btn" title="Очистить консоль">Очистить</button>
        <button id="btnPauseConsole" class="rm-toolbar-btn" title="Пауза">Пауза</button>
        <button id="btnReloadConsole" class="rm-toolbar-btn" title="Обновить страницу">↻</button>
      </div>

      <div class="rm-toolbar-divider"></div>

      <input type="text" id="consoleSearch" class="rm-search-input" placeholder="Поиск в консоли..." />

      <div class="rm-filter-group" id="consoleLevelFilters">
        <button class="rm-filter-btn active" data-level="all">Все</button>
        <button class="rm-filter-btn" data-level="error">Ошибки</button>
        <button class="rm-filter-btn" data-level="warning">Предупреждения</button>
        <button class="rm-filter-btn" data-level="info">Инфо</button>
        <button class="rm-filter-btn" data-level="log">Логи</button>
      </div>

      <select id="consoleSourceFilter" class="rm-select" title="Фильтр по файлу">
        <option value="all">Все файлы</option>
      </select>

      <label class="rm-checkbox-label" title="Сохранять журнал при перезагрузке">
        <input type="checkbox" id="chkPreserveConsole" /> Preserve log
      </label>

      <div class="rm-toolbar-spacer"></div>

      <div class="rm-conn-indicator" id="connIndicator">
        <span class="rm-status-dot waiting" id="statusDot"></span>
        <span class="rm-status-text" id="statusText">Ожидание localhost...</span>
        <button id="btnConnect" class="rm-btn rm-btn-sm" title="Запустить / переподключить headless runtime">Подключить</button>
      </div>
    </header>

    <!-- Console Entries List -->
    <main class="rm-console-list" id="consoleList"></main>

    <!-- Scroll Bottom Button -->
    <button id="scrollBottomBtn" class="rm-scroll-bottom-btn" style="display:none;">Вниз</button>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
exports.ConsoleViewProvider = ConsoleViewProvider;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=consoleViewProvider.js.map