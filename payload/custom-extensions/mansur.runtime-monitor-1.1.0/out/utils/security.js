"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskHeaders = maskHeaders;
exports.maskPayload = maskPayload;
exports.generateCurlCommand = generateCurlCommand;
const SENSITIVE_HEADERS = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'proxy-authorization',
    'x-api-key',
    'api-key'
]);
const SENSITIVE_FIELD_REGEX = /(password|token|accesstoken|refreshtoken|secret|apikey|credential)/i;
function maskHeaders(headers, showSensitive) {
    if (showSensitive)
        return { ...headers };
    const masked = {};
    for (const [k, v] of Object.entries(headers)) {
        if (SENSITIVE_HEADERS.has(k.toLowerCase())) {
            masked[k] = '••••••••';
        }
        else {
            masked[k] = v;
        }
    }
    return masked;
}
function maskPayload(data, showSensitive) {
    if (showSensitive || !data)
        return data;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return JSON.stringify(maskPayload(parsed, showSensitive), null, 2);
        }
        catch {
            return data;
        }
    }
    if (Array.isArray(data)) {
        return data.map(item => maskPayload(item, showSensitive));
    }
    if (typeof data === 'object') {
        const masked = {};
        for (const [k, v] of Object.entries(data)) {
            if (SENSITIVE_FIELD_REGEX.test(k) && typeof v === 'string') {
                masked[k] = '••••••••';
            }
            else if (typeof v === 'object' && v !== null) {
                masked[k] = maskPayload(v, showSensitive);
            }
            else {
                masked[k] = v;
            }
        }
        return masked;
    }
    return data;
}
function generateCurlCommand(method, url, headers, postData) {
    const parts = [`curl -X ${method} '${url}'`];
    for (const [k, v] of Object.entries(headers)) {
        if (SENSITIVE_HEADERS.has(k.toLowerCase()))
            continue;
        parts.push(`-H '${k}: ${v}'`);
    }
    if (postData && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        const escaped = postData.replace(/'/g, "'\\''");
        parts.push(`--data-raw '${escaped}'`);
    }
    return parts.join(' \\\n  ');
}
//# sourceMappingURL=security.js.map