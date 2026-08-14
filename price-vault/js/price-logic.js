// 価格計算・ソート・バリデーションの純粋関数
// ブラウザ: window.PRICE_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    const validHistories = (children) => {
        return (children || []).filter((c) => !isNaN(Number(c.price)));
    };

    const calcPriceSummary = (children) => {
        const valid = validHistories(children);
        if (valid.length === 0) {
            return {
                min: null,
                max: null,
                minHistories: [],
                maxHistories: [],
                latestMinDate: null
            };
        }
        let min = Infinity;
        let max = -Infinity;
        valid.forEach((c) => {
            const p = Number(c.price);
            if (p < min) min = p;
            if (p > max) max = p;
        });
        const minHistories = valid.filter((c) => Number(c.price) === min);
        const maxHistories = valid.filter((c) => Number(c.price) === max);
        const minDates = minHistories.map((c) => c.date).filter(Boolean);
        const latestMinDate =
            minDates.length === 0 ? null : minDates.sort().reverse()[0];
        return { min, max, minHistories, maxHistories, latestMinDate };
    };

    const getAllStores = (children) => {
        const stores = (children || [])
            .map((c) => c.store)
            .filter((s) => s && String(s).trim());
        return [...new Set(stores.map((s) => String(s).trim()))];
    };

    const sortHistories = (children) => {
        return [...(children || [])].sort((a, b) => {
            return String(b.date).localeCompare(String(a.date));
        });
    };

    const sortProducts = (products, sortKey) => {
        const sorted = [...(products || [])];
        if (sortKey === 'name') {
            sorted.sort((a, b) =>
                String(a.name).localeCompare(String(b.name), 'ja')
            );
        } else if (sortKey === 'createdAt') {
            sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        }
        return sorted;
    };

    const filterByCategory = (products, category) => {
        if (category === null || category === undefined || category === 'all') {
            return [...(products || [])];
        }
        return (products || []).filter((p) => p.category === category);
    };

    const isValidProductInput = (name) => {
        return !!(name && String(name).trim());
    };

    const isValidHistoryInput = (price, date) => {
        const priceNum = Number(price);
        if (isNaN(priceNum)) return false;
        return !!(date && String(date).trim());
    };

    const buildNewProduct = (data, createdAt) => {
        return {
            name: data.name,
            category: data.category,
            sortOrder: data.sortOrder,
            createdAt: createdAt,
            children: data.children
        };
    };

    const buildNewHistory = (data) => {
        return {
            price: Number(data.price),
            store: data.store,
            unitPrice: data.unitPrice,
            date: data.date,
            memo: data.memo || ''
        };
    };

    const appendProductHistory = (product, history) => {
        return { ...product, children: [...product.children, history] };
    };

    const removeProductHistory = (product, index) => {
        const children = [...product.children];
        children.splice(index, 1);
        return { ...product, children };
    };

    const updateProductHistory = (product, name, index, history) => {
        const children = [...product.children];
        children[index] = history;
        return { ...product, name: name || product.name, children };
    };

    const reorderProducts = (products, oldIndex, newIndex) => {
        const reordered = [...products];
        const moved = reordered.splice(oldIndex, 1)[0];
        reordered.splice(newIndex, 0, moved);
        return reordered.map((product, index) => ({
            ...product,
            sortOrder: index
        }));
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
