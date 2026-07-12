// アプリ状態の集約（ブラウザ/Node両方で利用）
// ブラウザ: window.PRICE_STATE にエクスポート
// Node: module.exports にエクスポート
// ※ 各状態オブジェクトの参照をそのまま公開し、app.js は分割代入で受け取って直接読み書きする
//    getter/setter を挟まないのは、更新箇所が多数あり冗長化を避けるため

((root, factory) => {

    // 表示状態（選択カテゴリ・ソート・開閉中ID）
    const viewState = {
        selectedCategory: 'all',
        sortKey: 'name',
        openDetailId: null
    };

    // 編集状態（モーダル編集中の商品ID・履歴インデックス）
    const editState = {
        editingProductId: null,
        editingHistoryIndex: null
    };

    // UI状態
    const uiState = {
        toastTimer: null
    };

    const PRICE_STATE = {
        viewState,
        editState,
        uiState
    };

    factory(root, PRICE_STATE);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.PRICE_STATE = mod;
    }
});
