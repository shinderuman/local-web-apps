// フィルタ・ゴミ箱判定の純粋関数（ブラウザ/Node両方で利用）

const KINDLE_URL_PATTERN = /^https?:\/\/read\.amazon\.co\.jp\//;

((root, factory) => {

    // Kindleドメイン判定
    const isKindleUrl = (url) => KINDLE_URL_PATTERN.test(url);

    // あらすじが有効（配列で1件以上）か判定。壊れたデータは未取得扱い
    const hasSynopsis = (item) => Array.isArray(item.synopsis) && item.synopsis.length > 0;

    // ゴミ箱選択か判定
    const isTrashSelected = (windowId, trashWindowId) => windowId === trashWindowId;

    // 現在のフィルタ条件に一致するアイテムを抽出
    // ゴミ箱選択時のみゴミ箱を表示。それ以外はゴミ箱を除外
    const filterVisibleItems = (allItems, windowId, groupId, searchQuery, trashWindowId) => {
        let items = allItems;
        if (windowId === trashWindowId) {
            items = items.filter(item => item.windowId === trashWindowId);
        } else {
            items = items.filter(item => item.windowId !== trashWindowId);
            if (windowId !== null) {
                items = items.filter(item => item.windowId === windowId);
            }
        }
        if (groupId !== null) {
            items = items.filter(item => item.groupId === groupId);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(item => item.title.toLowerCase().includes(q));
        }
        return items;
    };

    // ウィンドウごとのグループ記憶を更新（非破壊）
    const updateGroupMemory = (map, windowId, groupId) => {
        return { ...map, [windowId]: groupId };
    };

    // 記憶からグループIDを取得（未記憶ならnull）
    const getRememberedGroup = (map, windowId) => {
        return map[windowId] ?? null;
    };

    // 記憶したグループIDが実在するか検証（無効ならnull）
    const validateRememberedGroup = (groupId, groups) => {
        if (groupId === null) {
            return null;
        }
        return groups.some(g => g.id === groupId) ? groupId : null;
    };

    const FILTER_LOGIC = {
        isKindleUrl,
        hasSynopsis,
        isTrashSelected,
        filterVisibleItems,
        updateGroupMemory,
        getRememberedGroup,
        validateRememberedGroup,
        KINDLE_URL_PATTERN,
    };

    factory(root, FILTER_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, FILTER_LOGIC) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FILTER_LOGIC;
    }
    if (typeof window !== 'undefined') {
        window.FILTER_LOGIC = FILTER_LOGIC;
    }
});

