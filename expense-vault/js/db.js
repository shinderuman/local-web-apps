// IndexedDBを利用するExpense Vaultのストレージ層
// DOMや画面状態を持たず、永続化操作だけを提供する
// ブラウザ: window.EXPENSE_DB にエクスポート
(() => {
    const DB_CONFIG = {
        name: 'ExpenseVaultDB',
        version: 1,
        stores: {
            transactions: 'transactions',
            categories: 'categories',
            subcategories: 'subcategories',
            manualRules: 'manualRules'
        }
    };
    const INITIAL_CATEGORIES = [
        {
            id: 'category-subscription',
            name: '月額',
            color: '#8250df',
            sortOrder: 0
        },
        {
            id: 'category-fun',
            name: '遊び',
            color: '#bf8700',
            sortOrder: 1
        },
        {
            id: 'category-daily',
            name: '生活用品',
            color: '#1a7f37',
            sortOrder: 2
        },
        {
            id: 'category-other',
            name: 'その他',
            color: '#57606a',
            sortOrder: 3
        }
    ];
    let database = null;

    const openDatabase = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

            request.onupgradeneeded = (event) => {
                createStores(event.target.result, event.target.transaction);
            };
            request.onsuccess = () => {
                database = request.result;
                resolve(database);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    };

    const createStores = (openedDatabase, upgradeTransaction) => {
        createTransactionStore(openedDatabase);
        createSimpleStore(openedDatabase, DB_CONFIG.stores.categories, 'id');
        createSimpleStore(openedDatabase, DB_CONFIG.stores.subcategories, 'id');
        createManualRuleStore(openedDatabase);
        seedInitialCategories(upgradeTransaction);
    };

    const createTransactionStore = (openedDatabase) => {
        if (
            openedDatabase.objectStoreNames.contains(
                DB_CONFIG.stores.transactions
            )
        ) {
            return;
        }

        const store = openedDatabase.createObjectStore(
            DB_CONFIG.stores.transactions,
            {
                keyPath: 'id',
                autoIncrement: true
            }
        );

        store.createIndex('monthKey', 'monthKey', { unique: false });
        store.createIndex('merchant', 'merchant', { unique: false });
    };

    const createSimpleStore = (openedDatabase, storeName, keyPath) => {
        if (openedDatabase.objectStoreNames.contains(storeName)) {
            return;
        }

        openedDatabase.createObjectStore(storeName, { keyPath });
    };

    const createManualRuleStore = (openedDatabase) => {
        if (
            openedDatabase.objectStoreNames.contains(
                DB_CONFIG.stores.manualRules
            )
        ) {
            return;
        }

        openedDatabase.createObjectStore(DB_CONFIG.stores.manualRules, {
            keyPath: 'id',
            autoIncrement: true
        });
    };

    const seedInitialCategories = (upgradeTransaction) => {
        const store = upgradeTransaction.objectStore(
            DB_CONFIG.stores.categories
        );

        INITIAL_CATEGORIES.forEach((category) => {
            store.put(category);
        });
    };

    const getAll = (storeName) => {
        return new Promise((resolve, reject) => {
            const request = database
                .transaction(storeName, 'readonly')
                .objectStore(storeName)
                .getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    };

    const put = (storeName, record) => {
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, 'readwrite');
            const request = transaction.objectStore(storeName).put(record);

            transaction.oncomplete = () => {
                resolve(request.result);
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    };

    const remove = (storeName, id) => {
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, 'readwrite');

            transaction.objectStore(storeName).delete(id);
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    };

    const applyImportPlan = (deleteIds, recordsToSave) => {
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(
                DB_CONFIG.stores.transactions,
                'readwrite'
            );
            const store = transaction.objectStore(
                DB_CONFIG.stores.transactions
            );

            deleteIds.forEach((id) => {
                store.delete(id);
            });
            recordsToSave.forEach((record) => {
                store.put(record);
            });

            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    };

    const putTransactions = (transactions) => {
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(
                DB_CONFIG.stores.transactions,
                'readwrite'
            );
            const store = transaction.objectStore(
                DB_CONFIG.stores.transactions
            );

            transactions.forEach((record) => {
                store.put(record);
            });
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    };

    const replaceAllData = (backupData) => {
        const storeNames = Object.values(DB_CONFIG.stores);

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeNames, 'readwrite');

            storeNames.forEach((storeName) => {
                transaction.objectStore(storeName).clear();
            });
            backupData.transactions.forEach((record) => {
                transaction
                    .objectStore(DB_CONFIG.stores.transactions)
                    .put(record);
            });
            backupData.categories.forEach((record) => {
                transaction
                    .objectStore(DB_CONFIG.stores.categories)
                    .put(record);
            });
            backupData.subcategories.forEach((record) => {
                transaction
                    .objectStore(DB_CONFIG.stores.subcategories)
                    .put(record);
            });
            backupData.manualRules.forEach((record) => {
                transaction
                    .objectStore(DB_CONFIG.stores.manualRules)
                    .put(record);
            });

            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    };

    const clearAllData = () => {
        const storeNames = Object.values(DB_CONFIG.stores);

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeNames, 'readwrite');

            storeNames.forEach((storeName) => {
                transaction.objectStore(storeName).clear();
            });
            INITIAL_CATEGORIES.forEach((category) => {
                transaction
                    .objectStore(DB_CONFIG.stores.categories)
                    .put(category);
            });

            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    };

    window.EXPENSE_DB = {
        DB_CONFIG,
        INITIAL_CATEGORIES,
        applyImportPlan,
        clearAllData,
        getAll,
        openDatabase,
        put,
        putTransactions,
        remove,
        replaceAllData
    };
})();
