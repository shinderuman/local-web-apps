// アプリ状態の集約（ブラウザ/Node両方で利用）
// ブラウザ: window.WP_STATE にエクスポート
// Node: module.exports にエクスポート
// ※ 各状態の参照をそのまま公開し、app.js は分割代入で受け取って直接読み書きする

((root, factory) => {

    // 系統データ本体
    let horses = [];

    // ゲーム内現在年
    let currentGameYear = 1968;

    // SortableJS インスタンス
    let sortableInstance = null;

    // ソート状態
    const sortState = {
        key: 'order',
        asc: true
    };

    // horses は配列のため、再代入できるよう setter を用意
    const setHorses = (next) => { horses = next; };
    const setCurrentGameYear = (next) => { currentGameYear = next; };
    const setSortableInstance = (next) => { sortableInstance = next; };

    const WP_STATE = {
        get horses() { return horses; },
        set horses(v) { horses = v; },
        get currentGameYear() { return currentGameYear; },
        set currentGameYear(v) { currentGameYear = v; },
        get sortableInstance() { return sortableInstance; },
        set sortableInstance(v) { sortableInstance = v; },
        sortState,
        setHorses,
        setCurrentGameYear,
        setSortableInstance
    };

    factory(root, WP_STATE);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.WP_STATE = mod;
    }
});
