// アプリ状態の集約（ブラウザ/Node両方で利用）
// ブラウザ: window.URL_STATE にエクスポート
// Node: module.exports にエクスポート
// ※ 各状態の参照をそのまま公開し、app.js は分割代入で受け取って直接読み書きする

((root, factory) => {

    // SortableJS インスタンス
    let sortableInstance = null;

    // フィルタ・ソート状態
    const filterState = {
        selectedWindowId: null,
        selectedGroupId: null,
        sortKey: 'sortOrder',
        sortAsc: true,
        searchQuery: '',
        renderId: 0,
        selectedGroupByWindow: {},
        dupCheckEnabled: false,
        dupCheckLength: 6
    };

    // アイテム編集状態
    const editState = {
        imageDataBase64: '',
        addPositionTop: true,
        editingItemId: null,
        isEditMode: false
    };

    // UI状態
    const uiState = {
        synopsisPanelItemId: null,
        toastTimer: null,
        toastVisible: false,
        blurEnabled: false
    };

    const URL_STATE = {
        get sortableInstance() { return sortableInstance; },
        set sortableInstance(v) { sortableInstance = v; },
        filterState,
        editState,
        uiState
    };

    factory(root, URL_STATE);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.URL_STATE = mod;
    }
});
