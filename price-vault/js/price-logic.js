// 価格計算・ソート・バリデーションの純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.PRICE_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // 履歴配列から最安値（最小price）を返す。空配列は null
    const calcMinPrice = (children) => {
        const prices = (children || []).map(c => Number(c.price)).filter(p => !isNaN(p));
        if (prices.length === 0) return null;
        return Math.min(...prices);
    };

    // 履歴配列から最高値（最大price）を返す。空配列は null
    const calcMaxPrice = (children) => {
        const prices = (children || []).map(c => Number(c.price)).filter(p => !isNaN(p));
        if (prices.length === 0) return null;
        return Math.max(...prices);
    };

    // 履歴配列から重複排除した店名配列を返す（空文字除外）
    const getAllStores = (children) => {
        const stores = (children || [])
            .map(c => c.store)
            .filter(s => s && String(s).trim());
        return [...new Set(stores.map(s => String(s).trim()))];
    };

    // 履歴を日付降順（最新が先頭）でソートした新配列を返す（非破壊）
    const sortHistories = (children) => {
        return [...(children || [])].sort((a, b) => {
            return String(b.date).localeCompare(String(a.date));
        });
    };

    // 商品配列をソートした新配列を返す（非破壊）
    // sortKey: 'name'=商品名順 / 'createdAt'=登録順
    const sortProducts = (products, sortKey) => {
        const sorted = [...(products || [])];
        if (sortKey === 'name') {
            sorted.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'));
        } else if (sortKey === 'createdAt') {
            sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        }
        return sorted;
    };

    // カテゴリでフィルタ。category が null/undefined/'all' なら全件
    const filterByCategory = (products, category) => {
        if (category === null || category === undefined || category === 'all') {
            return [...(products || [])];
        }
        return (products || []).filter(p => p.category === category);
    };

    // 商品名の必須チェック（trim後空でなければ有効）
    const isValidProductInput = (name) => {
        return !!(name && String(name).trim());
    };

    // 履歴の必須チェック（値段が数値、日付が空でない）
    const isValidHistoryInput = (price, date) => {
        const priceNum = Number(price);
        if (isNaN(priceNum)) return false;
        return !!(date && String(date).trim());
    };

    // 新規商品オブジェクトを構築（createdAt は引数注入）
    const buildNewProduct = (data, createdAt) => {
        return {
            name: data.name,
            category: data.category,
            sortOrder: data.sortOrder,
            createdAt: createdAt,
            children: data.children
        };
    };

    // 新規履歴オブジェクトを構築
    const buildNewHistory = (data) => {
        return {
            price: Number(data.price),
            store: data.store,
            unitPrice: data.unitPrice,
            date: data.date,
            memo: data.memo || ''
        };
    };

    const PRICE_LOGIC = {
        calcMinPrice,
        calcMaxPrice,
        getAllStores,
        sortHistories,
        sortProducts,
        filterByCategory,
        isValidProductInput,
        isValidHistoryInput,
        buildNewProduct,
        buildNewHistory
    };

    factory(root, PRICE_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.PRICE_LOGIC = mod;
    }
});
