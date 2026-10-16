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
exports.RuntimeMonitorCoordinator = void 0;
const vscode = __importStar(require("vscode"));
const cdpClient_1 = require("../cdp/cdpClient");
const browserLauncher_1 = require("../browser/browserLauncher");
const targetDiscovery_1 = require("../browser/targetDiscovery");
const consoleStore_1 = require("../console/consoleStore");
const errorParser_1 = require("../console/errorParser");
const networkStore_1 = require("../network/networkStore");
const paths_1 = require("../utils/paths");
const diff_1 = require("../utils/diff");
const consoleViewProvider_1 = require("./consoleViewProvider");
const networkViewProvider_1 = require("./networkViewProvider");
class RuntimeMonitorCoordinator {
    extensionUri;
    globalStorageUri;
    cdpClient = new cdpClient_1.CdpClient();
    launcher = new browserLauncher_1.BrowserLauncher();
    consoleStore = new consoleStore_1.ConsoleStore();
    networkStore = new networkStore_1.NetworkStore();
    isConnected = false;
    isManualDisconnect = false;
    currentDevUrl = 'http://localhost:5173';
    connectedTargetId = null;
    updateBatchTimeout = null;
    pollTimer = null;
    isConnecting = false;
    currentGeneration = 1;
    pendingConsoleEntries = [];
    pendingNetworkUpdates = [];
    statusBarItem;
    consoleProvider;
    networkProvider;
    constructor(extensionUri, globalStorageUri, statusBarItem) {
        this.extensionUri = extensionUri;
        this.globalStorageUri = globalStorageUri;
        this.statusBarItem = statusBarItem;
        this.consoleProvider = new consoleViewProvider_1.ConsoleViewProvider(extensionUri, this);
        this.networkProvider = new networkViewProvider_1.NetworkViewProvider(extensionUri, this);
        this.setupCdpEvents();
        this.startAutoDiscoveryLoop();
    }
    startDiscovery() {
        this.startAutoDiscoveryLoop();
    }
    getConnected() {
        return this.isConnected;
    }
    isManuallyDisconnected() {
        return this.isManualDisconnect;
    }
    getDevUrl() {
        return this.currentDevUrl;
    }
    getConsoleEntries() {
        return this.consoleStore.getEntries();
    }
    getNetworkRequests() {
        return this.networkStore.getRequests();
    }
    getConsoleCounts() {
        return this.consoleStore.getCounts();
    }
    getNetworkSummary() {
        return this.networkStore.getSummary();
    }
    /**
     * Connect or reconnect the hidden headless runtime session.
     * Rule 57, 59, 60: 1 active project = 1 CDP session = 1 page target.
     */
    async connect(silent = false) {
        if (this.isConnected || this.isConnecting)
            return;
        this.isManualDisconnect = false;
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const config = vscode.workspace.getConfiguration('runtimeMonitor');
        const configuredDevUrl = config.get('devUrl');
        // 1. Detect if dev server is currently running
        const activeDevUrl = await targetDiscovery_1.TargetDiscovery.detectActiveDevServer(wsRoot, configuredDevUrl);
        if (!activeDevUrl) {
            this.updateStatusWaiting();
            if (!silent) {
                vscode.window.showInformationMessage('Runtime Monitor: Ожидание запуска localhost (npm run dev)...');
            }
            return;
        }
        this.currentDevUrl = activeDevUrl;
        try {
            this.isConnecting = true;
            this.consoleProvider.postMessage({ type: 'status', status: 'waiting', text: 'Запуск headless runtime...' });
            this.networkProvider.postMessage({ type: 'status', status: 'waiting', text: 'Запуск headless runtime...' });
            // 2. Launch or reuse hidden headless browser
            const browserType = config.get('browser', 'auto');
            const launched = await this.launcher.launch({
                browserType,
                devUrl: activeDevUrl,
                globalStorageUri: this.globalStorageUri
            });
            // 3. Find page target in headless browser
            const target = await targetDiscovery_1.TargetDiscovery.waitForBestTarget(launched.port, activeDevUrl, 4000);
            if (!target || !target.webSocketDebuggerUrl) {
                throw new Error('Не удалось получить целевую страницу в headless runtime');
            }
            // Rule 59 & 60: enforce active page targets <= 1
            await targetDiscovery_1.TargetDiscovery.closeExtraPageTargets(launched.port, target.id);
            this.connectedTargetId = target.id;
            // 4. Connect CDP
            await this.cdpClient.connect(target.webSocketDebuggerUrl);
            // Enable CDP domains: ONLY Runtime, Page, Network.
            // Rule 55: Log domain is NOT enabled to prevent duplicate console events.
            await this.cdpClient.send('Runtime.enable');
            await this.cdpClient.send('Page.enable');
            await this.cdpClient.send('Network.enable', { maxPostDataSize: 65536 });
            this.isConnected = true;
            vscode.commands.executeCommand('setContext', 'runtimeMonitor.connected', true);
            this.updateStatusConnected();
            const connMsg = {
                type: 'connected',
                connected: true,
                url: target.url || activeDevUrl,
                title: target.title || 'React App',
                targetId: target.id
            };
            this.consoleProvider.postMessage(connMsg);
            this.networkProvider.postMessage(connMsg);
        }
        catch (err) {
            this.isConnected = false;
            this.connectedTargetId = null;
            this.updateStatusWaiting();
        }
        finally {
            this.isConnecting = false;
        }
    }
    /**
     * Disconnects the headless session and cleanly shuts down the headless process.
     */
    disconnect() {
        this.isManualDisconnect = true;
        this.cdpClient.disconnect();
        this.launcher.close();
        this.isConnected = false;
        this.connectedTargetId = null;
        this.currentGeneration++;
        this.pendingConsoleEntries = [];
        this.pendingNetworkUpdates = [];
        if (this.updateBatchTimeout) {
            clearTimeout(this.updateBatchTimeout);
            this.updateBatchTimeout = null;
        }
        vscode.commands.executeCommand('setContext', 'runtimeMonitor.connected', false);
        this.updateStatusDisconnected();
        const disMsg = { type: 'disconnected', connected: false, text: 'Отключено' };
        this.consoleProvider.postMessage(disMsg);
        this.networkProvider.postMessage(disMsg);
    }
    /**
     * Reload page inside headless browser.
     * Rule 58, 64, 39, 41: Clean reload using Page.reload and generation tracking.
     */
    async reloadPage() {
        if (!this.isConnected || !this.cdpClient.connected) {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const config = vscode.workspace.getConfiguration('runtimeMonitor');
            const activeDevUrl = await targetDiscovery_1.TargetDiscovery.detectActiveDevServer(wsRoot, config.get('devUrl'));
            if (activeDevUrl) {
                await this.connect(true);
            }
            else {
                vscode.window.showInformationMessage('Runtime Monitor: Ожидание запуска localhost (npm run dev)...');
            }
            return;
        }
        const preserve = vscode.workspace.getConfiguration('runtimeMonitor').get('preserveLog', false);
        this.currentGeneration++;
        const gen = this.currentGeneration;
        this.pendingConsoleEntries = [];
        this.pendingNetworkUpdates = [];
        if (this.updateBatchTimeout) {
            clearTimeout(this.updateBatchTimeout);
            this.updateBatchTimeout = null;
        }
        if (!preserve) {
            this.consoleStore.clear(false);
            this.networkStore.clear(false);
            this.consoleProvider.postMessage({ type: 'clearConsole', generation: gen });
            this.networkProvider.postMessage({ type: 'clearNetwork', generation: gen });
        }
        try {
            await this.cdpClient.send('Page.reload', { ignoreCache: false });
        }
        catch { }
    }
    clearConsole() {
        this.consoleStore.clear(false);
        this.pendingConsoleEntries = [];
        this.consoleProvider.postMessage({ type: 'clearConsole', generation: this.currentGeneration });
    }
    clearNetwork() {
        this.networkStore.clear(false);
        this.pendingNetworkUpdates = [];
        this.networkProvider.postMessage({ type: 'clearNetwork', generation: this.currentGeneration });
    }
    togglePinConsole(id) {
        const isPinned = this.consoleStore.togglePin(id);
        this.consoleProvider.postMessage({
            type: 'pinUpdated',
            kind: 'console',
            id,
            pinned: isPinned
        });
    }
    togglePinNetwork(id) {
        const isPinned = this.networkStore.togglePin(id);
        this.networkProvider.postMessage({
            type: 'pinUpdated',
            kind: 'network',
            id,
            pinned: isPinned
        });
    }
    async fetchObjectProperties(objectId) {
        try {
            const res = await this.cdpClient.send('Runtime.getProperties', {
                objectId,
                ownProperties: true,
                generatePreview: true
            });
            this.consoleProvider.postMessage({
                type: 'objectProperties',
                objectId,
                properties: res.result || []
            });
        }
        catch (err) {
            this.consoleProvider.postMessage({
                type: 'objectProperties',
                objectId,
                properties: [],
                error: err.message
            });
        }
    }
    async fetchResponseBody(requestId) {
        try {
            const res = await this.cdpClient.send('Network.getResponseBody', { requestId });
            this.networkStore.setResponseBody(requestId, res.body, res.base64Encoded);
            this.networkProvider.postMessage({
                type: 'responseBody',
                requestId,
                body: res.body,
                base64Encoded: res.base64Encoded
            });
        }
        catch {
            this.networkProvider.postMessage({
                type: 'responseBody',
                requestId,
                body: '(Тело ответа недоступно)',
                base64Encoded: false
            });
        }
    }
    compareRequests(id1, id2) {
        const req1 = this.networkStore.getById(id1);
        const req2 = this.networkStore.getById(id2);
        if (!req1 || !req2) {
            vscode.window.showWarningMessage('Выберите два запроса для сравнения');
            return;
        }
        try {
            const json1 = req1.responseBody ? JSON.parse(req1.responseBody) : null;
            const json2 = req2.responseBody ? JSON.parse(req2.responseBody) : null;
            if (!json1 || !json2) {
                vscode.window.showWarningMessage('Сравнение доступно только для ответов в формате JSON');
                return;
            }
            const diff = (0, diff_1.compareJsonObjects)(json1, json2, false);
            this.networkProvider.postMessage({
                type: 'diffResult',
                id1,
                id2,
                name1: `${req1.method} ${req1.name}`,
                name2: `${req2.method} ${req2.name}`,
                diff
            });
        }
        catch {
            vscode.window.showWarningMessage('Сравнение доступно только для ответов в формате JSON');
        }
    }
    async openSource(url, line = 1, col = 1) {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsRoot)
            return;
        const resolved = (0, paths_1.mapUrlToWorkspaceFile)(url, wsRoot, line, col);
        if (!resolved) {
            vscode.window.showInformationMessage(`Файл не найден в рабочей области: ${url}`);
            return;
        }
        try {
            const doc = await vscode.workspace.openTextDocument(resolved.fullPath);
            const targetLine = Math.max(0, resolved.line - 1);
            const targetCol = Math.max(0, resolved.col - 1);
            const pos = new vscode.Position(targetLine, targetCol);
            const editor = await vscode.window.showTextDocument(doc, {
                selection: new vscode.Range(pos, pos),
                preview: false
            });
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Не удалось открыть файл: ${err.message}`);
        }
    }
    async copy(text) {
        if (!text)
            return;
        await vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage('Скопировано в буфер обмена');
    }
    setPreserveLog(val) {
        vscode.workspace.getConfiguration('runtimeMonitor').update('preserveLog', val, vscode.ConfigurationTarget.Global);
    }
    dispose() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.cdpClient.disconnect();
        this.launcher.close();
    }
    startAutoDiscoveryLoop() {
        if (this.pollTimer)
            return;
        this.pollTimer = setInterval(async () => {
            if (this.isManualDisconnect || this.isConnecting)
                return;
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const config = vscode.workspace.getConfiguration('runtimeMonitor');
            if (!config.get('autoConnect', true))
                return;
            const configuredDevUrl = config.get('devUrl');
            const activeDevUrl = await targetDiscovery_1.TargetDiscovery.detectActiveDevServer(wsRoot, configuredDevUrl);
            if (this.isConnected) {
                if (!activeDevUrl) {
                    this.handleDevServerLost();
                }
            }
            else {
                if (activeDevUrl) {
                    await this.connect(true);
                }
                else {
                    this.updateStatusWaiting();
                }
            }
        }, 2000);
    }
    handleDevServerLost() {
        this.isConnected = false;
        this.connectedTargetId = null;
        this.cdpClient.disconnect();
        this.launcher.close();
        vscode.commands.executeCommand('setContext', 'runtimeMonitor.connected', false);
        this.updateStatusWaiting();
        const disMsg = {
            type: 'status',
            status: 'waiting',
            text: 'Ожидание localhost...'
        };
        this.consoleProvider.postMessage(disMsg);
        this.networkProvider.postMessage(disMsg);
    }
    setupCdpEvents() {
        // Rule 55: Passively capture console messages via CDP
        this.cdpClient.on('Runtime.consoleAPICalled', (params) => {
            this.handleConsoleEvent(params);
        });
        this.cdpClient.on('Runtime.exceptionThrown', (params) => {
            this.handleExceptionEvent(params);
        });
        this.cdpClient.on('Network.webSocketFrameReceived', (params) => {
            this.handleWebSocketFrame(params);
        });
        // Rule 36, 37, 38: Request lifecycle updates single record by requestId
        this.cdpClient.on('Network.requestWillBeSent', (params) => {
            const gen = this.currentGeneration;
            const preserve = vscode.workspace.getConfiguration('runtimeMonitor').get('preserveLog', false);
            if (!preserve && gen < this.currentGeneration)
                return;
            const req = this.networkStore.handleRequestWillBeSent(params, gen);
            this.resolveInitiatorSource(req);
            this.queueNetworkUpdate({ action: 'add', request: req });
        });
        this.cdpClient.on('Network.responseReceived', (params) => {
            const req = this.networkStore.handleResponseReceived(params);
            if (req) {
                this.queueNetworkUpdate({ action: 'update', request: req });
            }
        });
        this.cdpClient.on('Network.loadingFinished', (params) => {
            const req = this.networkStore.handleLoadingFinished(params);
            if (req) {
                this.queueNetworkUpdate({ action: 'update', request: req });
            }
        });
        this.cdpClient.on('Network.loadingFailed', (params) => {
            const req = this.networkStore.handleLoadingFailed(params);
            if (req) {
                this.queueNetworkUpdate({ action: 'update', request: req });
            }
        });
        // Rule 41 & 64: Track page navigation / full reloads
        this.cdpClient.on('Page.frameNavigated', (params) => {
            if (!params?.frame?.parentId) {
                const preserve = vscode.workspace.getConfiguration('runtimeMonitor').get('preserveLog', false);
                if (!preserve) {
                    this.currentGeneration++;
                    const gen = this.currentGeneration;
                    this.pendingConsoleEntries = [];
                    this.pendingNetworkUpdates = [];
                    if (this.updateBatchTimeout) {
                        clearTimeout(this.updateBatchTimeout);
                        this.updateBatchTimeout = null;
                    }
                    this.consoleStore.clear(false);
                    this.networkStore.clear(false);
                    this.consoleProvider.postMessage({ type: 'clearConsole', generation: gen });
                    this.networkProvider.postMessage({ type: 'clearNetwork', generation: gen });
                }
            }
        });
        this.cdpClient.on('disconnected', () => {
            if (this.isConnected) {
                this.handleDevServerLost();
            }
        });
    }
    handleWebSocketFrame(params) {
        const payloadData = params?.response?.payloadData;
        if (typeof payloadData === 'string') {
            try {
                const msg = JSON.parse(payloadData);
                if (msg.type === 'error' && msg.err) {
                    this.handleViteErrorPayload(msg.err);
                }
            }
            catch { }
        }
    }
    handleViteErrorPayload(err) {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const errorDetail = (0, errorParser_1.parseViteErrorPayload)(err, wsRoot);
        const timeFormatted = new Date().toLocaleTimeString();
        const entry = this.consoleStore.add({
            timestamp: Date.now(),
            timeFormatted,
            type: 'error',
            args: [{
                    type: 'object',
                    subtype: 'error',
                    description: errorDetail.cleanMessage
                }],
            text: errorDetail.cleanMessage,
            sourceFile: errorDetail.filePath ? `${errorDetail.filePath}:${errorDetail.line || 1}:${errorDetail.column || 1}` : undefined,
            sourceLine: errorDetail.line,
            sourceCol: errorDetail.column,
            sourceRawUrl: errorDetail.fullPath || errorDetail.originalUrl,
            stackTrace: errorDetail.browserStack || [],
            errorDetail,
            generation: this.currentGeneration
        });
        this.queueConsoleEntry(entry);
        const openOnError = vscode.workspace.getConfiguration('runtimeMonitor').get('openOnError', false);
        if (openOnError && this.consoleProvider.getView()) {
            this.consoleProvider.getView()?.show(true);
        }
    }
    handleConsoleEvent(params) {
        const { type, args, timestamp, stackTrace } = params;
        const gen = this.currentGeneration;
        const preserve = vscode.workspace.getConfiguration('runtimeMonitor').get('preserveLog', false);
        if (!preserve && gen < this.currentGeneration)
            return;
        const timeFormatted = new Date().toLocaleTimeString();
        let text = '';
        const formattedArgs = (args || []).map((a) => {
            if (a.value !== undefined) {
                text += (text ? ' ' : '') + String(a.value);
            }
            else if (a.description) {
                text += (text ? ' ' : '') + a.description;
            }
            return {
                type: a.type,
                subtype: a.subtype,
                className: a.className,
                value: a.value,
                description: a.description,
                objectId: a.objectId,
                preview: a.preview
            };
        });
        // Rule 76: Filter service logs
        const isViteService = (0, errorParser_1.isViteServiceMessage)(text);
        if (isViteService) {
            return;
        }
        let entryType = type || 'log';
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        let errorDetail;
        if (!isViteService && (entryType === 'error' || text.includes('[plugin:') || text.includes('Transform failed') || text.includes('[PARSE_ERROR]'))) {
            errorDetail = (0, errorParser_1.parseErrorText)(text, wsRoot, stackTrace?.callFrames);
            if (errorDetail) {
                entryType = 'error';
            }
        }
        let sourceFile;
        let sourceLine;
        let sourceCol;
        let sourceRawUrl;
        const stack = [];
        if (errorDetail) {
            sourceFile = errorDetail.filePath ? `${errorDetail.filePath}:${errorDetail.line || 1}:${errorDetail.column || 1}` : undefined;
            sourceLine = errorDetail.line;
            sourceCol = errorDetail.column;
            sourceRawUrl = errorDetail.fullPath || errorDetail.originalUrl;
            if (errorDetail.browserStack) {
                stack.push(...errorDetail.browserStack);
            }
        }
        else if (!isViteService && stackTrace?.callFrames && stackTrace.callFrames.length > 0) {
            let bestFrame = stackTrace.callFrames.find((f) => f.url && !f.url.includes('@vite/client') && !f.url.includes('node_modules'));
            if (!bestFrame)
                bestFrame = stackTrace.callFrames[0];
            sourceRawUrl = bestFrame.url;
            sourceLine = (bestFrame.lineNumber || 0) + 1;
            sourceCol = (bestFrame.columnNumber || 0) + 1;
            if (wsRoot && bestFrame.url) {
                const resolved = (0, paths_1.mapUrlToWorkspaceFile)(bestFrame.url, wsRoot, sourceLine, sourceCol);
                if (resolved) {
                    sourceFile = `${resolved.fileName}:${resolved.line}`;
                    sourceRawUrl = resolved.fullPath;
                }
                else {
                    sourceFile = `${bestFrame.url.split('/').pop()?.split('?')[0] || 'inline'}:${sourceLine}`;
                }
            }
            for (const frame of stackTrace.callFrames.slice(0, 8)) {
                if (!frame.url?.includes('@vite/client')) {
                    stack.push(`at ${frame.functionName || '<anonymous>'} (${frame.url}:${(frame.lineNumber || 0) + 1}:${(frame.columnNumber || 0) + 1})`);
                }
            }
        }
        const entry = this.consoleStore.add({
            timestamp: timestamp || Date.now(),
            timeFormatted,
            type: entryType,
            args: formattedArgs,
            text: errorDetail ? errorDetail.cleanMessage : (text || '(empty)'),
            sourceFile,
            sourceLine,
            sourceCol,
            sourceRawUrl,
            stackTrace: stack,
            errorDetail,
            generation: gen
        });
        this.queueConsoleEntry(entry);
    }
    handleExceptionEvent(params) {
        const { exceptionDetails, timestamp } = params;
        const gen = this.currentGeneration;
        const preserve = vscode.workspace.getConfiguration('runtimeMonitor').get('preserveLog', false);
        if (!preserve && gen < this.currentGeneration)
            return;
        const desc = exceptionDetails?.exception?.description || exceptionDetails?.text || 'Uncaught Error';
        const timeFormatted = new Date(timestamp || Date.now()).toLocaleTimeString();
        if ((0, errorParser_1.isViteServiceMessage)(desc)) {
            return;
        }
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const errorDetail = (0, errorParser_1.parseErrorText)(desc, wsRoot, exceptionDetails?.stackTrace?.callFrames);
        let sourceFile;
        let sourceLine = exceptionDetails?.lineNumber !== undefined ? exceptionDetails.lineNumber + 1 : undefined;
        let sourceCol = exceptionDetails?.columnNumber !== undefined ? exceptionDetails.columnNumber + 1 : undefined;
        const stack = [];
        if (errorDetail) {
            sourceFile = errorDetail.filePath ? `${errorDetail.filePath}:${errorDetail.line || 1}:${errorDetail.column || 1}` : undefined;
            sourceLine = errorDetail.line;
            sourceCol = errorDetail.column;
            if (errorDetail.browserStack) {
                stack.push(...errorDetail.browserStack);
            }
        }
        else if (exceptionDetails?.stackTrace?.callFrames) {
            let bestFrame = exceptionDetails.stackTrace.callFrames.find((f) => f.url && !f.url.includes('@vite/client') && !f.url.includes('node_modules'));
            if (!bestFrame)
                bestFrame = exceptionDetails.stackTrace.callFrames[0];
            if (bestFrame) {
                sourceLine = (bestFrame.lineNumber || 0) + 1;
                sourceCol = (bestFrame.columnNumber || 0) + 1;
                if (wsRoot && bestFrame.url) {
                    const resolved = (0, paths_1.mapUrlToWorkspaceFile)(bestFrame.url, wsRoot, sourceLine, sourceCol);
                    if (resolved) {
                        sourceFile = `${resolved.fileName}:${resolved.line}`;
                    }
                }
            }
            for (const frame of exceptionDetails.stackTrace.callFrames.slice(0, 8)) {
                if (!frame.url?.includes('@vite/client')) {
                    stack.push(`at ${frame.functionName || '<anonymous>'} (${frame.url}:${(frame.lineNumber || 0) + 1}:${(frame.columnNumber || 0) + 1})`);
                }
            }
        }
        const entry = this.consoleStore.add({
            timestamp: timestamp || Date.now(),
            timeFormatted,
            type: 'error',
            args: [{
                    type: 'object',
                    subtype: 'error',
                    description: errorDetail ? errorDetail.cleanMessage : desc
                }],
            text: errorDetail ? errorDetail.cleanMessage : desc,
            sourceFile,
            sourceLine,
            sourceCol,
            sourceRawUrl: errorDetail?.fullPath || exceptionDetails?.url,
            stackTrace: stack,
            errorDetail,
            generation: gen
        });
        this.queueConsoleEntry(entry);
        const openOnError = vscode.workspace.getConfiguration('runtimeMonitor').get('openOnError', false);
        if (openOnError && this.consoleProvider.getView()) {
            this.consoleProvider.getView()?.show(true);
        }
    }
    resolveInitiatorSource(req) {
        if (req.initiator?.file) {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (wsRoot) {
                const res = (0, paths_1.mapUrlToWorkspaceFile)(req.initiator.file, wsRoot, req.initiator.line, req.initiator.col);
                if (res) {
                    req.initiator.file = res.relPath;
                    req.initiator.raw = `${res.fileName}:${res.line}`;
                }
            }
        }
    }
    queueConsoleEntry(entry) {
        this.pendingConsoleEntries.push(entry);
        this.scheduleBatchUpdate();
    }
    queueNetworkUpdate(update) {
        this.pendingNetworkUpdates.push(update);
        this.scheduleBatchUpdate();
    }
    scheduleBatchUpdate() {
        if (this.updateBatchTimeout)
            return;
        this.updateBatchTimeout = setTimeout(() => {
            this.updateBatchTimeout = null;
            if (this.pendingConsoleEntries.length > 0) {
                this.consoleProvider.postMessage({
                    type: 'consoleBatch',
                    entries: this.pendingConsoleEntries
                });
                this.pendingConsoleEntries = [];
            }
            if (this.pendingNetworkUpdates.length > 0) {
                this.networkProvider.postMessage({
                    type: 'networkBatch',
                    updates: this.pendingNetworkUpdates
                });
                this.pendingNetworkUpdates = [];
            }
            const cCounts = this.consoleStore.getCounts();
            const nSummary = this.networkStore.getSummary();
            this.consoleProvider.postMessage({
                type: 'sessionSummary',
                console: cCounts
            });
            this.networkProvider.postMessage({
                type: 'sessionSummary',
                network: nSummary
            });
        }, 50);
    }
    updateStatusConnected() {
        this.statusBarItem.text = '$(dashboard) Runtime: ●';
        this.statusBarItem.tooltip = `Runtime Monitor: Подключено (${this.currentDevUrl})`;
        this.statusBarItem.color = new vscode.ThemeColor('testing.iconPassed');
        this.statusBarItem.show();
    }
    updateStatusWaiting() {
        this.statusBarItem.text = '$(dashboard) Runtime: ○';
        this.statusBarItem.tooltip = 'Runtime Monitor: Ожидание localhost...';
        this.statusBarItem.color = undefined;
        this.statusBarItem.show();
    }
    updateStatusDisconnected() {
        this.statusBarItem.text = '$(dashboard) Runtime: ○';
        this.statusBarItem.tooltip = 'Runtime Monitor: Отключено';
        this.statusBarItem.color = undefined;
        this.statusBarItem.show();
    }
}
exports.RuntimeMonitorCoordinator = RuntimeMonitorCoordinator;
//# sourceMappingURL=runtimeMonitorCoordinator.js.map