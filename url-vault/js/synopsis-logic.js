// あらすじ取得関連の純粋関数
// ブラウザ: window.SYNOPSIS_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    const RAKUTEN_API_URL =
        'https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404';
    const RAKUTEN_GENRE_COMIC = '001001';
    const RAKUTEN_HITS = 30;

    const buildRakutenUrl = (applicationId, accessKey, query) => {
        return `${RAKUTEN_API_URL}?applicationId=${applicationId}&accessKey=${accessKey}&booksGenreId=${RAKUTEN_GENRE_COMIC}&title=${encodeURIComponent(query)}&hits=${RAKUTEN_HITS}`;
    };

    const buildVolumeMap = (items, parseVolumeFn) => {
        const map = {};
        items.forEach((it) => {
            const v = parseVolumeFn(it.Item.title);
            if (!map[v] && it.Item.itemCaption) {
                map[v] = {
                    volume: v,
                    title: it.Item.title,
                    caption: it.Item.itemCaption
                };
            }
        });
        return map;
    };

    const selectTargetVolumes = (volumeMap, currentVolume) => {
        const startVolume = Math.max(1, currentVolume - 2);
        return [startVolume, startVolume + 1, startVolume + 2]
            .map((v) => volumeMap[v])
            .filter(Boolean);
    };

    const tokenizeQuery = (query) => {
        return query.split(/[\s　：:、，,]+/).filter((t) => t);
    };

    const shortenQuery = (tokens, len) => {
        return tokens.slice(0, len).join(' ');
    };

    const formatSynopsisResponses = (responses) => {
        if (!Array.isArray(responses) || responses.length === 0) return '';
        return responses.map((r) => JSON.stringify(r, null, 2)).join('\n\n');
    };

    const SYNOPSIS_LOGIC = {
        buildRakutenUrl,
        buildVolumeMap,
        selectTargetVolumes,
        tokenizeQuery,
        shortenQuery,
        formatSynopsisResponses,
        RAKUTEN_API_URL,
        RAKUTEN_GENRE_COMIC,
        RAKUTEN_HITS
    };

    factory(root, SYNOPSIS_LOGIC);
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    (root, SYNOPSIS_LOGIC) => {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = SYNOPSIS_LOGIC;
        }
        if (typeof window !== 'undefined') {
            window.SYNOPSIS_LOGIC = SYNOPSIS_LOGIC;
        }
    }
);
