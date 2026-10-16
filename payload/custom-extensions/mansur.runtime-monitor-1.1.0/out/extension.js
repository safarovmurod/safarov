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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const runtimeMonitorCoordinator_1 = require("./panel/runtimeMonitorCoordinator");
const consoleViewProvider_1 = require("./panel/consoleViewProvider");
const networkViewProvider_1 = require("./panel/networkViewProvider");
function activate(context) {
    // 1. Shared Status Bar Item
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    statusBar.text = '$(dashboard) Runtime: ○';
    statusBar.tooltip = 'Runtime Monitor: Отключено (кликните для открытия Консоли)';
    statusBar.command = 'runtimeConsole.show';
    statusBar.show();
    // 2. Shared Coordinator (Single CDP connection, Single Browser instance, Shared Stores)
    const coordinator = new runtimeMonitorCoordinator_1.RuntimeMonitorCoordinator(context.extensionUri, context.globalStorageUri, statusBar);
    // 3. Register Native Panel Webview Providers
    const consoleRegistration = vscode.window.registerWebviewViewProvider(consoleViewProvider_1.ConsoleViewProvider.viewType, coordinator.consoleProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    });
    const networkRegistration = vscode.window.registerWebviewViewProvider(networkViewProvider_1.NetworkViewProvider.viewType, coordinator.networkProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    });
    // 4. Register Commands
    const showConsoleCmd = vscode.commands.registerCommand('runtimeConsole.show', () => {
        vscode.commands.executeCommand('workbench.view.extension.runtimeConsole');
    });
    const showRequestsCmd = vscode.commands.registerCommand('runtimeRequests.show', () => {
        vscode.commands.executeCommand('workbench.view.extension.runtimeRequests');
    });
    const connectCmd = vscode.commands.registerCommand('runtimeMonitor.connect', async () => {
        await coordinator.connect();
    });
    const disconnectCmd = vscode.commands.registerCommand('runtimeMonitor.disconnect', () => {
        coordinator.disconnect();
    });
    const clearConsoleCmd = vscode.commands.registerCommand('runtimeConsole.clear', () => {
        coordinator.clearConsole();
    });
    const clearRequestsCmd = vscode.commands.registerCommand('runtimeRequests.clear', () => {
        coordinator.clearNetwork();
    });
    const reloadCmd = vscode.commands.registerCommand('runtimeRequests.reload', async () => {
        await coordinator.reloadPage();
    });
    const reloadConsoleCmd = vscode.commands.registerCommand('runtimeConsole.reload', async () => {
        await coordinator.reloadPage();
    });
    context.subscriptions.push({ dispose: () => coordinator.dispose() }, statusBar, consoleRegistration, networkRegistration, showConsoleCmd, showRequestsCmd, connectCmd, disconnectCmd, clearConsoleCmd, clearRequestsCmd, reloadCmd, reloadConsoleCmd);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map