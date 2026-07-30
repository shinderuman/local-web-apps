// 明細照合・自動分類・按分の純粋関数（ブラウザ/Node両方で利用）
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

    // 明細の完全一致キーを作成する
    const createMatchKey = (transaction) => {
        return [
            transaction.usedAt,
            transaction.merchant,
            transaction.amount
        ].join('\u001f');
    };

    // 按分情報を安全に複製する
    const cloneAllocations = (allocations) => {
        return (allocations || []).map((allocation) => ({
            categoryId: allocation.categoryId,
            subcategoryId: allocation.subcategoryId || null,
            amount: allocation.amount
        }));
    };

    // 明細が不明状態か判定する
    const isTransactionUnknown = (transaction) => {
        return (
            !Array.isArray(transaction.allocations) ||
            transaction.allocations.length === 0
        );
    };

    // 単一カテゴリの按分だけを返す
    const getSingleAllocation = (transaction) => {
        if (!transaction || transaction.allocations?.length !== 1) {
            return null;
        }

        return transaction.allocations[0];
    };

    // 常に手動分類する店舗ルールに一致するか判定する
    const matchesManualRule = (merchant, rule) => {
        if (!rule?.enabled || !rule.pattern) {
            return false;
        }

        if (rule.matchType === 'contains') {
            return merchant.includes(rule.pattern);
        }

        return merchant === rule.pattern;
    };

    // 店舗が常に手動分類する対象か判定する
    const requiresManualClassification = (merchant, manualRules) => {
        return (manualRules || []).some((rule) =>
            matchesManualRule(merchant, rule)
        );
    };

    // 手動分類済み履歴から店舗ごとの最頻分類を構築する
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
            ].join('\u001f');
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

    // 一致候補を照合キーごとのキューにまとめる
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

    // 引継ぎ候補の優先度を返す
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

    // 取込対象月に置換される既存明細を抽出する
    const getReplacementCandidates = (transactions, sourceType, monthKeys) => {
        return (transactions || []).filter((transaction) => {
            if (!monthKeys.has(transaction.monthKey)) {
                return false;
            }

            if (sourceType === 'confirmed') {
                return true;
            }

            return transaction.sourceType === 'provisional';
        });
    };

    // 一致明細から分類設定を引き継いだ新明細を作る
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

    // 一致した既存明細を引き継ぐか、必要なら再分類する
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

    // 過去履歴または手動対象ルールから新明細の分類を決める
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

    // CSV取込時の削除対象と保存対象を構築する
    const buildImportPlan = ({
        incomingRecords,
        existingTransactions,
        manualRules,
        sourceType,
        importedAt,
        importBatchId
    }) => {
        const monthKeys = new Set(
            incomingRecords.map((record) => record.monthKey)
        );
        const replacementCandidates = getReplacementCandidates(
            existingTransactions,
            sourceType,
            monthKeys
        );
        const matchGroups = groupMatchCandidates(
            replacementCandidates,
            sourceType
        );
        const learnedClassifications =
            buildLearnedClassifications(existingTransactions);
        let inheritedCount = 0;
        let automaticCount = 0;
        let unknownCount = 0;
        let matchedCount = 0;

        const recordsToSave = incomingRecords.map((incomingRecord) => {
            const matched = matchGroups
                .get(createMatchKey(incomingRecord))
                ?.shift();
            const metadata = {
                importedAt,
                importBatchId
            };

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
        });

        return {
            deleteIds: replacementCandidates.map(
                (transaction) => transaction.id
            ),
            recordsToSave,
            statistics: {
                automaticCount,
                inheritedCount,
                newCount: recordsToSave.length - matchedCount,
                replacedCount: replacementCandidates.length,
                unknownCount
            }
        };
    };

    // 按分合計と元金額が一致するか検証する
    const validateAllocations = (transactionAmount, allocations) => {
        if (!Array.isArray(allocations) || allocations.length === 0) {
            return false;
        }

        if (
            allocations.some(
                (allocation) =>
                    !allocation.categoryId ||
                    !Number.isSafeInteger(allocation.amount) ||
                    allocation.amount <= 0
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

    // 指定カテゴリ数で均等按分する
    const createEqualAllocationAmounts = (transactionAmount, count) => {
        if (!Number.isSafeInteger(transactionAmount) || count <= 0) {
            return [];
        }

        const baseAmount = Math.floor(transactionAmount / count);
        const remainder = transactionAmount - baseAmount * count;

        return Array.from({ length: count }, (_, index) => {
            return baseAmount + (index === count - 1 ? remainder : 0);
        });
    };

    return {
        CLASSIFICATION_SOURCE,
        buildImportPlan,
        buildLearnedClassifications,
        cloneAllocations,
        createEqualAllocationAmounts,
        createMatchKey,
        getReplacementCandidates,
        getSingleAllocation,
        isTransactionUnknown,
        matchesManualRule,
        requiresManualClassification,
        validateAllocations
    };
});
