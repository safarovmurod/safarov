"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIgnoredOrViteServiceMessage = void 0;
exports.stripAnsi = stripAnsi;
exports.isViteServiceMessage = isViteServiceMessage;
exports.parseViteErrorPayload = parseViteErrorPayload;
exports.parseErrorText = parseErrorText;
exports.isInternalViteFrame = isInternalViteFrame;
const paths_1 = require("../utils/paths");
function stripAnsi(str) {
    if (!str || typeof str !== 'string')
        return '';
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}
function isViteServiceMessage(text) {
    if (!text)
        return false;
    const clean = stripAnsi(text).trim();
    // React DevTools recommendations
    if (clean.includes('Download the React DevTools') || clean.includes('reactjs.org/link/react-devtools')) {
        return true;
    }
    // 1. Standard Vite service logs
    if (clean === '[vite] connected.' || clean.startsWith('[vite] connected')) {
        return true;
    }
    if (clean === '[vite] connecting...' || clean.startsWith('[vite] connecting')) {
        return true;
    }
    if (clean.startsWith('[vite] hot updated') || clean.startsWith('[vite] css hot updated')) {
        return true;
    }
    if (clean.startsWith('[vite] invalidate')) {
        return true;
    }
    if (clean.startsWith('[vite] server connection lost')) {
        return true;
    }
    // 2. Generic [vite] service logs without real error keywords
    if (clean.startsWith('[vite]')) {
        const lower = clean.toLowerCase();
        const hasErrorKeyword = lower.includes('error') ||
            lower.includes('failed') ||
            lower.includes('exception') ||
            lower.includes('plugin:') ||
            lower.includes('syntax') ||
            lower.includes('transform');
        if (!hasErrorKeyword) {
            return true;
        }
    }
    // 3. Browser-level WebSocket lifecycle errors during Vite disconnect / reload
    if (clean.includes("WebSocket connection to 'ws://localhost") || clean.includes("WebSocket connection to 'ws://127.0.0.1")) {
        if (clean.includes('failed') || clean.includes('closed')) {
            return true;
        }
    }
    return false;
}
exports.isIgnoredOrViteServiceMessage = isViteServiceMessage;
function parseViteErrorPayload(err, workspaceRoot) {
    const rawMessage = typeof err.message === 'string' ? err.message : JSON.stringify(err);
    const cleanRaw = stripAnsi(rawMessage);
    // Plugin
    let plugin = err.plugin || '';
    if (!plugin) {
        const pMatch = cleanRaw.match(/\[plugin:([^\]]+)\]/i) || cleanRaw.match(/Plugin:\s*([\w:-]+)/i);
        if (pMatch)
            plugin = pMatch[1].trim();
    }
    // Error Code
    let errorCode = err.pluginCode || '';
    if (!errorCode) {
        const cMatch = cleanRaw.match(/\[([A-Z0-9_]+_ERROR|[A-Z0-9_]{3,})\]/) ||
            cleanRaw.match(/\b(PARSE_ERROR|SYNTAX_ERROR|UNRESOLVED_IMPORT|SyntaxError|TypeError|ReferenceError)\b/);
        if (cMatch)
            errorCode = cMatch[1].trim();
    }
    // Title
    let title = 'Transform failed';
    if (cleanRaw.includes('Transform failed')) {
        title = 'Transform failed';
    }
    else if (cleanRaw.includes('Failed to resolve import') || cleanRaw.includes('Cannot find module')) {
        title = 'Failed to resolve import';
    }
    else if (errorCode === 'PARSE_ERROR' || cleanRaw.includes('Parse Error') || cleanRaw.includes('PARSE_ERROR')) {
        title = 'Parse Error';
    }
    else if (errorCode === 'SYNTAX_ERROR' || cleanRaw.includes('Syntax Error') || cleanRaw.includes('SyntaxError')) {
        title = 'Syntax Error';
    }
    else if (errorCode) {
        title = errorCode.replace(/_/g, ' ');
    }
    // Location detection
    let targetUrl = '';
    let line = 1;
    let column = 1;
    if (err.loc && typeof err.loc === 'object') {
        targetUrl = err.loc.file || err.id || '';
        line = Number(err.loc.line) || 1;
        column = Number(err.loc.column) || 1;
    }
    else if (err.id) {
        targetUrl = err.id;
    }
    if (!targetUrl || line === 1) {
        const locMatch = cleanRaw.match(/([a-zA-Z]:[\\/][^\s\r\n:]+\.[a-zA-Z0-9]+):(\d+):(\d+)/) ||
            cleanRaw.match(/([a-zA-Z0-9_./\\-]+\.(?:tsx|ts|jsx|js|css|html|json|vue|svelte)):(\d+):(\d+)/);
        if (locMatch) {
            if (!targetUrl)
                targetUrl = locMatch[1];
            line = parseInt(locMatch[2], 10);
            column = parseInt(locMatch[3], 10);
        }
        else {
            const parenMatch = cleanRaw.match(/([a-zA-Z]:[\\/][^\s\r\n:]+\.[a-zA-Z0-9]+)[^()\r\n]*\((\d+):(\d+)\)/) ||
                cleanRaw.match(/([a-zA-Z0-9_./\\-]+\.(?:tsx|ts|jsx|js|css|html|json|vue|svelte))[^()\r\n]*\((\d+):(\d+)\)/);
            if (parenMatch) {
                if (!targetUrl)
                    targetUrl = parenMatch[1];
                line = parseInt(parenMatch[2], 10);
                column = parseInt(parenMatch[3], 10);
            }
        }
    }
    // Clean message extraction
    let cleanMessage = cleanRaw;
    cleanMessage = cleanMessage.replace(/\[plugin:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/Transform failed with \d+ error[s]?:?\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[[A-Z0-9_]+\]\s*/g, '');
    cleanMessage = cleanMessage.replace(/^(?:in\s+|at\s+|File:\s*)?[a-zA-Z0-9_.:/\\-]+\.(?:tsx|ts|jsx|js|css|html|json):\d+:\d+:?\s*/gm, '');
    cleanMessage = cleanMessage.replace(/^\s*\d+\s*[|│].*$/gm, '');
    cleanMessage = cleanMessage.replace(/^\s*[|│]?\s*\^.*$/gm, '');
    cleanMessage = cleanMessage.replace(/^Uncaught\s+/i, '');
    cleanMessage = cleanMessage.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
    if (!cleanMessage) {
        cleanMessage = errorCode || title;
    }
    // Resolve file in workspace
    let filePath;
    let fullPath;
    if (targetUrl) {
        const resolved = (0, paths_1.mapUrlToWorkspaceFile)(targetUrl, workspaceRoot, line, column);
        if (resolved) {
            filePath = resolved.relPath;
            fullPath = resolved.fullPath;
            line = resolved.line;
            column = resolved.col;
        }
        else {
            filePath = targetUrl;
        }
    }
    // Code Frame
    let codeFrame;
    if (err.frame && typeof err.frame === 'string') {
        codeFrame = normalizeCodeFrame(stripAnsi(err.frame));
    }
    else if (fullPath && line > 0) {
        codeFrame = (0, paths_1.safeReadSourceLines)(fullPath, line, column, 1);
    }
    // Stacks separation
    const clientStack = [];
    const browserStack = [];
    if (typeof err.stack === 'string') {
        const stackLines = stripAnsi(err.stack).split('\n');
        for (const rawLine of stackLines) {
            const trimmed = rawLine.trim();
            if (!trimmed)
                continue;
            if (isInternalViteFrame(trimmed)) {
                clientStack.push(trimmed);
            }
            else {
                browserStack.push(trimmed);
            }
        }
    }
    return {
        title,
        errorCode: errorCode || undefined,
        cleanMessage,
        filePath,
        fullPath,
        line,
        column,
        codeFrame,
        plugin: plugin || undefined,
        rawMessage,
        clientStack: clientStack.length > 0 ? clientStack : undefined,
        browserStack: browserStack.length > 0 ? browserStack : undefined,
        originalUrl: targetUrl || undefined
    };
}
function parseErrorText(rawText, workspaceRoot, callFrames) {
    if (!rawText)
        return undefined;
    if (isViteServiceMessage(rawText)) {
        return undefined; // Strictly NOT an error!
    }
    const text = stripAnsi(rawText);
    // Check if this text has error patterns
    const isViteTransform = text.includes('[plugin:vite') || text.includes('Transform failed') || text.includes('[PARSE_ERROR]');
    const isSyntax = text.includes('SyntaxError') || text.includes('Parse Error') || text.includes('PARSE_ERROR') || text.includes('Syntax error');
    const isImport = text.includes('Failed to resolve import') || text.includes('Cannot find module');
    const isRuntimeError = text.includes('Uncaught') || text.includes('TypeError:') || text.includes('ReferenceError:') || text.includes('Error:') || text.includes('Internal server error');
    if (!isViteTransform && !isSyntax && !isImport && !isRuntimeError) {
        if (!callFrames || callFrames.length === 0) {
            return undefined;
        }
        // If all call frames are internal vite frames or node_modules, do NOT treat as project error
        const hasAppFrame = callFrames.some(f => f.url && !isInternalViteFrame(f.url) && !f.url.includes('node_modules'));
        if (!hasAppFrame) {
            return undefined;
        }
    }
    // Plugin
    let plugin;
    const pMatch = text.match(/\[plugin:([^\]]+)\]/i) || text.match(/Plugin:\s*([\w:-]+)/i);
    if (pMatch)
        plugin = pMatch[1].trim();
    // Error Code
    let errorCode;
    const cMatch = text.match(/\[([A-Z0-9_]+_ERROR|[A-Z0-9_]{3,})\]/) ||
        text.match(/\b(PARSE_ERROR|SYNTAX_ERROR|UNRESOLVED_IMPORT|SyntaxError|TypeError|ReferenceError)\b/);
    if (cMatch)
        errorCode = cMatch[1].trim();
    // Title
    let title = 'Error';
    if (text.includes('Transform failed')) {
        title = 'Transform failed';
    }
    else if (errorCode === 'PARSE_ERROR' || text.includes('Parse Error')) {
        title = 'Parse Error';
    }
    else if (errorCode === 'SYNTAX_ERROR' || text.includes('SyntaxError') || text.includes('Syntax Error')) {
        title = 'Syntax Error';
    }
    else if (text.includes('Failed to resolve import') || text.includes('Cannot find module')) {
        title = 'Failed to resolve import';
    }
    else if (text.includes('Uncaught TypeError') || text.includes('TypeError:')) {
        title = 'TypeError';
    }
    else if (text.includes('Uncaught ReferenceError') || text.includes('ReferenceError:')) {
        title = 'ReferenceError';
    }
    else if (text.includes('Uncaught')) {
        title = 'Runtime Exception';
    }
    else if (errorCode) {
        title = errorCode.replace(/_/g, ' ');
    }
    // Location finding
    let targetUrl = '';
    let line = 1;
    let column = 1;
    // 1. Try regex on text for file:line:col
    const locMatch = text.match(/([a-zA-Z]:[\\/][^\s\r\n:]+\.[a-zA-Z0-9]+):(\d+):(\d+)/) ||
        text.match(/([a-zA-Z0-9_./\\-]+\.(?:tsx|ts|jsx|js|css|html|json|vue|svelte)):(\d+):(\d+)/);
    if (locMatch) {
        targetUrl = locMatch[1];
        line = parseInt(locMatch[2], 10);
        column = parseInt(locMatch[3], 10);
    }
    else {
        const parenMatch = text.match(/([a-zA-Z]:[\\/][^\s\r\n:]+\.[a-zA-Z0-9]+)[^()\r\n]*\((\d+):(\d+)\)/) ||
            text.match(/([a-zA-Z0-9_./\\-]+\.(?:tsx|ts|jsx|js|css|html|json|vue|svelte))[^()\r\n]*\((\d+):(\d+)\)/);
        if (parenMatch) {
            targetUrl = parenMatch[1];
            line = parseInt(parenMatch[2], 10);
            column = parseInt(parenMatch[3], 10);
        }
    }
    // 2. If not found in text, look in callFrames (skipping @vite/client and node_modules)
    if (!targetUrl && callFrames && callFrames.length > 0) {
        for (const f of callFrames) {
            if (f.url && !isInternalViteFrame(f.url) && !f.url.includes('node_modules')) {
                targetUrl = f.url;
                line = (f.lineNumber !== undefined ? f.lineNumber + 1 : 1);
                column = (f.columnNumber !== undefined ? f.columnNumber + 1 : 1);
                break;
            }
        }
    }
    // Clean message
    let cleanMessage = text;
    cleanMessage = cleanMessage.replace(/\[plugin:[^\]]+\]\s*/gi, '');
    cleanMessage = cleanMessage.replace(/Transform failed with \d+ error[s]?:?\s*/gi, '');
    cleanMessage = cleanMessage.replace(/\[[A-Z0-9_]+\]\s*/g, '');
    cleanMessage = cleanMessage.replace(/^(?:in\s+|at\s+|File:\s*)?[a-zA-Z0-9_.:/\\-]+\.(?:tsx|ts|jsx|js|css|html|json):\d+:\d+:?\s*/gm, '');
    cleanMessage = cleanMessage.replace(/^\s*\d+\s*[|│].*$/gm, '');
    cleanMessage = cleanMessage.replace(/^\s*[|│]?\s*\^.*$/gm, '');
    cleanMessage = cleanMessage.replace(/^Uncaught\s+/i, '');
    cleanMessage = cleanMessage.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
    if (!cleanMessage) {
        cleanMessage = errorCode || title;
    }
    // Resolve file in workspace
    let filePath;
    let fullPath;
    if (targetUrl) {
        const resolved = (0, paths_1.mapUrlToWorkspaceFile)(targetUrl, workspaceRoot, line, column);
        if (resolved) {
            filePath = resolved.relPath;
            fullPath = resolved.fullPath;
            line = resolved.line;
            column = resolved.col;
        }
        else {
            filePath = targetUrl;
        }
    }
    // Code Frame extraction from text
    let codeFrame;
    const frameLines = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^\s*\d+\s*[|│]/.test(l) || /^\s*[|│]?\s*\^/.test(l)) {
            frameLines.push(l);
        }
    }
    if (frameLines.length > 0) {
        codeFrame = normalizeCodeFrame(frameLines.join('\n'));
    }
    else if (fullPath && line > 0) {
        codeFrame = (0, paths_1.safeReadSourceLines)(fullPath, line, column, 1);
    }
    // Stack separation
    const clientStack = [];
    const browserStack = [];
    if (callFrames && callFrames.length > 0) {
        for (const f of callFrames) {
            const frameStr = `at ${f.functionName || '<anonymous>'} (${f.url}:${(f.lineNumber || 0) + 1}:${(f.columnNumber || 0) + 1})`;
            if (isInternalViteFrame(f.url || '')) {
                clientStack.push(frameStr);
            }
            else {
                browserStack.push(frameStr);
            }
        }
    }
    return {
        title,
        errorCode: errorCode || undefined,
        cleanMessage,
        filePath,
        fullPath,
        line: line > 0 ? line : undefined,
        column: column > 0 ? column : undefined,
        codeFrame,
        plugin,
        rawMessage: rawText,
        clientStack: clientStack.length > 0 ? clientStack : undefined,
        browserStack: browserStack.length > 0 ? browserStack : undefined,
        originalUrl: targetUrl || undefined
    };
}
function normalizeCodeFrame(frame) {
    return frame
        .split('\n')
        .map(line => {
        return line.replace(/^(\s*\d+)?\s*\|/, (_, num) => {
            return num ? `${num} │` : '  │';
        });
    })
        .join('\n');
}
function isInternalViteFrame(str) {
    if (!str)
        return false;
    return str.includes('@vite/client') ||
        str.includes('vite/dist/client') ||
        str.includes('handleMessage') ||
        str.includes('dequeue') ||
        str.includes('enqueue') ||
        str.includes('createErrorOverlay') ||
        (str.includes('WebSocket') && str.includes('client'));
}
//# sourceMappingURL=errorParser.js.map