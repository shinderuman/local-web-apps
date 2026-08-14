// JSON文字列の正規化・整形・結合の純粋関数
// ブラウザ: window.JSON_NORMALIZE_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    const compactRaw = (rawText) => {
        if (!rawText) return rawText;
        try {
            return JSON.stringify(JSON.parse(rawText));
        } catch {
            return rawText;
        }
    };

    const prettifyRaw = (rawText) => {
        if (!rawText) return rawText;
        try {
            return JSON.stringify(JSON.parse(rawText), null, 2);
        } catch {
            return rawText;
        }
    };

    const buildSmartJsonArray = (records) => {
        const parsed = [];
        for (const rec of records) {
            if (!rec || !rec.raw) continue;
            try {
                parsed.push(JSON.parse(rec.raw));
            } catch {}
        }
        if (parsed.length === 0) return null;
        return JSON.stringify(parsed, null, 2);
    };

    const JSON_NORMALIZE_LOGIC = {
        compactRaw,
        prettifyRaw,
        buildSmartJsonArray
    };

    factory(root, JSON_NORMALIZE_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.JSON_NORMALIZE_LOGIC = mod;
    }
});
