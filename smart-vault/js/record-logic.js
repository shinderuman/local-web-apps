// レコード集計・表示・並び替えの純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.RECORD_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    // 指定したフィルタ種別ごとの件数と全件数を返す
    const countRecordsByType = (records, filterTypes) => {
        const counts = Object.fromEntries(filterTypes.map((type) => [type, 0]));
        records.forEach((record) => {
            counts.all++;
            const type = record.customType || 'unknown';
            if (counts[type] !== undefined) counts[type]++;
        });
        return counts;
    };

    // 列クリック後のソート状態を返す
    const getNextSortState = (sortState, field) => {
        if (sortState.sortField !== field)
            return { sortField: field, sortOrder: 'asc' };
        if (sortState.sortOrder === 'asc')
            return { sortField: field, sortOrder: 'desc' };
        return { sortField: '', sortOrder: 'asc' };
    };

    // 指定列と方向でレコードを非破壊に並べ替える
    const sortRecords = (records, sortField, sortOrder) => {
        const sorted = [...records];
        if (!sortField) return sorted;
        sorted.sort((a, b) => {
            const valueA = a[sortField] ?? -1;
            const valueB = b[sortField] ?? -1;
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
            }
            const stringA = String(valueA || '');
            const stringB = String(valueB || '');
            const comparison = stringA.localeCompare(stringB, 'ja');
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        return sorted;
    };

    // 指定分類に一致するレコードを非破壊に返す
    const filterRecordsByType = (records, filter) => {
        if (filter === 'all') return [...records];
        return records.filter(
            (record) => (record.customType || 'unknown') === filter
        );
    };

    // 表示中レコードの移動を全体レコード配列の順序へ反映する
    const reorderRecordsByVisiblePosition = (
        records,
        visibleRecords,
        movedId,
        oldIndex,
        newIndex
    ) => {
        const reorderedVisibleRecords = [...visibleRecords];
        const movedRecord = reorderedVisibleRecords.splice(oldIndex, 1)[0];
        reorderedVisibleRecords.splice(newIndex, 0, movedRecord);
        const recordsWithoutMoved = records.filter(
            (record) => record.id !== movedId
        );
        const previousId = reorderedVisibleRecords[newIndex - 1]?.id ?? null;
        const insertIndex =
            previousId === null
                ? 0
                : recordsWithoutMoved.findIndex(
                      (record) => record.id === previousId
                  ) + 1;
        return [
            ...recordsWithoutMoved.slice(0, insertIndex),
            movedRecord,
            ...recordsWithoutMoved.slice(insertIndex)
        ];
    };

    // healthLevelを持つレコードだけで構成された配列かを判定する
    const isValidSmartRecordList = (records) => {
        return (
            Array.isArray(records) &&
            records.every(
                (record) =>
                    record &&
                    typeof record === 'object' &&
                    typeof record.healthLevel !== 'undefined'
            )
        );
    };

    const RECORD_LOGIC = {
        countRecordsByType,
        getNextSortState,
        sortRecords,
        filterRecordsByType,
        reorderRecordsByVisiblePosition,
        isValidSmartRecordList
    };

    factory(root, RECORD_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.RECORD_LOGIC = mod;
    }
});
