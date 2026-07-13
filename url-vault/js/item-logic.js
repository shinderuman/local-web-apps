// アイテム関連の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.ITEM_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // 先頭追加時は0、末尾追加時は既存の最大sortOrder+1を返す
    const calcNextSortOrder = (items, addPositionTop) => {
        if (addPositionTop || items.length === 0) return 0;
        return Math.max(...items.map(item => item.sortOrder ?? 0)) + 1;
    };

    // 先頭追加時に既存アイテムのsortOrderを+1した新しい配列を返す（非破壊）
    const shiftSortOrders = (items) => {
        return items.map(item => ({
            ...item,
            sortOrder: (item.sortOrder || 0) + 1
        }));
    };

    // 新規アイテムオブジェクトを構築
    const buildNewItem = (data, createdAt) => {
        return {
            windowId: data.windowId,
            groupId: data.groupId,
            title: data.title,
            url: data.url,
            image: data.image,
            sortOrder: data.sortOrder,
            createdAt: createdAt
        };
    };

    // アイテム配列をソート（非破壊）
    const sortItems = (items, sortKey, asc) => {
        const sorted = [...items];
        if (sortKey === 'sortOrder') {
            sorted.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        } else if (sortKey === 'title') {
            sorted.sort((a, b) => asc ? a.title.localeCompare(b.title, 'ja') : b.title.localeCompare(a.title, 'ja'));
        } else if (sortKey === 'createdAt') {
            sorted.sort((a, b) => asc ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
        }
        return sorted;
    };

    // アイテム入力値のバリデーション
    const isValidItemInput = (windowId, groupId, title, url) => {
        if (!windowId || !groupId || !title || !url) return false;
        if (isNaN(parseInt(windowId)) || isNaN(parseInt(groupId))) return false;
        return true;
    };

    // エクスポート時にsynopsisフィールドを除外したコピーを返す（非破壊）
    const stripSynopsisForExport = (item) => {
        const rest = { ...item };
        delete rest.synopsis;
        return rest;
    };

    const ITEM_LOGIC = {
        calcNextSortOrder,
        shiftSortOrders,
        buildNewItem,
        sortItems,
        isValidItemInput,
        stripSynopsisForExport
    };

    factory(root, ITEM_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.ITEM_LOGIC = mod;
    }
});
