// ストレージ一覧のMarkdownサマリ生成（純粋関数）
// ブラウザ: window.SUMMARY_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    const resolveTypeName = (customType, typeLabels) =>
        typeLabels[customType] || customType;

    const normalizeSize = (size) => (size && size.trim() ? size : '容量不明');

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

    const buildTypeBlock = (typeName, sizeMap) => {
        const total = [...sizeMap.values()].reduce((sum, n) => sum + n, 0);
        const lines = [`## ${typeName}（${total}台）`];
        sizeMap.forEach((count, size) => {
            lines.push(`* ${size} * ${count}`);
        });
        return lines.join('\n');
    };

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
