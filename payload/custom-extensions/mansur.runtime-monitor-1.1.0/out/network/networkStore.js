"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkStore = void 0;
const paths_1 = require("../utils/paths");
class NetworkStore {
    requests = [];
    requestMap = new Map();
    pinnedMap = new Map();
    maxEntries;
    idCounter = 0;
    constructor(maxEntries = 2000) {
        this.maxEntries = maxEntries;
    }
    setMaxEntries(max) {
        this.maxEntries = max;
        this.trim();
    }
    /**
     * Handles requestWillBeSent event.
     * Rule 37 & 38: requestId is the primary key.
     * If a record for this requestId already exists (e.g. redirect or repeated notification),
     * update it rather than creating a duplicate row in the UI table.
     */
    handleRequestWillBeSent(params, generation) {
        const { requestId, request, timestamp, initiator, type } = params;
        const urlDetails = (0, paths_1.parseUrlDetails)(request.url);
        let existing = this.requestMap.get(requestId);
        if (existing) {
            existing.url = request.url;
            existing.method = (request.method || existing.method).toUpperCase();
            existing.requestHeaders = { ...existing.requestHeaders, ...(request.headers || {}) };
            if (request.postData)
                existing.postData = request.postData;
            existing.name = urlDetails.name;
            existing.domain = urlDetails.domain;
            existing.queryParams = urlDetails.queryParams;
            if (generation !== undefined)
                existing.generation = generation;
            return existing;
        }
        this.idCounter++;
        const req = {
            id: `net_${Date.now()}_${this.idCounter}_${Math.random().toString(36).substring(2, 6)}`,
            requestId,
            url: request.url,
            method: (request.method || 'GET').toUpperCase(),
            status: 0,
            statusText: 'Pending',
            resourceType: type || 'Fetch',
            startTime: timestamp,
            sizeBytes: 0,
            requestHeaders: request.headers || {},
            responseHeaders: {},
            postData: request.postData,
            failed: false,
            name: urlDetails.name,
            domain: urlDetails.domain,
            queryParams: urlDetails.queryParams,
            generation
        };
        if (initiator?.stack?.callFrames && initiator.stack.callFrames.length > 0) {
            const topFrame = initiator.stack.callFrames[0];
            req.initiator = {
                file: topFrame.url,
                line: topFrame.lineNumber + 1,
                col: topFrame.columnNumber + 1,
                raw: `${topFrame.url}:${topFrame.lineNumber + 1}`
            };
        }
        // Check duplicate requests in window (1500ms)
        this.checkDuplicates(req);
        this.requests.push(req);
        this.requestMap.set(requestId, req);
        this.trim();
        return req;
    }
    handleResponseReceived(params) {
        const { requestId, response, type } = params;
        const req = this.requestMap.get(requestId);
        if (!req)
            return undefined;
        req.status = response.status;
        req.statusText = response.statusText || String(response.status);
        req.responseHeaders = response.headers || {};
        req.mimeType = response.mimeType;
        if (type)
            req.resourceType = type;
        return req;
    }
    handleLoadingFinished(params) {
        const { requestId, timestamp, encodedDataLength } = params;
        const req = this.requestMap.get(requestId);
        if (!req)
            return undefined;
        req.endTime = timestamp;
        if (req.startTime && req.endTime) {
            req.durationMs = Math.round((req.endTime - req.startTime) * 1000);
        }
        if (encodedDataLength !== undefined && encodedDataLength >= 0) {
            req.sizeBytes = encodedDataLength;
        }
        return req;
    }
    handleLoadingFailed(params) {
        const { requestId, errorText, canceled } = params;
        const req = this.requestMap.get(requestId);
        if (!req)
            return undefined;
        req.failed = true;
        req.errorText = canceled ? 'Canceled' : (errorText || 'Failed');
        if (!req.status)
            req.status = 0;
        return req;
    }
    setResponseBody(requestId, body, isBase64 = false) {
        const req = this.requestMap.get(requestId);
        if (req) {
            req.responseBody = body;
            req.responseBodyBase64 = isBase64;
        }
    }
    getByCdpRequestId(requestId) {
        return this.requestMap.get(requestId);
    }
    getById(id) {
        return this.requests.find(r => r.id === id);
    }
    togglePin(id) {
        const req = this.requests.find(r => r.id === id) || this.pinnedMap.get(id);
        if (!req)
            return false;
        req.pinned = !req.pinned;
        if (req.pinned) {
            this.pinnedMap.set(req.id, req);
        }
        else {
            this.pinnedMap.delete(req.id);
        }
        return req.pinned;
    }
    clear(preserveLog = false) {
        if (preserveLog)
            return;
        this.requests = [];
        this.requestMap.clear();
        this.pinnedMap.clear();
    }
    getRequests() {
        return this.requests;
    }
    getPinned() {
        return Array.from(this.pinnedMap.values());
    }
    getSummary() {
        let failed = 0;
        let totalBytes = 0;
        let totalDuration = 0;
        let finishedCount = 0;
        for (const r of this.requests) {
            if (r.failed || r.status >= 400)
                failed++;
            totalBytes += r.sizeBytes || 0;
            if (r.durationMs !== undefined) {
                totalDuration += r.durationMs;
                finishedCount++;
            }
        }
        const avgTimeMs = finishedCount > 0 ? Math.round(totalDuration / finishedCount) : 0;
        return {
            count: this.requests.length,
            failed,
            totalBytes,
            avgTimeMs
        };
    }
    checkDuplicates(newReq, windowMs = 1500) {
        const newNormUrl = newReq.url.split('?')[0];
        for (let i = this.requests.length - 1; i >= 0; i--) {
            const prev = this.requests[i];
            const timeDiff = Math.abs((newReq.startTime - prev.startTime) * 1000);
            if (timeDiff > windowMs)
                break;
            if (prev.method === newReq.method && prev.url.split('?')[0] === newNormUrl) {
                newReq.isDuplicate = true;
                newReq.duplicateCount = (prev.duplicateCount || 1) + 1;
                newReq.duplicateIntervalMs = Math.round(timeDiff);
                prev.isDuplicate = true;
                break;
            }
        }
    }
    trim() {
        if (this.requests.length > this.maxEntries) {
            const removed = this.requests.splice(0, this.requests.length - this.maxEntries);
            for (const r of removed) {
                this.requestMap.delete(r.requestId);
            }
        }
    }
}
exports.NetworkStore = NetworkStore;
//# sourceMappingURL=networkStore.js.map