"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdpClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
class CdpClient extends events_1.EventEmitter {
    ws = null;
    messageId = 1;
    pendingRequests = new Map();
    isConnected = false;
    constructor() {
        super();
    }
    async connect(webSocketUrl) {
        // 1. Clean up any existing socket before opening a new one
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                this.ws.close();
            }
            catch { }
            this.ws = null;
        }
        this.cleanPendingRequests(new Error('Reconnecting to new target'));
        this.isConnected = false;
        return new Promise((resolve, reject) => {
            try {
                this.ws = new ws_1.default(webSocketUrl);
                this.ws.on('open', () => {
                    this.isConnected = true;
                    this.emit('connected');
                    resolve();
                });
                this.ws.on('message', (data) => {
                    this.handleMessage(data.toString());
                });
                this.ws.on('close', (code, reason) => {
                    const wasConnected = this.isConnected;
                    this.isConnected = false;
                    this.cleanPendingRequests(new Error(`WebSocket closed: ${code} ${reason}`));
                    if (wasConnected) {
                        this.emit('disconnected', { code, reason: reason ? reason.toString() : '' });
                    }
                });
                this.ws.on('error', (err) => {
                    if (!this.isConnected) {
                        reject(err);
                    }
                    this.emit('error', err);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async send(method, params = {}) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            throw new Error('CDP WebSocket is not connected');
        }
        const id = this.messageId++;
        const message = JSON.stringify({ id, method, params });
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.ws.send(message, (err) => {
                if (err) {
                    this.pendingRequests.delete(id);
                    reject(err);
                }
            });
        });
    }
    disconnect() {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                this.ws.close();
            }
            catch { }
            this.ws = null;
        }
        this.cleanPendingRequests(new Error('Disconnected by client'));
        if (wasConnected) {
            this.emit('disconnected', { code: 1000, reason: 'Manual disconnect' });
        }
    }
    get connected() {
        return this.isConnected && this.ws?.readyState === ws_1.default.OPEN;
    }
    handleMessage(rawMessage) {
        try {
            const msg = JSON.parse(rawMessage);
            // Handle response to command
            if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
                const { resolve, reject } = this.pendingRequests.get(msg.id);
                this.pendingRequests.delete(msg.id);
                if (msg.error) {
                    reject(new Error(msg.error.message || 'CDP Error'));
                }
                else {
                    resolve(msg.result);
                }
                return;
            }
            // Handle event
            if (msg.method) {
                this.emit('event', { method: msg.method, params: msg.params });
                this.emit(msg.method, msg.params);
            }
        }
        catch { }
    }
    cleanPendingRequests(err) {
        for (const { reject } of this.pendingRequests.values()) {
            reject(err);
        }
        this.pendingRequests.clear();
    }
}
exports.CdpClient = CdpClient;
//# sourceMappingURL=cdpClient.js.map