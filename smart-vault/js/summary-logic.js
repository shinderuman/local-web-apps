// ストレージ一覧のMarkdownサマリ生成（純粋関数・ブラウザ/Node両方で利用）
// ブラウザ: window.SUMMARY_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    // customType の表示名を返す（typeLabels に無ければキーそのまま）
    const resolveTypeName = (customType, typeLabels) =>
        typeLabels[customType] || customType;

    // 空文字・未定義のサイズを「容量不明」に正規化
    const normalizeSize = (size) => (size && size.trim() ? size : '容量不明');

    // 種別ごとに「容量 -> 件数」のMapを構築する
    const countBySizePerType = (records) => {
        const map = new Map();
        records.forEach((record) => {
            const type = record.customType || 'unknown';
            const size = normalizeSize(record.size);
            if (!map.has(type)) map.set(type, new Map());
            const sizeMap = map.get(type);
            sizeMap.set(size, (sizeMap.get(size) || 0) + 1);
        });
        return map;
    };

    // 1種別分のMarkdownブロック（見出し+箇条書き）を組み立てる
    const buildTypeBlock = (typeName, sizeMap) => {
        const total = [...sizeMap.values()].reduce((sum, n) => sum + n, 0);
        const lines = [`## ${typeName}（${total}台）`];
        sizeMap.forEach((count, size) => {
            lines.push(`* ${size} * ${count}`);
        });
        return lines.join('\n');
    };

    // 全レコードから種別ごとのMarkdownサマリを生成する
    const buildStorageSummaryMarkdown = (records, typeLabels) => {
        const countMap = countBySizePerType(records || []);
        const blocks = Object.keys(typeLabels)
            .filter((type) => countMap.has(type))
            .map((type) =>
                buildTypeBlock(
                    resolveTypeName(type, typeLabels),
                    countMap.get(type)
                )
            );
        return blocks.join('\n\n');
    };

    const SUMMARY_LOGIC = {
        buildStorageSummaryMarkdown
    };

    factory(root, SUMMARY_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.SUMMARY_LOGIC = mod;
    }
});
