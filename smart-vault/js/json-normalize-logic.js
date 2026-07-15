// JSON文字列の正規化・整形・結合の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.JSON_NORMALIZE_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    // JSON文字列をcompact化（インデント・空白を除去）。不正JSONや空文字列は入力をそのまま返す
    const compactRaw = (rawText) => {
        if (!rawText) return rawText;
        try {
            return JSON.stringify(JSON.parse(rawText));
        } catch {
            return rawText;
        }
    };

    // JSON文字列をインデント付きで整形。不正JSONや空文字列は入力をそのまま返す
    const prettifyRaw = (rawText) => {
        if (!rawText) return rawText;
        try {
            return JSON.stringify(JSON.parse(rawText), null, 2);
        } catch {
            return rawText;
        }
    };

    // 渡されたレコードの raw（生JSON文字列）をJSON配列1ファイルに結合して返す
    // raw が空のレコード（手動登録等）は除外。有効レコード0件なら null を返す
    const buildSmartJsonArray = (records) => {
        const parsed = [];
        for (const rec of records) {
            if (!rec || !rec.raw) continue;
            try {
                parsed.push(JSON.parse(rec.raw));
            } catch {
                // 不正JSONはスキップ
            }
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
