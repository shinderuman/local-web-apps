// IndexedDB アクセス層（CRUD と初期化）。ブラウザ/Node両方で利用
// ブラウザ: window.PRICE_DB にエクスポート
// Node: module.exports にエクスポート
// ※ db 接続は本モジュール内にカプセル化し、準備完了後に onReady を呼ぶ

((root, factory) => {

    const DB = {
        NAME: 'PriceVaultDB',
        VERSION: 1,
        STORE: 'products'
    };

    let db = null;

    // IndexedDB を開き、products ストアを作成してから onReady を呼ぶ
    const open = (onReady) => {
        const request = indexedDB.open(DB.NAME, DB.VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            database.createObjectStore(DB.STORE, { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            onReady();
        };
        request.onerror = (e) => {
            console.error('IndexedDBのオープンに失敗しました', e.target.error);
        };
    };

    // 全商品取得
    const getAllProducts = () => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([DB.STORE], 'readonly');
            const req = tx.objectStore(DB.STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    };

    // 1商品取得
    const getProduct = (id) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([DB.STORE], 'readonly');
            const req = tx.objectStore(DB.STORE).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    };

    // 商品を保存（新規・更新）
    const putProduct = (product) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([DB.STORE], 'readwrite');
            tx.objectStore(DB.STORE).put(product);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // 商品を削除
    const deleteProductDb = (id) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([DB.STORE], 'readwrite');
            tx.objectStore(DB.STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    // ストアを全削除
    const clearProducts = () => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([DB.STORE], 'readwrite');
            tx.objectStore(DB.STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    };

    const PRICE_DB = {
        open,
        getAllProducts,
        getProduct,
        putProduct,
        deleteProductDb,
        clearProducts
    };

    factory(root, PRICE_DB);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.PRICE_DB = mod;
    }
});
