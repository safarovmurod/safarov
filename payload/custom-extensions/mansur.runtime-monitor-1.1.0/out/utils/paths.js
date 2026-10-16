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
exports.toPosix = toPosix;
exports.mapUrlToWorkspaceFile = mapUrlToWorkspaceFile;
exports.safeReadSourceLines = safeReadSourceLines;
exports.parseUrlDetails = parseUrlDetails;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function toPosix(p) {
    return p.replace(/\\/g, '/');
}
function mapUrlToWorkspaceFile(url, workspaceRoot, line = 1, col = 1) {
    if (!url || typeof url !== 'string')
        return undefined;
    let cleanUrl = url.trim();
    if (cleanUrl.startsWith('chrome-extension://') || cleanUrl.startsWith('devtools://')) {
        return undefined;
    }
    // Never match @vite/client or internal Vite dev files as workspace files
    if (cleanUrl.includes('@vite/client') || cleanUrl.includes('vite/dist/client')) {
        return undefined;
    }
    // Strip query string and hash
    cleanUrl = cleanUrl.split('?')[0].split('#')[0];
    // If file:// URL
    if (cleanUrl.startsWith('file:///')) {
        cleanUrl = cleanUrl.slice(8);
    }
    else if (cleanUrl.startsWith('file://')) {
        cleanUrl = cleanUrl.slice(7);
    }
    // If HTTP(S) URL
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        try {
            const parsed = new URL(cleanUrl);
            cleanUrl = parsed.pathname;
        }
        catch { }
    }
    // Handle Vite /@fs/ prefix: e.g. /@fs/D:/React-2_files/...
    if (cleanUrl.startsWith('/@fs/')) {
        cleanUrl = cleanUrl.slice(5);
    }
    // Check for :line:col at the end (e.g. src/App.tsx:4:18 or src/App.tsx:4)
    const locMatch = cleanUrl.match(/:(\d+)(?::(\d+))?$/);
    if (locMatch) {
        if (line === 1 || !line)
            line = parseInt(locMatch[1], 10);
        if ((col === 1 || !col) && locMatch[2])
            col = parseInt(locMatch[2], 10);
        cleanUrl = cleanUrl.slice(0, locMatch.index);
    }
    // Remove leading slash if followed by drive letter on Windows: e.g. /D:/... -> D:/...
    if (/^\/[a-zA-Z]:[\/]/.test(cleanUrl)) {
        cleanUrl = cleanUrl.slice(1);
    }
    // Check if cleanUrl is an absolute path (Windows drive letter e.g. D:/ or Unix /)
    if (/^[a-zA-Z]:[\\/]/.test(cleanUrl) || path.isAbsolute(cleanUrl)) {
        const normalized = path.normalize(cleanUrl);
        if (fs.existsSync(normalized) && !fs.statSync(normalized).isDirectory()) {
            return {
                relPath: toPosix(path.relative(workspaceRoot, normalized)),
                fullPath: normalized,
                line,
                col,
                fileName: path.basename(normalized)
            };
        }
    }
    // Strip leading slash for relative matching
    let relClean = cleanUrl.replace(/^[\\/]+/, '');
    // Candidate 1: directly under workspace
    const directPath = path.resolve(workspaceRoot, relClean);
    if (fs.existsSync(directPath) && !fs.statSync(directPath).isDirectory()) {
        return {
            relPath: toPosix(path.relative(workspaceRoot, directPath)),
            fullPath: directPath,
            line,
            col,
            fileName: path.basename(directPath)
        };
    }
    // Candidate 2: cleanUrl relative to src
    const srcPath = path.resolve(workspaceRoot, 'src', relClean);
    if (fs.existsSync(srcPath) && !fs.statSync(srcPath).isDirectory()) {
        return {
            relPath: toPosix(path.relative(workspaceRoot, srcPath)),
            fullPath: srcPath,
            line,
            col,
            fileName: path.basename(srcPath)
        };
    }
    // Candidate 3: by filename match in workspace
    const baseName = path.basename(relClean);
    if (baseName && baseName.includes('.') && !baseName.includes('node_modules')) {
        const match = findFileRecursive(workspaceRoot, baseName);
        if (match) {
            return {
                relPath: toPosix(path.relative(workspaceRoot, match)),
                fullPath: match,
                line,
                col,
                fileName: baseName
            };
        }
    }
    return undefined;
}
function findFileRecursive(dir, targetName, depth = 0) {
    if (depth > 6)
        return undefined;
    try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (['node_modules', 'dist', 'build', '.git'].includes(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = findFileRecursive(full, targetName, depth + 1);
                if (found)
                    return found;
            }
            else if (entry.name.toLowerCase() === targetName.toLowerCase()) {
                return full;
            }
        }
    }
    catch { }
    return undefined;
}
function safeReadSourceLines(fullPath, targetLine, targetCol = 1, contextLines = 1) {
    if (!fullPath || targetLine < 1)
        return undefined;
    try {
        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
            return undefined;
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        if (lines.length === 0 || targetLine > lines.length) {
            return undefined;
        }
        const startLine = Math.max(1, targetLine - contextLines);
        const endLine = Math.min(lines.length, targetLine + contextLines);
        const maxLineNumWidth = String(endLine).length;
        const output = [];
        for (let i = startLine; i <= endLine; i++) {
            const lineNumStr = String(i).padStart(maxLineNumWidth, ' ');
            const lineContent = lines[i - 1];
            output.push(`${lineNumStr} │ ${lineContent}`);
            if (i === targetLine && targetCol >= 1) {
                const indent = ' '.repeat(maxLineNumWidth);
                const colOffset = Math.max(0, targetCol - 1);
                const pointer = ' '.repeat(colOffset) + '^';
                output.push(`${indent} │ ${pointer}`);
            }
        }
        return output.join('\n');
    }
    catch {
        return undefined;
    }
}
function parseUrlDetails(rawUrl) {
    try {
        const u = new URL(rawUrl);
        const queryParams = {};
        u.searchParams.forEach((v, k) => {
            queryParams[k] = v;
        });
        let pathname = u.pathname;
        let name = path.basename(pathname) || pathname || '/';
        if (u.search) {
            name += u.search;
        }
        return {
            normalizedPath: u.pathname,
            name,
            domain: u.origin,
            queryParams
        };
    }
    catch {
        return {
            normalizedPath: rawUrl,
            name: rawUrl,
            domain: '',
            queryParams: {}
        };
    }
}
//# sourceMappingURL=paths.js.map