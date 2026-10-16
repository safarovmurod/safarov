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
exports.TargetDiscovery = void 0;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class TargetDiscovery {
    /**
     * Checks if an HTTP dev server is actively responding at the given URL.
     */
    static async isServerListening(urlStr) {
        return new Promise((resolve) => {
            try {
                const u = new URL(urlStr);
                const port = parseInt(u.port, 10) || (u.protocol === 'https:' ? 443 : 80);
                const req = http.get({
                    host: u.hostname,
                    port,
                    path: '/',
                    timeout: 600
                }, (res) => {
                    // Any response (200, 304, 404) proves the dev server is active and listening
                    resolve(res.statusCode !== undefined);
                });
                req.on('error', () => resolve(false));
                req.on('timeout', () => {
                    req.destroy();
                    resolve(false);
                });
            }
            catch {
                resolve(false);
            }
        });
    }
    /**
     * Detects the currently active dev server URL.
     */
    static async detectActiveDevServer(workspaceRoot, configuredDevUrl) {
        // 1. Check user configured URL
        if (configuredDevUrl && configuredDevUrl.trim()) {
            if (await this.isServerListening(configuredDevUrl)) {
                return configuredDevUrl;
            }
        }
        // 2. Check detected URL from package.json / vite.config
        const baseDevUrl = await this.findDevUrl(workspaceRoot);
        if (await this.isServerListening(baseDevUrl)) {
            return baseDevUrl;
        }
        // 3. Probe common dev server ports
        const candidatePorts = [5173, 5174, 3000, 3001, 8080, 5175];
        for (const p of candidatePorts) {
            const candUrl = `http://localhost:${p}`;
            if (candUrl !== baseDevUrl) {
                if (await this.isServerListening(candUrl)) {
                    return candUrl;
                }
            }
        }
        return null;
    }
    static async findDevUrl(workspaceRoot) {
        if (!workspaceRoot)
            return 'http://localhost:5173';
        const pkgPath = path.join(workspaceRoot, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                if (deps['next'])
                    return 'http://localhost:3000';
                if (deps['vite']) {
                    const port = this.checkVitePort(workspaceRoot);
                    return `http://localhost:${port || 5173}`;
                }
                if (deps['react-scripts'])
                    return 'http://localhost:3000';
            }
            catch { }
        }
        return 'http://localhost:5173';
    }
    static async queryTargets(port) {
        return new Promise((resolve) => {
            const req = http.get({
                host: '127.0.0.1',
                port,
                path: '/json/list',
                timeout: 1000
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const targets = JSON.parse(data);
                        resolve(Array.isArray(targets) ? targets : []);
                    }
                    catch {
                        resolve([]);
                    }
                });
            });
            req.on('error', () => resolve([]));
            req.on('timeout', () => {
                req.destroy();
                resolve([]);
            });
        });
    }
    /**
     * Enforces Rule 59 & 60: active page targets for project <= 1.
     * Closes any extraneous page targets on the debugging port.
     */
    static async closeExtraPageTargets(port, keepTargetId) {
        try {
            const targets = await this.queryTargets(port);
            const pageTargets = targets.filter(t => t.type === 'page');
            if (pageTargets.length <= 1)
                return;
            const targetToKeep = keepTargetId || pageTargets[0]?.id;
            for (const p of pageTargets) {
                if (p.id !== targetToKeep) {
                    await new Promise((resolve) => {
                        const req = http.get({
                            host: '127.0.0.1',
                            port,
                            path: `/json/close/${p.id}`,
                            timeout: 1000
                        }, () => resolve(true));
                        req.on('error', () => resolve(false));
                        req.on('timeout', () => {
                            req.destroy();
                            resolve(false);
                        });
                    });
                }
            }
        }
        catch { }
    }
    static async waitForBestTarget(port, devUrl, timeoutMs = 4000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const targets = await this.queryTargets(port);
            const best = this.selectBestTarget(targets, devUrl);
            if (best) {
                // Enforce active page targets <= 1: close any extra duplicate page targets
                await this.closeExtraPageTargets(port, best.id);
                return best;
            }
            await new Promise(r => setTimeout(r, 150));
        }
        return undefined;
    }
    static selectBestTarget(targets, devUrl) {
        const pageTargets = targets.filter(t => t.type === 'page' && Boolean(t.webSocketDebuggerUrl));
        if (pageTargets.length === 0)
            return undefined;
        // 1. Try matching origin or devUrl
        try {
            const dOrigin = new URL(devUrl).origin;
            const matched = pageTargets.find(t => {
                try {
                    return new URL(t.url).origin === dOrigin;
                }
                catch {
                    return false;
                }
            });
            if (matched)
                return matched;
        }
        catch { }
        // 2. Return first page target
        return pageTargets[0];
    }
    static checkVitePort(root) {
        for (const name of ['vite.config.ts', 'vite.config.js']) {
            const p = path.join(root, name);
            if (fs.existsSync(p)) {
                try {
                    const content = fs.readFileSync(p, 'utf8');
                    const portMatch = content.match(/port\s*:\s*(\d+)/);
                    if (portMatch)
                        return parseInt(portMatch[1], 10);
                }
                catch { }
            }
        }
        return null;
    }
}
exports.TargetDiscovery = TargetDiscovery;
//# sourceMappingURL=targetDiscovery.js.map