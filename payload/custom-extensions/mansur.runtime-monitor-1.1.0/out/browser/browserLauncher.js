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
exports.BrowserLauncher = void 0;
const cp = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const net = __importStar(require("net"));
const http = __importStar(require("http"));
class BrowserLauncher {
    spawnedProcess = null;
    currentPort = null;
    currentBrowserName = 'Chrome Headless';
    async launch(options) {
        // 1. If we already have an active port and process responding, reuse it!
        if (this.currentPort && await this.isPortResponding(this.currentPort)) {
            return {
                port: this.currentPort,
                browserName: this.currentBrowserName
            };
        }
        // Close any previous dead or zombie process
        this.close();
        const executable = this.findBrowserExecutable(options.browserType);
        if (!executable) {
            throw new Error('Браузер Chrome или Edge не найден на вашей системе для запуска Runtime Monitor.');
        }
        this.currentBrowserName = `${executable.name} Headless`;
        const port = await this.getFreePort();
        this.currentPort = port;
        const profileDir = path.join(options.globalStorageUri.fsPath, 'runtime-monitor-headless-profile');
        try {
            fs.mkdirSync(profileDir, { recursive: true });
        }
        catch { }
        const args = [
            '--headless=new',
            '--disable-gpu',
            `--remote-debugging-port=${port}`,
            '--remote-debugging-address=127.0.0.1',
            `--user-data-dir=${profileDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            options.devUrl
        ];
        this.spawnedProcess = cp.spawn(executable.path, args, {
            detached: false,
            stdio: 'ignore'
        });
        this.spawnedProcess.on('exit', () => {
            this.spawnedProcess = null;
            this.currentPort = null;
        });
        // Wait for the browser debugging port to be ready (up to 4.5s)
        const ready = await this.waitForPort(port, 4500);
        if (!ready) {
            this.close();
            throw new Error(`Headless браузер не ответил на порту отладки ${port}`);
        }
        return {
            port,
            browserName: this.currentBrowserName
        };
    }
    get port() {
        return this.currentPort;
    }
    get isRunning() {
        return this.spawnedProcess !== null && this.currentPort !== null;
    }
    async isPortResponding(port) {
        return new Promise((resolve) => {
            const req = http.get({
                host: '127.0.0.1',
                port,
                path: '/json/version',
                timeout: 800
            }, (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    }
    async waitForPort(port, timeoutMs) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (await this.isPortResponding(port)) {
                return true;
            }
            await new Promise((r) => setTimeout(r, 150));
        }
        return false;
    }
    close() {
        if (this.spawnedProcess && this.spawnedProcess.pid) {
            const pid = this.spawnedProcess.pid;
            try {
                if (process.platform === 'win32') {
                    try {
                        cp.execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
                    }
                    catch { }
                }
                else {
                    this.spawnedProcess.kill('SIGTERM');
                }
            }
            catch { }
            this.spawnedProcess = null;
        }
        this.currentPort = null;
    }
    findBrowserExecutable(type) {
        const chromePaths = [
            path.join(process.env['ProgramFiles'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env['ProgramFiles(x86)'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Antigravity-Portable', 'dependencies', 'chrome-win64', 'chrome.exe')
        ];
        const edgePaths = [
            path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.join(process.env['ProgramFiles'] || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe')
        ];
        if (type === 'chrome' || type === 'auto') {
            const c = chromePaths.find(p => fs.existsSync(p));
            if (c)
                return { name: 'Chrome', path: c };
        }
        if (type === 'edge' || type === 'auto') {
            const e = edgePaths.find(p => fs.existsSync(p));
            if (e)
                return { name: 'Edge', path: e };
        }
        return null;
    }
    async getFreePort() {
        return new Promise((resolve, reject) => {
            const srv = net.createServer();
            srv.listen(0, '127.0.0.1', () => {
                const address = srv.address();
                const port = address.port;
                srv.close(() => resolve(port));
            });
            srv.on('error', reject);
        });
    }
}
exports.BrowserLauncher = BrowserLauncher;
//# sourceMappingURL=browserLauncher.js.map