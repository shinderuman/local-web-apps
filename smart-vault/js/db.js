// localStorage アクセス層（CRUD とキー管理）。ブラウザ/Node両方で利用
// ブラウザ: window.SMART_DB にエクスポート
// Node: module.exports にエクスポート
// ※ ストレージキー定義と読み書きを集約し、app.js がキー文字列を意識しないようにする

((root, factory) => {

    // ストレージ・セッションキー
    const STORAGE_KEY = 'storage_smart_assets';
    const FILTER_KEY = 'smart_vault_filter';

    // ストレージレコード配列を読込（配列で返す）
    const loadDb = () => {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        return Array.isArray(raw) ? raw : Object.values(raw);
    };

    // ストレージレコード配列を保存
    const saveDb = (db) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    };

    // フィルタ状態を読込（無ければ 'all'）
    const loadFilter = () => {
        return sessionStorage.getItem(FILTER_KEY) || 'all';
    };

    // フィルタ状態を保存
    const saveFilter = (filter) => {
        sessionStorage.setItem(FILTER_KEY, filter);
    };

    const SMART_DB = {
        loadDb,
        saveDb,
        loadFilter,
        saveFilter
    };

    factory(root, SMART_DB);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.SMART_DB = mod;
    }
});
