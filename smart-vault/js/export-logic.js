// 選択レコードの .json 出力用純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.EXPORT_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

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

    const EXPORT_LOGIC = {
        buildSmartJsonArray
    };

    factory(root, EXPORT_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.EXPORT_LOGIC = mod;
    }
});
