"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleStore = void 0;
class ConsoleStore {
    entries = [];
    pinnedEntries = new Map();
    currentGroupLevel = 0;
    maxEntries;
    idCounter = 0;
    constructor(maxEntries = 5000) {
        this.maxEntries = maxEntries;
    }
    setMaxEntries(max) {
        this.maxEntries = max;
        this.trim();
    }
    /**
     * Adds an entry.
     * Rule 62 & 63 & 71: 1 real CDP event = 1 entry.
     * Do NOT aggressively collapse real duplicate logs or StrictMode renders.
     */
    add(entry) {
        if (entry.type === 'startGroup' || entry.type === 'startGroupCollapsed') {
            this.currentGroupLevel++;
        }
        else if (entry.type === 'endGroup') {
            if (this.currentGroupLevel > 0)
                this.currentGroupLevel--;
        }
        this.idCounter++;
        const fullEntry = {
            ...entry,
            id: `c_${Date.now()}_${this.idCounter}_${Math.random().toString(36).substring(2, 6)}`,
            groupLevel: this.currentGroupLevel
        };
        this.entries.push(fullEntry);
        this.trim();
        return fullEntry;
    }
    togglePin(id) {
        const entry = this.entries.find(e => e.id === id) || this.pinnedEntries.get(id);
        if (!entry)
            return false;
        entry.pinned = !entry.pinned;
        if (entry.pinned) {
            this.pinnedEntries.set(entry.id, entry);
        }
        else {
            this.pinnedEntries.delete(entry.id);
        }
        return entry.pinned;
    }
    clear(preserveLog = false) {
        if (preserveLog)
            return;
        this.entries = [];
        this.pinnedEntries.clear();
        this.currentGroupLevel = 0;
    }
    getEntries() {
        return this.entries;
    }
    getPinned() {
        return Array.from(this.pinnedEntries.values());
    }
    getCounts() {
        let errors = 0;
        let warnings = 0;
        for (const e of this.entries) {
            if (e.type === 'error')
                errors++;
            else if (e.type === 'warning')
                warnings++;
        }
        return { errors, warnings, total: this.entries.length };
    }
    trim() {
        if (this.entries.length > this.maxEntries) {
            this.entries.splice(0, this.entries.length - this.maxEntries);
        }
    }
}
exports.ConsoleStore = ConsoleStore;
//# sourceMappingURL=consoleStore.js.map