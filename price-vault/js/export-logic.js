// インポートデータ検証の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.EXPORT_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // 1レコードが商品として必要なフィールドを持つか検証
    const isValidProduct = (rec) => {
        if (!rec || typeof rec !== 'object') return false;
        if (typeof rec.name === 'undefined') return false;
        if (!Array.isArray(rec.children)) return false;
        return true;
    };

    // インポートJSONを検証。products 配列を返す。無効なら null
    // 受け入れ形式: [{商品}, ...] または { products: [{商品}, ...] }
    const validateImportData = (data) => {
        if (!data) return null;
        const arr = Array.isArray(data) ? data : data.products;
        if (!Array.isArray(arr)) return null;
        if (!arr.every(isValidProduct)) return null;
        return arr;
    };

    const EXPORT_LOGIC = {
        validateImportData,
        isValidProduct
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
