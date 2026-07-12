// アプリ状態の集約（ブラウザ/Node両方で利用）
// ブラウザ: window.SMART_STATE にエクスポート
// Node: module.exports にエクスポート
// ※ 各状態の参照をそのまま公開し、app.js は分割代入で受け取って直接読み書きする

((root, factory) => {

    // SortableJS インスタンス
    let sortableInstance = null;

    // 表示状態（フィルタ・ソート）
    const viewState = {
        filter: 'all',
        sortField: '',
        sortOrder: 'asc'
    };

    // UI状態
    const uiState = {
        toastTimer: null,
        highlightTimer: null,
        selectedIds: new Set(),
        openDetailId: null
    };

    const SMART_STATE = {
        get sortableInstance() { return sortableInstance; },
        set sortableInstance(v) { sortableInstance = v; },
        viewState,
        uiState
    };

    factory(root, SMART_STATE);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.SMART_STATE = mod;
    }
});
