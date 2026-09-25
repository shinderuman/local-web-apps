// ASIN一括出力関連の純粋関数
// ブラウザ: window.ASIN_LOGIC にエクスポート
// Node: module.exports にエクスポート

const ASIN_HOST = 'read.amazon.co.jp';
const ASIN_PATH_PATTERN = /(?:^|\/)([A-Z0-9]{10})(?:\/|$)/i;

((root, factory) => {
    const extractAsin = (url) => {
        let parsed;
        try {
            parsed = new URL(url);
        } catch {
            return null;
        }
        if (parsed.hostname !== ASIN_HOST) return null;
        const queryAsin = parsed.searchParams.get('asin');
        if (queryAsin) return queryAsin.toUpperCase();
        const matched = parsed.pathname.match(ASIN_PATH_PATTERN);
        return matched ? matched[1].toUpperCase() : null;
    };

    const selectAsinItems = (items, windowId, groupIds) =>
        items
            .filter(
                (item) =>
                    item.windowId === windowId &&
                    groupIds.includes(item.groupId)
            )
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const extractAsins = (items) => {
        const seen = new Set();
        const asins = [];
        items.forEach((item) => {
            const asin = extractAsin(item.url);
            if (!asin || seen.has(asin)) return;
            seen.add(asin);
            asins.push(asin);
        });
        return asins;
    };

    const ASIN_LOGIC = {
        extractAsin,
        selectAsinItems,
        extractAsins
    };

    factory(root, ASIN_LOGIC);
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    (root, ASIN_LOGIC) => {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = ASIN_LOGIC;
        }
        if (typeof window !== 'undefined') {
            window.ASIN_LOGIC = ASIN_LOGIC;
        }
    }
);
