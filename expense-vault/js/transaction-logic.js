// 明細照合・自動分類・按分の純粋関数
// ブラウザ: window.TRANSACTION_LOGIC にエクスポート
// Node: module.exports にエクスポート
((root, factory) => {
    const TRANSACTION_LOGIC = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = TRANSACTION_LOGIC;
    }

    if (root) {
        root.TRANSACTION_LOGIC = TRANSACTION_LOGIC;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    const CLASSIFICATION_SOURCE = {
        AUTOMATIC: 'automatic',
        MANUAL: 'manual',
        MANUAL_REQUIRED: 'manual-required',
        UNKNOWN: 'unknown'
    };

    const parseStatementKey = (fileName) => {
        const match = String(fileName ?? '')
            .trim()
            .match(/^(\d{4})(0[1-9]|1[0-2])(?:\s*\(\d+\))?\.csv$/i);

        if (!match) {
            throw new Error(
                'CSVファイル名から明細所属月を判定できません。YYYYMM.csv形式のファイルを使用してください'
            );
        }

        return `${match[1]}-${match[2]}`;
    };

    const createMatchKey = (transaction) => {
        return [
            transaction.usedAt,
            transaction.merchant,
            transaction.amount
        ].join('');
    };

    const cloneAllocations = (allocations) => {
        return (allocations || []).map((allocation) => ({
            categoryId: allocation.categoryId,
            subcategoryId: allocation.subcategoryId || null,
            amount: allocation.amount
        }));
    };

    const isTransactionUnknown = (transaction) => {
        return (
            !Array.isArray(transaction.allocations) ||
            transaction.allocations.length === 0
        );
    };

    const getSingleAllocation = (transaction) => {
        if (!transaction || transaction.allocations?.length !== 1) {
            return null;
        }

        return transaction.allocations[0];
    };

    const matchesManualRule = (merchant, rule) => {
        if (!rule?.enabled || !rule.pattern) {
            return false;
        }

        if (rule.matchType === 'contains') {
            return merchant.includes(rule.pattern);
        }

        return merchant === rule.pattern;
    };

    const requiresManualClassification = (merchant, manualRules) => {
        return (manualRules || []).some((rule) =>
            matchesManualRule(merchant, rule)
        );
    };

    // 手動分類済み履歴から店舗ごとの最頾分類を構築。同票の場合は決定しない
    const buildLearnedClassifications = (transactions) => {
        const merchantCounts = new Map();

        (transactions || []).forEach((transaction) => {
            const allocation = getSingleAllocation(transaction);

            if (
                transaction.classificationSource !==
                    CLASSIFICATION_SOURCE.MANUAL ||
                !allocation
            ) {
                return;
            }

            if (!merchantCounts.has(transaction.merchant)) {
                merchantCounts.set(transaction.merchant, new Map());
            }

            const allocationKey = [
                allocation.categoryId,
                allocation.subcategoryId || ''
            ].join('');
            const counts = merchantCounts.get(transaction.merchant);
            const current = counts.get(allocationKey) || {
                allocation,
                count: 0
            };

            current.count += 1;
            counts.set(allocationKey, current);
        });

        const learned = new Map();

        merchantCounts.forEach((counts, merchant) => {
            const ranked = [...counts.values()].sort((left, right) => {
                return right.count - left.count;
            });

            if (ranked.length === 0) {
                return;
            }

            if (ranked.length > 1 && ranked[0].count === ranked[1].count) {
                return;
            }

            learned.set(merchant, {
                categoryId: ranked[0].allocation.categoryId,
                subcategoryId: ranked[0].allocation.subcategoryId || null
            });
        });

        return learned;
    };

    const groupMatchCandidates = (transactions, sourceType) => {
        const groups = new Map();

        [...transactions]
            .sort((left, right) => {
                return (
                    getCandidatePriority(right, sourceType) -
                    getCandidatePriority(left, sourceType)
                );
            })
            .forEach((transaction) => {
                const key = createMatchKey(transaction);

                if (!groups.has(key)) {
                    groups.set(key, []);
                }

                groups.get(key).push(transaction);
            });

        return groups;
    };

    // 優先度: 同sourceType +4、手動分類済み +3、分類済み +1
    const getCandidatePriority = (transaction, sourceType) => {
        let priority = transaction.sourceType === sourceType ? 4 : 0;

        if (transaction.classificationSource === CLASSIFICATION_SOURCE.MANUAL) {
            priority += 3;
        }

        if (!isTransactionUnknown(transaction)) {
            priority += 1;
        }

        return priority;
    };

    const getReplacementCandidates = (
        transactions,
        sourceType,
        statementKey
    ) => {
        return (transactions || []).filter((transaction) => {
            if (transaction.statementKey !== statementKey) {
                return false;
            }

            if (sourceType === 'confirmed') {
                return true;
            }

            return transaction.sourceType === 'provisional';
        });
    };

    // statementKey導入前の旧レコード向け
    const getLegacyMatchCandidates = (transactions, sourceType) => {
        return (transactions || []).filter((transaction) => {
            if (transaction.statementKey) {
                return false;
            }

            if (sourceType === 'confirmed') {
                return true;
            }

            return transaction.sourceType === 'provisional';
        });
    };

    const inheritMatchedTransaction = (
        incomingRecord,
        matchedTransaction,
        importMetadata
    ) => {
        return {
            ...incomingRecord,
            id: matchedTransaction.id,
            allocations: cloneAllocations(matchedTransaction.allocations),
            classificationSource:
                matchedTransaction.classificationSource ||
                CLASSIFICATION_SOURCE.UNKNOWN,
            importedAt: importMetadata.importedAt,
            importBatchId: importMetadata.importBatchId
        };
    };

    const resolveMatchedTransaction = (
        incomingRecord,
        matchedTransaction,
        manualRules,
        learnedClassifications,
        importMetadata
    ) => {
        if (!isTransactionUnknown(matchedTransaction)) {
            return inheritMatchedTransaction(
                incomingRecord,
                matchedTransaction,
                importMetadata
            );
        }

        const reclassifiedTransaction = classifyNewTransaction(
            incomingRecord,
            manualRules,
            learnedClassifications,
            importMetadata
        );

        return {
            ...reclassifiedTransaction,
            id: matchedTransaction.id
        };
    };

    const classifyNewTransaction = (
        incomingRecord,
        manualRules,
        learnedClassifications,
        importMetadata
    ) => {
        const baseTransaction = {
            ...incomingRecord,
            allocations: [],
            classificationSource: CLASSIFICATION_SOURCE.UNKNOWN,
            importedAt: importMetadata.importedAt,
            importBatchId: importMetadata.importBatchId
        };

        if (
            requiresManualClassification(incomingRecord.merchant, manualRules)
        ) {
            return {
                ...baseTransaction,
                classificationSource: CLASSIFICATION_SOURCE.MANUAL_REQUIRED
            };
        }

        const learned = learnedClassifications.get(incomingRecord.merchant);

        if (!learned) {
            return baseTransaction;
        }

        return {
            ...baseTransaction,
            allocations: [
                {
                    categoryId: learned.categoryId,
                    subcategoryId: learned.subcategoryId,
                    amount: incomingRecord.amount
                }
            ],
            classificationSource: CLASSIFICATION_SOURCE.AUTOMATIC
        };
    };

    const buildImportPlan = ({
        incomingRecords,
        existingTransactions,
        manualRules,
        sourceType,
        statementKey,
        importedAt,
        importBatchId
    }) => {
        const resolvedStatementKey =
            statementKey ||
            incomingRecords
                .map((record) => record.statementKey || record.monthKey)
                .sort()
                .at(-1);
        const normalizedIncomingRecords = incomingRecords.map((record) => ({
            ...record,
            statementKey: resolvedStatementKey
        }));
        const replacementCandidates = getReplacementCandidates(
            existingTransactions,
            sourceType,
            resolvedStatementKey
        );
        const replacementMatchGroups = groupMatchCandidates(
            replacementCandidates,
            sourceType
        );
        const legacyMatchGroups = groupMatchCandidates(
            getLegacyMatchCandidates(existingTransactions, sourceType),
            sourceType
        );
        const learnedClassifications =
            buildLearnedClassifications(existingTransactions);
        const legacyMatchedIds = new Set();
        let inheritedCount = 0;
        let automaticCount = 0;
        let unknownCount = 0;
        let matchedCount = 0;

        const recordsToSave = normalizedIncomingRecords.map(
            (incomingRecord) => {
                const matchKey = createMatchKey(incomingRecord);
                const replacementMatched = replacementMatchGroups
                    .get(matchKey)
                    ?.shift();
                const legacyMatched = replacementMatched
                    ? null
                    : legacyMatchGroups.get(matchKey)?.shift();
                const matched = replacementMatched || legacyMatched;
                const metadata = {
                    importedAt,
                    importBatchId
                };

                if (legacyMatched) {
                    legacyMatchedIds.add(legacyMatched.id);
                }

                if (matched) {
                    matchedCount += 1;
                    const resolvedTransaction = resolveMatchedTransaction(
                        incomingRecord,
                        matched,
                        manualRules,
                        learnedClassifications,
                        metadata
                    );

                    if (!isTransactionUnknown(matched)) {
                        inheritedCount += 1;
                    }

                    if (
                        resolvedTransaction.classificationSource ===
                        CLASSIFICATION_SOURCE.AUTOMATIC
                    ) {
                        automaticCount += 1;
                    } else if (isTransactionUnknown(resolvedTransaction)) {
                        unknownCount += 1;
                    }

                    return resolvedTransaction;
                }

                const classified = classifyNewTransaction(
                    incomingRecord,
                    manualRules,
                    learnedClassifications,
                    metadata
                );

                if (
                    classified.classificationSource ===
                    CLASSIFICATION_SOURCE.AUTOMATIC
                ) {
                    automaticCount += 1;
                } else if (isTransactionUnknown(classified)) {
                    unknownCount += 1;
                }

                return classified;
            }
        );

        const deleteIds = [
            ...replacementCandidates.map((transaction) => transaction.id),
            ...legacyMatchedIds
        ];

        return {
            deleteIds,
            recordsToSave,
            statistics: {
                automaticCount,
                inheritedCount,
                newCount: recordsToSave.length - matchedCount,
                replacedCount: deleteIds.length,
                unknownCount
            }
        };
    };

    const hasSameAmountSign = (transactionAmount, allocationAmount) => {
        return Math.sign(transactionAmount) === Math.sign(allocationAmount);
    };

    const validateAllocations = (transactionAmount, allocations) => {
        if (
            !Number.isSafeInteger(transactionAmount) ||
            transactionAmount === 0 ||
            !Array.isArray(allocations) ||
            allocations.length === 0
        ) {
            return false;
        }

        if (
            allocations.some(
                (allocation) =>
                    !allocation.categoryId ||
                    !Number.isSafeInteger(allocation.amount) ||
                    allocation.amount === 0 ||
                    !hasSameAmountSign(transactionAmount, allocation.amount)
            )
        ) {
            return false;
        }

        return (
            allocations.reduce((sum, allocation) => {
                return sum + allocation.amount;
            }, 0) === transactionAmount
        );
    };

    const createEqualAllocationAmounts = (transactionAmount, count) => {
        if (
            !Number.isSafeInteger(transactionAmount) ||
            transactionAmount === 0 ||
            count <= 0
        ) {
            return [];
        }

        const sign = Math.sign(transactionAmount);
        const absoluteAmount = Math.abs(transactionAmount);
        const baseAmount = Math.floor(absoluteAmount / count);
        const remainder = absoluteAmount - baseAmount * count;

        return Array.from({ length: count }, (_, index) => {
            const allocationAmount =
                baseAmount + (index === count - 1 ? remainder : 0);

            return allocationAmount * sign;
        });
    };

    return {
        CLASSIFICATION_SOURCE,
        buildImportPlan,
        buildLearnedClassifications,
        cloneAllocations,
        createEqualAllocationAmounts,
        createMatchKey,
        getLegacyMatchCandidates,
        getReplacementCandidates,
        getSingleAllocation,
        isTransactionUnknown,
        matchesManualRule,
        parseStatementKey,
        requiresManualClassification,
        validateAllocations
    };
});
