// 価格計算・ソート・バリデーションの純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.PRICE_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // 有効なprice（数値）を持つ履歴だけを返す
    const validHistories = (children) => {
        return (children || []).filter(c => !isNaN(Number(c.price)));
    };

    // 履歴から最安値/最高値のサマリを1走査で算出して返す
    // { min, max, minHistories, maxHistories, latestMinDate }
    const calcPriceSummary = (children) => {
        const valid = validHistories(children);
        if (valid.length === 0) {
            return { min: null, max: null, minHistories: [], maxHistories: [], latestMinDate: null };
        }
        let min = Infinity;
        let max = -Infinity;
        valid.forEach(c => {
            const p = Number(c.price);
            if (p < min) min = p;
            if (p > max) max = p;
        });
        const minHistories = valid.filter(c => Number(c.price) === min);
        const maxHistories = valid.filter(c => Number(c.price) === max);
        const minDates = minHistories.map(c => c.date).filter(Boolean);
        const latestMinDate = minDates.length === 0 ? null : minDates.sort().reverse()[0];
        return { min, max, minHistories, maxHistories, latestMinDate };
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

    // 商品へ履歴を追加した新しい商品オブジェクトを返す
    const appendProductHistory = (product, history) => {
        return { ...product, children: [...product.children, history] };
    };

    // 指定位置の履歴を除外した新しい商品オブジェクトを返す
    const removeProductHistory = (product, index) => {
        const children = [...product.children];
        children.splice(index, 1);
        return { ...product, children };
    };

    // 商品名と指定位置の履歴を更新した新しい商品オブジェクトを返す
    const updateProductHistory = (product, name, index, history) => {
        const children = [...product.children];
        children[index] = history;
        return { ...product, name: name || product.name, children };
    };

    // 指定位置へ移動し、表示順に合わせてsortOrderを振り直す
    const reorderProducts = (products, oldIndex, newIndex) => {
        const reordered = [...products];
        const moved = reordered.splice(oldIndex, 1)[0];
        reordered.splice(newIndex, 0, moved);
        return reordered.map((product, index) => ({ ...product, sortOrder: index }));
    };

    const PRICE_LOGIC = {
        calcPriceSummary,
        getAllStores,
        sortHistories,
        sortProducts,
        filterByCategory,
        isValidProductInput,
        isValidHistoryInput,
        buildNewProduct,
        buildNewHistory,
        appendProductHistory,
        removeProductHistory,
        updateProductHistory,
        reorderProducts
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
