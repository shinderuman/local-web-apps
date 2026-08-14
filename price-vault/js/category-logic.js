// カテゴリ抽出・件数カウントの純粋関数
// ブラウザ: window.CATEGORY_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    const extractCategories = (products) => {
        const names = (products || [])
            .map((p) => p.category)
            .filter((c) => c && String(c).trim());
        return [...new Set(names.map((c) => String(c).trim()))];
    };

    const countProductsByCategory = (products, categoryName) => {
        return (products || []).filter((p) => p.category === categoryName)
            .length;
    };

    const CATEGORY_LOGIC = {
        extractCategories,
        countProductsByCategory
    };

    factory(root, CATEGORY_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.CATEGORY_LOGIC = mod;
    }
});
