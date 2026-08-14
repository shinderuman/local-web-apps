// 期間絞り込み・カテゴリ集計の純粋関数
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
    const isMonthInRange = (monthKey, startMonth, endMonth) => {
        return monthKey >= startMonth && monthKey <= endMonth;
    };

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

    const matchesStatusFilter = (transaction, status) => {
        if (!status || status === 'all') {
            return true;
        }

        if (status === 'unknown') {
            return !transaction.allocations?.length;
        }

        return transaction.classificationSource === status;
    };

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

    const createSubcategoryMap = (subcategories) => {
        return new Map(
            (subcategories || []).map((subcategory) => [
                subcategory.id,
                subcategory
            ])
        );
    };

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

    const createChartItems = (summary, unknownColor) => {
        const items = (summary.categories || [])
            .filter((category) => category.amount !== 0)
            .map((category) => ({
                label: category.name,
                amount: category.amount,
                chartAmount: Math.max(category.amount, 0),
                color: category.color
            }));

        if (summary.unknownAmount !== 0) {
            items.push({
                label: '不明',
                amount: summary.unknownAmount,
                chartAmount: Math.max(summary.unknownAmount, 0),
                color: unknownColor
            });
        }

        return items;
    };

    const createChartEmptyMessage = (items) => {
        if (items.length === 0) {
            return 'データなし';
        }

        return '返金のみ';
    };

    const createChartLegendRatio = (item, total) => {
        if (item.amount < 0) {
            return '返金超過';
        }

        if (total === 0) {
            return '0%';
        }

        return `${Math.round((item.chartAmount / total) * 100)}%`;
    };

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
        createChartEmptyMessage,
        createChartItems,
        createChartLegendRatio,
        filterTransactionsByPeriod,
        filterTransactionsForView,
        isMonthInRange,
        matchesCategoryFilter,
        matchesStatusFilter,
        sortTransactionsByDate
    };
});
