// バックアップ構築・検証の純粋関数
// ブラウザ: window.EXPORT_LOGIC にエクスポート
// Node: module.exports にエクスポート
((root, factory) => {
    const EXPORT_LOGIC = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = EXPORT_LOGIC;
    }

    if (root) {
        root.EXPORT_LOGIC = EXPORT_LOGIC;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    const BACKUP_APP_NAME = 'expense-vault';
    const BACKUP_VERSION = 1;

    const buildBackupData = ({
        transactions,
        categories,
        subcategories,
        manualRules,
        exportedAt
    }) => {
        return {
            app: BACKUP_APP_NAME,
            version: BACKUP_VERSION,
            exportedAt,
            transactions,
            categories,
            subcategories,
            manualRules
        };
    };

    const isObjectArray = (value) => {
        return (
            Array.isArray(value) &&
            value.every((item) => {
                return item && typeof item === 'object' && !Array.isArray(item);
            })
        );
    };

    const isValidTransaction = (transaction) => {
        return (
            typeof transaction.usedAt === 'string' &&
            typeof transaction.merchant === 'string' &&
            Number.isSafeInteger(transaction.amount) &&
            Array.isArray(transaction.allocations)
        );
    };

    const validateBackupData = (data) => {
        if (!data || data.app !== BACKUP_APP_NAME) {
            return null;
        }

        if (data.version !== BACKUP_VERSION) {
            return null;
        }

        if (!isObjectArray(data.transactions)) {
            return null;
        }

        if (!data.transactions.every(isValidTransaction)) {
            return null;
        }

        if (!isObjectArray(data.categories)) {
            return null;
        }

        if (!isObjectArray(data.subcategories)) {
            return null;
        }

        if (!isObjectArray(data.manualRules)) {
            return null;
        }

        return {
            transactions: data.transactions,
            categories: data.categories,
            subcategories: data.subcategories,
            manualRules: data.manualRules
        };
    };

    return {
        BACKUP_APP_NAME,
        BACKUP_VERSION,
        buildBackupData,
        validateBackupData
    };
});
