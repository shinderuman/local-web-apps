// カテゴリ抽出・件数カウントの純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.CATEGORY_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    // 商品配列から重複排除したカテゴリ名配列を返す（空文字・未分類は除外）
    const extractCategories = (products) => {
        const names = (products || [])
            .map((p) => p.category)
            .filter((c) => c && String(c).trim());
        return [...new Set(names.map((c) => String(c).trim()))];
    };

    // 指定カテゴリに紐づく商品数を返す（未分類カテゴリ名は空文字扱い）
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
