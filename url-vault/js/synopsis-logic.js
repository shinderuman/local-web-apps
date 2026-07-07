// あらすじ取得関連の純粋関数（ブラウザ/Node両方で利用）

((root, factory) => {

    // 楽天ブックスAPIのリクエストURLを構築
    const RAKUTEN_API_URL = 'https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404';
    const RAKUTEN_GENRE_COMIC = '001001';
    const RAKUTEN_HITS = 30;

    const buildRakutenUrl = (applicationId, accessKey, query) => {
        return `${RAKUTEN_API_URL}?applicationId=${applicationId}&accessKey=${accessKey}&booksGenreId=${RAKUTEN_GENRE_COMIC}&title=${encodeURIComponent(query)}&hits=${RAKUTEN_HITS}`;
    };

    // レスポンスItemsから巻数→あらすじのMapを構築。parseVolume関数は外部注入
    const buildVolumeMap = (items, parseVolumeFn) => {
        const map = {};
        items.forEach(it => {
            const v = parseVolumeFn(it.Item.title);
            if (!map[v] && it.Item.itemCaption) {
                map[v] = { volume: v, title: it.Item.title, caption: it.Item.itemCaption };
            }
        });
        return map;
    };

    // 起点巻で終わる3巻の窓を選択（起点-2〜起点）。存在しない巻はスキップ
    const selectTargetVolumes = (volumeMap, currentVolume) => {
        const startVolume = Math.max(1, currentVolume - 2);
        return [startVolume, startVolume + 1, startVolume + 2]
            .map(v => volumeMap[v])
            .filter(Boolean);
    };

    // クエリを記号・空白・読点で分割してトークン配列を返す
    const tokenizeQuery = (query) => {
        return query.split(/[\s　：:、，,]+/).filter(t => t);
    };

    // トークン配列の前方len個を空白区切りで結合
    const shortenQuery = (tokens, len) => {
        return tokens.slice(0, len).join(' ');
    };

    const SYNOPSIS_LOGIC = {
        buildRakutenUrl,
        buildVolumeMap,
        selectTargetVolumes,
        tokenizeQuery,
        shortenQuery,
        RAKUTEN_API_URL,
        RAKUTEN_GENRE_COMIC,
        RAKUTEN_HITS,
    };

    factory(root, SYNOPSIS_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, SYNOPSIS_LOGIC) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SYNOPSIS_LOGIC;
    }
    if (typeof window !== 'undefined') {
        window.SYNOPSIS_LOGIC = SYNOPSIS_LOGIC;
    }
});
