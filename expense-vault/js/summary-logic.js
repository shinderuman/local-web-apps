// 期間絞り込み・カテゴリ集計の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.SUMMARY_LOGIC にエクスポート
// Node: module.exports にエクスポート
((root, factory) => {
    const SUMMARY_LOGIC = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = SUMMARY_LOGIC;
    }

    if (root) {
        root.SUMMARY_LOGIC = SUMMARY_LOGIC;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    // YYYY-MMが指定範囲内か判定する
    const isMonthInRange = (monthKey, startMonth, endMonth) => {
        return monthKey >= startMonth && monthKey <= endMonth;
    };

    // 月次または指定期間で明細を絞り込む
    const filterTransactionsByPeriod = (transactions, period) => {
        return (transactions || []).filter((transaction) => {
            if (period.mode === 'monthly') {
                return transaction.monthKey === period.month;
            }

            return isMonthInRange(
                transaction.monthKey,
                period.startMonth,
                period.endMonth
            );
        });
    };

    // 画面の検索・カテゴリ・状態条件で明細を絞り込む
    const filterTransactionsForView = (transactions, filters) => {
        const searchText = String(filters.searchText || '').trim();

        return (transactions || []).filter((transaction) => {
            if (searchText && !transaction.merchant.includes(searchText)) {
                return false;
            }

            if (!matchesCategoryFilter(transaction, filters.categoryId)) {
                return false;
            }

            return matchesStatusFilter(transaction, filters.status);
        });
    };

    // カテゴリフィルタに一致するか判定する
    const matchesCategoryFilter = (transaction, categoryId) => {
        if (!categoryId || categoryId === 'all') {
            return true;
        }

        if (categoryId === 'unknown') {
            return !transaction.allocations?.length;
        }

        return (transaction.allocations || []).some((allocation) => {
            return allocation.categoryId === categoryId;
        });
    };

    // 分類状態フィルタに一致するか判定する
    const matchesStatusFilter = (transaction, status) => {
        if (!status || status === 'all') {
            return true;
        }

        if (status === 'unknown') {
            return !transaction.allocations?.length;
        }

        return transaction.classificationSource === status;
    };

    // カテゴリ集計用の初期マップを構築する
    const createCategorySummaryMap = (categories) => {
        return new Map(
            [...(categories || [])]
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((category) => [
                    category.id,
                    {
                        categoryId: category.id,
                        name: category.name,
                        color: category.color,
                        amount: 0,
                        transactionCount: 0,
                        subcategories: new Map()
                    }
                ])
        );
    };

    // サブカテゴリ名をIDから引くマップを作る
    const createSubcategoryMap = (subcategories) => {
        return new Map(
            (subcategories || []).map((subcategory) => [
                subcategory.id,
                subcategory
            ])
        );
    };

    // 按分1件をカテゴリ集計へ加算する
    const addAllocationToSummary = (
        categorySummaryMap,
        subcategoryMap,
        allocation
    ) => {
        const categorySummary = categorySummaryMap.get(allocation.categoryId);

        if (!categorySummary) {
            return;
        }

        categorySummary.amount += allocation.amount;
        categorySummary.transactionCount += 1;

        const subcategoryName = allocation.subcategoryId
            ? subcategoryMap.get(allocation.subcategoryId)?.name || '削除済み'
            : '未指定';
        const currentAmount =
            categorySummary.subcategories.get(subcategoryName) || 0;

        categorySummary.subcategories.set(
            subcategoryName,
            currentAmount + allocation.amount
        );
    };

    // 明細配列から合計・カテゴリ・サブカテゴリ・不明を集計する
    const buildSummary = (transactions, categories, subcategories) => {
        const categorySummaryMap = createCategorySummaryMap(categories);
        const subcategoryMap = createSubcategoryMap(subcategories);
        let totalAmount = 0;
        let unknownAmount = 0;
        let unknownCount = 0;

        (transactions || []).forEach((transaction) => {
            totalAmount += transaction.amount;

            if (!transaction.allocations?.length) {
                unknownAmount += transaction.amount;
                unknownCount += 1;
                return;
            }

            transaction.allocations.forEach((allocation) => {
                addAllocationToSummary(
                    categorySummaryMap,
                    subcategoryMap,
                    allocation
                );
            });
        });

        return {
            totalAmount,
            categories: [...categorySummaryMap.values()].map((summary) => ({
                ...summary,
                subcategories: [...summary.subcategories.entries()]
                    .map(([name, amount]) => ({ name, amount }))
                    .sort((left, right) => right.amount - left.amount)
            })),
            unknownAmount,
            unknownCount
        };
    };

    // 明細を利用日降順、同日ではID降順に並べる
    const sortTransactionsByDate = (transactions) => {
        return [...(transactions || [])].sort((left, right) => {
            const dateComparison = right.usedAt.localeCompare(left.usedAt);

            if (dateComparison !== 0) {
                return dateComparison;
            }

            return Number(right.id || 0) - Number(left.id || 0);
        });
    };

    return {
        buildSummary,
        filterTransactionsByPeriod,
        filterTransactionsForView,
        isMonthInRange,
        matchesCategoryFilter,
        matchesStatusFilter,
        sortTransactionsByDate
    };
});
