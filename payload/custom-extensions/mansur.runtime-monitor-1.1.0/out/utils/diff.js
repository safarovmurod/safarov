"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareJsonObjects = compareJsonObjects;
function compareJsonObjects(obj1, obj2, showUnchanged = false, basePath = '') {
    const results = [];
    // Primitives or different types
    if (typeof obj1 !== typeof obj2 || obj1 === null || obj2 === null || typeof obj1 !== 'object') {
        if (obj1 !== obj2) {
            return [{
                    path: basePath || 'root',
                    type: 'modified',
                    oldValue: obj1,
                    newValue: obj2
                }];
        }
        if (showUnchanged) {
            return [{
                    path: basePath || 'root',
                    type: 'unchanged',
                    oldValue: obj1,
                    newValue: obj2
                }];
        }
        return [];
    }
    // Arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        const maxLen = Math.max(obj1.length, obj2.length);
        for (let i = 0; i < maxLen; i++) {
            const currentPath = basePath ? `${basePath}[${i}]` : `[${i}]`;
            if (i >= obj1.length) {
                results.push({ path: currentPath, type: 'added', newValue: obj2[i] });
            }
            else if (i >= obj2.length) {
                results.push({ path: currentPath, type: 'removed', oldValue: obj1[i] });
            }
            else {
                const childDiff = compareJsonObjects(obj1[i], obj2[i], showUnchanged, currentPath);
                results.push(...childDiff);
            }
        }
        return results;
    }
    // Objects
    const allKeys = Array.from(new Set([...Object.keys(obj1), ...Object.keys(obj2)])).sort();
    for (const key of allKeys) {
        const currentPath = basePath ? `${basePath}.${key}` : key;
        const has1 = key in obj1;
        const has2 = key in obj2;
        if (has1 && !has2) {
            results.push({ path: currentPath, type: 'removed', oldValue: obj1[key] });
        }
        else if (!has1 && has2) {
            results.push({ path: currentPath, type: 'added', newValue: obj2[key] });
        }
        else {
            const v1 = obj1[key];
            const v2 = obj2[key];
            if (typeof v1 === 'object' && v1 !== null && typeof v2 === 'object' && v2 !== null) {
                const sub = compareJsonObjects(v1, v2, showUnchanged, currentPath);
                results.push(...sub);
            }
            else if (v1 !== v2) {
                results.push({ path: currentPath, type: 'modified', oldValue: v1, newValue: v2 });
            }
            else if (showUnchanged) {
                results.push({ path: currentPath, type: 'unchanged', oldValue: v1, newValue: v2 });
            }
        }
    }
    return results;
}
//# sourceMappingURL=diff.js.map