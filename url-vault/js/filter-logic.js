// フィルタ・ゴミ箱判定の純粋関数
// ブラウザ: window.FILTER_LOGIC にエクスポート
// Node: module.exports にエクスポート

const KINDLE_URL_PATTERN = /^https?:\/\/read\.amazon\.co\.jp\//;

((root, factory) => {
    const isKindleUrl = (url) => KINDLE_URL_PATTERN.test(url);

    // 壊れたデータは未取得扱い
    const hasSynopsis = (item) =>
        Array.isArray(item.synopsis) && item.synopsis.length > 0;

    const isTrashSelected = (windowId, trashWindowId) =>
        windowId === trashWindowId;

    const filterVisibleItems = (
        allItems,
        windowId,
        groupId,
        searchQuery,
        trashWindowId
    ) => {
        let items = allItems;
        if (windowId === trashWindowId) {
            items = items.filter((item) => item.windowId === trashWindowId);
        } else {
            items = items.filter((item) => item.windowId !== trashWindowId);
            if (windowId !== null) {
                items = items.filter((item) => item.windowId === windowId);
            }
        }
        if (groupId !== null) {
            items = items.filter((item) => item.groupId === groupId);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter((item) =>
                item.title.toLowerCase().includes(q)
            );
        }
        return items;
    };

    const updateGroupMemory = (map, windowId, groupId) => {
        return { ...map, [windowId]: groupId };
    };

    const getRememberedGroup = (map, windowId) => {
        return map[windowId] ?? null;
    };

    const validateRememberedGroup = (groupId, groups) => {
        if (groupId === null) {
            return null;
        }
        return groups.some((g) => g.id === groupId) ? groupId : null;
    };

    // parseBaseTitleで巻数等を除去した作品名の先頭n文字を重複キーとする
    // parseBaseTitleは引数で受け取る（Nodeテスト時のrequire順への依存を避ける）
    const duplicateKey = (item, n, parseBaseTitle) => {
        const base = parseBaseTitle(item.title);
        return base.slice(0, n);
    };

    // 同じキー（先頭n文字一致）が2件以上のアイテムのみを残す
    const filterDuplicates = (items, n, parseBaseTitle) => {
        const counts = {};
        items.forEach((item) => {
            const key = duplicateKey(item, n, parseBaseTitle);
            counts[key] = (counts[key] || 0) + 1;
        });
        return items.filter(
            (item) => counts[duplicateKey(item, n, parseBaseTitle)] >= 2
        );
    };

    const isNoSynopsisItem = (item) =>
        isKindleUrl(item.url) && !hasSynopsis(item);

    const FILTER_LOGIC = {
        isKindleUrl,
        hasSynopsis,
        isTrashSelected,
        filterVisibleItems,
        updateGroupMemory,
        getRememberedGroup,
        validateRememberedGroup,
        duplicateKey,
        filterDuplicates,
        isNoSynopsisItem,
        KINDLE_URL_PATTERN
    };

    factory(root, FILTER_LOGIC);
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    (root, FILTER_LOGIC) => {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = FILTER_LOGIC;
        }
        if (typeof window !== 'undefined') {
            window.FILTER_LOGIC = FILTER_LOGIC;
        }
    }
);
