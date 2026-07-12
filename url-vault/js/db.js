// IndexedDB アクセス層（接続とストア定義）。ブラウザ/Node両方で利用
// ブラウザ: window.URL_DB にエクスポート
// Node: module.exports にエクスポート
// ※ IndexedDB 接続と3ストア（windows/groups/items）の定義をカプセル化
// ※ 接続（db）は getDb() で取得。ハンドラ側の transaction 処理はそのまま残す（高レベルCRUD化は今後の課題）

((root, factory) => {

    const DB = {
        NAME: 'HighDensityTabManagerDB_v2',
        VERSION: 1,
        STORES: {
            WINDOWS: 'windows',
            GROUPS: 'groups',
            ITEMS: 'items'
        }
    };

    let db = null;

    // IndexedDB を開き、3ストアを作成してから onReady を呼ぶ
    const open = (onReady) => {
        const request = indexedDB.open(DB.NAME, DB.VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            database.createObjectStore(DB.STORES.WINDOWS, { keyPath: 'id', autoIncrement: true });
            database.createObjectStore(DB.STORES.GROUPS, { keyPath: 'id', autoIncrement: true });
            database.createObjectStore(DB.STORES.ITEMS, { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            onReady();
        };
        request.onerror = (e) => {
            console.error('IndexedDBのオープンに失敗しました', e.target.error);
        };
    };

    // 接続済みの db インスタンスを返す（open 完了後のみ有効）
    const getDb = () => db;

    const URL_DB = {
        DB,
        open,
        getDb
    };

    factory(root, URL_DB);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.URL_DB = mod;
    }
});
