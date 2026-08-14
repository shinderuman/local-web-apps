const APP_CONFIG = {
    backupFilename: 'expense-vault.json',
    toastDuration: 2800,
    unknownColor: '#cf222e',
    periodStorageKey: 'expense-vault.period',
    categoryPalette: [
        '#0969da',
        '#8250df',
        '#bf8700',
        '#1a7f37',
        '#bc4c00',
        '#57606a',
        '#0550ae',
        '#953800'
    ]
};
const STORE = window.EXPENSE_DB.DB_CONFIG.stores;
const appState = {
    transactions: [],
    categories: [],
    subcategories: [],
    manualRules: [],
    periodMode: 'monthly',
    selectedIds: new Set(),
    editingTransactionId: null,
    toastTimer: null,
    amountMasked: false
};
const { decodeCsvBuffer, parseExpenseCsv } = window.CSV_LOGIC;
const {
    CLASSIFICATION_SOURCE,
    buildImportPlan,
    createEqualAllocationAmounts,
    isTransactionUnknown,
    parseStatementKey,
    requiresManualClassification,
    validateAllocations
} = window.TRANSACTION_LOGIC;
const {
    buildSummary,
    createChartEmptyMessage,
    createChartItems,
    createChartLegendRatio,
    filterTransactionsByPeriod,
    filterTransactionsForView,
    sortTransactionsByDate
} = window.SUMMARY_LOGIC;
const { buildBackupData, validateBackupData } = window.EXPORT_LOGIC;
const { serializePeriod, deserializePeriod } = window.PERIOD_LOGIC;
const {
    applyImportPlan,
    clearAllData,
    getAll,
    openDatabase,
    put,
    putTransactions,
    remove,
    replaceAllData
} = window.EXPENSE_DB;

const initApp = async () => {
    try {
        setInitialPeriodValues();
        bindEvents();
        await openDatabase();
        await reloadAllData();
        refreshAllViews();
    } catch (error) {
        console.error('initApp失敗:', error);
        showToast(`初期化に失敗しました: ${error.message}`);
    }
};

const savePeriodToStorage = () => {
    sessionStorage.setItem(
        APP_CONFIG.periodStorageKey,
        serializePeriod({
            mode: appState.periodMode,
            month: getElement('selectedMonthInput').value,
            rangeStart: getElement('rangeStartInput').value,
            rangeEnd: getElement('rangeEndInput').value
        })
    );
};

const restorePeriodFromStorage = () => {
    const fallbackMonth = formatMonthInputValue(new Date());
    const state = deserializePeriod(
        sessionStorage.getItem(APP_CONFIG.periodStorageKey),
        fallbackMonth
    );

    const mode = state?.mode ?? 'monthly';
    const month = state?.month ?? fallbackMonth;
    const rangeStart = state?.rangeStart ?? `${month.slice(0, 4)}-01`;
    const rangeEnd = state?.rangeEnd ?? month;

    getElement('selectedMonthInput').value = month;
    getElement('rangeStartInput').value = rangeStart;
    getElement('rangeEndInput').value = rangeEnd;
    appState.periodMode = mode;
    applyPeriodModeUI(mode);
};

const setInitialPeriodValues = () => {
    restorePeriodFromStorage();
};

const bindEvents = () => {
    bindImportEvents();
    bindPeriodEvents();
    bindFilterEvents();
    bindTransactionModalEvents();
    bindSettingsEvents();
    bindBackupEvents();
    bindImportResultEvents();
    getElement('toggleAmountMaskButton').addEventListener(
        'click',
        toggleAmountMask
    );
};

const bindImportEvents = () => {
    getElement('csvFileInput').addEventListener('change', handleCsvImport);
};

const bindPeriodEvents = () => {
    getElement('monthlyModeButton').addEventListener('click', () => {
        setPeriodMode('monthly');
    });
    getElement('rangeModeButton').addEventListener('click', () => {
        setPeriodMode('range');
    });
    getElement('selectedMonthInput').addEventListener(
        'change',
        onPeriodChanged
    );
    getElement('rangeStartInput').addEventListener('change', onPeriodChanged);
    getElement('rangeEndInput').addEventListener('change', onPeriodChanged);
    getElement('previousMonthButton').addEventListener('click', () => {
        moveSelectedMonth(-1);
    });
    getElement('nextMonthButton').addEventListener('click', () => {
        moveSelectedMonth(1);
    });
};

const bindFilterEvents = () => {
    getElement('merchantSearchInput').addEventListener(
        'input',
        onFilterChanged
    );
    getElement('categoryFilterSelect').addEventListener(
        'change',
        onFilterChanged
    );
    getElement('statusFilterSelect').addEventListener(
        'change',
        onFilterChanged
    );
    getElement('selectAllCheckbox').addEventListener('change', toggleSelectAll);
    getElement('bulkCategorySelect').addEventListener(
        'change',
        renderBulkSubcategoryOptions
    );
    getElement('bulkApplyButton').addEventListener('click', applyBulkCategory);
    getElement('clearSelectionButton').addEventListener(
        'click',
        clearSelection
    );
};

const bindTransactionModalEvents = () => {
    getElement('transactionModalCloseButton').addEventListener(
        'click',
        closeTransactionModal
    );
    getElement('transactionModalCancelButton').addEventListener(
        'click',
        closeTransactionModal
    );
    getElement('addAllocationButton').addEventListener('click', () => {
        appendAllocationRow(null);
    });
    getElement('equalAllocationButton').addEventListener(
        'click',
        equalizeAllocationAmounts
    );
    getElement('transactionModalSaveButton').addEventListener(
        'click',
        saveTransactionClassification
    );
    getElement('transactionMarkUnknownButton').addEventListener(
        'click',
        markTransactionUnknown
    );
};

const bindSettingsEvents = () => {
    getElement('settingsButton').addEventListener('click', openSettingsModal);
    getElement('settingsModalCloseButton').addEventListener(
        'click',
        closeSettingsModal
    );
    getElement('categoryAddForm').addEventListener('submit', addCategory);
    getElement('subcategoryAddForm').addEventListener('submit', addSubcategory);
    getElement('manualRuleAddForm').addEventListener('submit', addManualRule);
    getElement('clearAllDataButton').addEventListener('click', deleteAllData);
};

const bindBackupEvents = () => {
    getElement('backupButton').addEventListener('click', exportBackup);
    getElement('restoreButton').addEventListener('click', importBackup);
};

const bindImportResultEvents = () => {
    getElement('importResultCloseButton').addEventListener(
        'click',
        closeImportResultModal
    );
    getElement('importResultOkButton').addEventListener(
        'click',
        closeImportResultModal
    );
};

const reloadAllData = async () => {
    const [transactions, categories, subcategories, manualRules] =
        await Promise.all([
            getAll(STORE.transactions),
            getAll(STORE.categories),
            getAll(STORE.subcategories),
            getAll(STORE.manualRules)
        ]);

    appState.transactions = transactions;
    appState.categories = categories.sort(sortBySortOrder);
    appState.subcategories = subcategories.sort(sortBySortOrder);
    appState.manualRules = manualRules.sort(
        (left, right) => left.id - right.id
    );
};

const sortBySortOrder = (left, right) => {
    return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
};

const getElement = (id) => {
    return document.getElementById(id);
};

const createEntityId = (prefix) => {
    if (typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatMonthInputValue = (date) => {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0')
    ].join('-');
};

const formatCurrency = (amount) => {
    const formatted = `${Number(amount || 0).toLocaleString('ja-JP')}円`;

    if (appState.amountMasked) {
        return '████円';
    }

    return formatted;
};

const createElement = (tagName, className, textContent) => {
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    if (typeof textContent !== 'undefined') {
        element.textContent = textContent;
    }

    return element;
};

const showToast = (message) => {
    const toast = getElement('toastNotification');

    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(appState.toastTimer);
    appState.toastTimer = window.setTimeout(() => {
        toast.classList.remove('show');
    }, APP_CONFIG.toastDuration);
};

const applyPeriodModeUI = (mode) => {
    getElement('monthlyModeButton').classList.toggle(
        'active',
        mode === 'monthly'
    );
    getElement('rangeModeButton').classList.toggle('active', mode === 'range');
    getElement('monthlyPeriodControls').classList.toggle(
        'hidden',
        mode !== 'monthly'
    );
    getElement('rangePeriodControls').classList.toggle(
        'hidden',
        mode !== 'range'
    );
};

const setPeriodMode = (mode) => {
    appState.periodMode = mode;
    applyPeriodModeUI(mode);
    clearSelection();
    savePeriodToStorage();
    refreshDataView();
};

const moveSelectedMonth = (offset) => {
    const input = getElement('selectedMonthInput');
    const [year, month] = input.value.split('-').map(Number);
    const movedDate = new Date(year, month - 1 + offset, 1);

    input.value = formatMonthInputValue(movedDate);
    onPeriodChanged();
};

const onPeriodChanged = () => {
    clearSelection();
    savePeriodToStorage();
    refreshDataView();
};

const onFilterChanged = () => {
    clearSelection();
    renderTransactionTable();
};

const getCurrentPeriod = () => {
    if (appState.periodMode === 'monthly') {
        return {
            mode: 'monthly',
            month: getElement('selectedMonthInput').value
        };
    }

    return getRangePeriod();
};

const getRangePeriod = () => {
    const startMonth = getElement('rangeStartInput').value;
    const endMonth = getElement('rangeEndInput').value;

    if (startMonth <= endMonth) {
        return {
            mode: 'range',
            startMonth,
            endMonth
        };
    }

    return {
        mode: 'range',
        startMonth: endMonth,
        endMonth: startMonth
    };
};

const getPeriodTransactions = () => {
    return filterTransactionsByPeriod(
        appState.transactions,
        getCurrentPeriod()
    );
};

const getVisibleTransactions = () => {
    const filtered = filterTransactionsForView(getPeriodTransactions(), {
        searchText: getElement('merchantSearchInput').value,
        categoryId: getElement('categoryFilterSelect').value,
        status: getElement('statusFilterSelect').value
    });

    return sortTransactionsByDate(filtered);
};

const handleCsvImport = async (event) => {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    try {
        const parsed = parseExpenseCsv(
            decodeCsvBuffer(await file.arrayBuffer())
        );
        const importPlan = createCsvImportPlan(
            parsed,
            parseStatementKey(file.name)
        );

        await applyImportPlan(importPlan.deleteIds, importPlan.recordsToSave);
        await reloadAllData();
        showImportedPeriod(parsed.records);
        clearSelection();
        refreshAllViews();
        openImportResultModal(parsed, importPlan.statistics);
    } catch (error) {
        console.error('handleCsvImport失敗:', error);
        showToast(`CSV取込に失敗しました: ${error.message}`);
    } finally {
        event.target.value = '';
    }
};

const createCsvImportPlan = (parsed, statementKey) => {
    return buildImportPlan({
        incomingRecords: parsed.records,
        existingTransactions: appState.transactions,
        manualRules: appState.manualRules,
        sourceType: parsed.sourceType,
        statementKey,
        importedAt: new Date().toISOString(),
        importBatchId: createEntityId('import')
    });
};

const showImportedPeriod = (records) => {
    const latestMonth = records
        .map((record) => record.monthKey)
        .sort()
        .at(-1);

    getElement('selectedMonthInput').value = latestMonth;
    setPeriodMode('monthly');
};

const openImportResultModal = (parsed, statistics) => {
    getElement('importResultSummary').textContent =
        parsed.sourceType === 'confirmed' ? '確定明細' : '未確定明細';
    getElement('importResultDetails').replaceChildren(
        createImportResultContent(parsed, statistics)
    );
    getElement('importResultModal').classList.remove('hidden');
};

const createImportResultContent = (parsed, statistics) => {
    const container = createElement('div');
    const cards = createElement('div', 'import-result-grid');

    cards.appendChild(
        createImportResultCard('取込件数', parsed.records.length)
    );
    cards.appendChild(
        createImportResultCard('分類引継ぎ', statistics.inheritedCount)
    );
    cards.appendChild(
        createImportResultCard('自動分類', statistics.automaticCount)
    );
    cards.appendChild(createImportResultCard('不明', statistics.unknownCount));
    cards.appendChild(
        createImportResultCard('置換前件数', statistics.replacedCount)
    );
    cards.appendChild(
        createImportResultCard(
            '破棄した先頭行',
            parsed.discardedLeadingRowCount
        )
    );
    container.appendChild(cards);

    if (parsed.errors.length > 0) {
        container.appendChild(createImportErrorList(parsed.errors));
    }

    return container;
};

const createImportResultCard = (label, value) => {
    const card = createElement('div', 'import-result-card');

    card.appendChild(createElement('span', null, label));
    card.appendChild(createElement('strong', null, String(value)));
    return card;
};

const createImportErrorList = (errors) => {
    const list = createElement('div', 'import-error-list');

    errors.forEach((error) => {
        list.appendChild(createElement('div', null, error));
    });
    return list;
};

const closeImportResultModal = () => {
    getElement('importResultModal').classList.add('hidden');
};

const refreshAllViews = () => {
    renderCategoryFilterOptions();
    renderBulkCategoryOptions();
    renderSettingsLists();
    refreshDataView();
};

const toggleAmountMask = () => {
    appState.amountMasked = !appState.amountMasked;
    const button = getElement('toggleAmountMaskButton');

    button.textContent = appState.amountMasked
        ? '金額を表示'
        : '金額をモザイク';
    button.setAttribute('aria-pressed', String(appState.amountMasked));
    refreshDataView();
};

const refreshDataView = () => {
    const periodTransactions = getPeriodTransactions();
    const summary = buildSummary(
        periodTransactions,
        appState.categories,
        appState.subcategories
    );

    renderSummary(summary);
    renderChart(summary);
    renderTransactionTable();
};

const renderSummary = (summary) => {
    getElement('grandTotal').textContent = formatCurrency(summary.totalAmount);
    renderCategorySummary(summary.categories);
    renderUnknownSummary(summary);
};

const renderCategorySummary = (categorySummaries) => {
    const container = getElement('categorySummary');

    container.replaceChildren();
    categorySummaries.forEach((summary) => {
        container.appendChild(createCategorySummaryItem(summary));
    });
};

const createCategorySummaryItem = (summary) => {
    const item = createElement('div', 'category-summary-item');
    const main = createElement('div', 'category-summary-main');

    item.style.setProperty('--category-color', summary.color);
    main.appendChild(createElement('span', null, summary.name));
    main.appendChild(
        createElement('strong', null, formatCurrency(summary.amount))
    );
    item.appendChild(main);

    if (summary.subcategories.length > 0) {
        item.appendChild(createSubcategorySummary(summary.subcategories));
    }

    return item;
};

const createSubcategorySummary = (subcategories) => {
    const container = createElement('div', 'subcategory-summary');

    subcategories.forEach((subcategory) => {
        const row = createElement('span');

        row.appendChild(createElement('span', null, subcategory.name));
        row.appendChild(
            createElement('span', null, formatCurrency(subcategory.amount))
        );
        container.appendChild(row);
    });
    return container;
};

const renderUnknownSummary = (summary) => {
    const container = getElement('unknownSummary');

    container.classList.toggle('hidden', summary.unknownCount === 0);
    container.textContent = `不明 ${summary.unknownCount}件 / ${formatCurrency(
        summary.unknownAmount
    )}`;
};

const renderChart = (summary) => {
    const items = createChartItems(summary, APP_CONFIG.unknownColor);
    const pieItems = items.filter((item) => item.chartAmount > 0);
    const emptyMessage = createChartEmptyMessage(items);

    drawPieChart(pieItems, emptyMessage);
    renderChartLegend(items);
};

const drawPieChart = (items, emptyMessage) => {
    const canvas = getElement('categoryChart');
    const context = canvas.getContext('2d');
    const total = items.reduce((sum, item) => sum + item.chartAmount, 0);

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (total === 0) {
        drawEmptyChart(context, canvas, emptyMessage);
        return;
    }

    let startAngle = -Math.PI / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;

    items.forEach((item) => {
        const angle = (item.chartAmount / total) * Math.PI * 2;

        context.beginPath();
        context.moveTo(centerX, centerY);
        context.arc(centerX, centerY, radius, startAngle, startAngle + angle);
        context.closePath();
        context.fillStyle = item.color;
        context.fill();
        startAngle += angle;
    });
};

const drawEmptyChart = (context, canvas, message) => {
    context.fillStyle = '#68717c';
    context.font = '16px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, canvas.width / 2, canvas.height / 2);
};

const renderChartLegend = (items) => {
    const container = getElement('chartLegend');
    const total = items.reduce((sum, item) => sum + item.chartAmount, 0);

    container.replaceChildren();
    items.forEach((item) => {
        container.appendChild(createChartLegendItem(item, total));
    });
};

const createChartLegendItem = (item, total) => {
    const row = createElement('div', 'chart-legend-item');
    const color = createElement('span', 'chart-legend-color');

    color.style.setProperty('--legend-color', item.color);
    row.appendChild(color);
    row.appendChild(createElement('span', null, item.label));
    row.appendChild(
        createElement(
            'span',
            null,
            `${formatCurrency(item.amount)} (${createChartLegendRatio(
                item,
                total
            )})`
        )
    );
    return row;
};

const renderTransactionTable = () => {
    const transactions = getVisibleTransactions();
    const tableBody = getElement('transactionTableBody');

    tableBody.replaceChildren();
    transactions.forEach((transaction) => {
        tableBody.appendChild(createTransactionRow(transaction));
    });
    getElement('emptyState').classList.toggle(
        'hidden',
        transactions.length > 0
    );
    updateSelectAllCheckbox(transactions);
    updateSelectedCountLabel();
};

const createTransactionRow = (transaction) => {
    const row = document.createElement('tr');

    row.dataset.transactionId = String(transaction.id);
    row.classList.toggle(
        'transaction-unknown',
        isTransactionUnknown(transaction)
    );
    row.addEventListener('click', () => {
        toggleTransactionSelection(
            transaction.id,
            !appState.selectedIds.has(transaction.id)
        );
        const checkbox = row.querySelector('input[type="checkbox"]');

        if (checkbox) {
            checkbox.checked = appState.selectedIds.has(transaction.id);
        }
    });
    row.appendChild(createSelectionCell(transaction));
    row.appendChild(
        createElement('td', null, transaction.usedAt.replaceAll('-', '/'))
    );
    row.appendChild(createElement('td', 'merchant-cell', transaction.merchant));
    row.appendChild(
        createElement('td', 'amount-cell', formatCurrency(transaction.amount))
    );
    row.appendChild(createClassificationCell(transaction));
    row.appendChild(createStatusCell(transaction));
    row.appendChild(createEditCell(transaction));
    return row;
};

const createSelectionCell = (transaction) => {
    const cell = createElement('td', 'checkbox-column');
    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';
    checkbox.checked = appState.selectedIds.has(transaction.id);
    checkbox.addEventListener('click', (event) => {
        event.stopPropagation();
    });
    checkbox.addEventListener('change', () => {
        toggleTransactionSelection(transaction.id, checkbox.checked);
    });
    cell.appendChild(checkbox);
    return cell;
};

const createClassificationCell = (transaction) => {
    const cell = createElement('td', 'classification-cell');

    if (isTransactionUnknown(transaction)) {
        cell.appendChild(
            createElement('strong', 'classification-primary', '不明')
        );
        return cell;
    }

    if (transaction.allocations.length === 1) {
        appendSingleClassification(cell, transaction.allocations[0]);
        return cell;
    }

    cell.appendChild(
        createElement(
            'span',
            'classification-primary',
            `${transaction.allocations.length}件に按分`
        )
    );
    transaction.allocations.forEach((allocation) => {
        cell.appendChild(
            createElement(
                'span',
                'classification-secondary',
                `${getAllocationLabel(allocation)}: ${formatCurrency(allocation.amount)}`
            )
        );
    });
    return cell;
};

const appendSingleClassification = (cell, allocation) => {
    cell.appendChild(
        createElement(
            'span',
            'classification-primary',
            getAllocationLabel(allocation)
        )
    );
};

const getAllocationLabel = (allocation) => {
    const category = appState.categories.find((item) => {
        return item.id === allocation.categoryId;
    });
    const subcategory = appState.subcategories.find((item) => {
        return item.id === allocation.subcategoryId;
    });

    if (!subcategory) {
        return category?.name || '削除済みカテゴリ';
    }

    return `${category?.name || '削除済みカテゴリ'} / ${subcategory.name}`;
};

const createStatusCell = (transaction) => {
    const cell = document.createElement('td');
    const status = getClassificationStatus(transaction);

    cell.appendChild(
        createElement('span', `status-badge ${status.className}`, status.label)
    );
    return cell;
};

const getClassificationStatus = (transaction) => {
    if (
        transaction.classificationSource ===
        CLASSIFICATION_SOURCE.MANUAL_REQUIRED
    ) {
        return {
            className: 'status-manual-required',
            label: '要手動'
        };
    }

    if (isTransactionUnknown(transaction)) {
        return {
            className: 'status-unknown',
            label: '不明'
        };
    }

    if (transaction.classificationSource === CLASSIFICATION_SOURCE.AUTOMATIC) {
        return {
            className: 'status-automatic',
            label: '自動'
        };
    }

    return {
        className: 'status-manual',
        label: '手動'
    };
};

const createEditCell = (transaction) => {
    const cell = createElement('td', 'action-column');
    const button = createElement('button', 'edit-button', '編集');

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        openTransactionModal(transaction.id);
    });
    cell.appendChild(button);
    return cell;
};

const toggleTransactionSelection = (transactionId, selected) => {
    if (selected) {
        appState.selectedIds.add(transactionId);
    } else {
        appState.selectedIds.delete(transactionId);
    }

    updateSelectAllCheckbox(getVisibleTransactions());
    updateSelectedCountLabel();
};

const toggleSelectAll = (event) => {
    getVisibleTransactions().forEach((transaction) => {
        if (event.target.checked) {
            appState.selectedIds.add(transaction.id);
        } else {
            appState.selectedIds.delete(transaction.id);
        }
    });
    renderTransactionTable();
};

const updateSelectAllCheckbox = (transactions) => {
    const checkbox = getElement('selectAllCheckbox');
    const selectedCount = transactions.filter((transaction) => {
        return appState.selectedIds.has(transaction.id);
    }).length;

    checkbox.checked =
        transactions.length > 0 && selectedCount === transactions.length;
    checkbox.indeterminate =
        selectedCount > 0 && selectedCount < transactions.length;
};

const updateSelectedCountLabel = () => {
    getElement('selectedCountLabel').textContent =
        `${appState.selectedIds.size}件選択`;
};

const clearSelection = () => {
    appState.selectedIds.clear();
    getElement('selectAllCheckbox').checked = false;
    getElement('selectAllCheckbox').indeterminate = false;
    updateSelectedCountLabel();

    if (getElement('transactionTableBody').children.length > 0) {
        renderTransactionTable();
    }
};

const renderCategoryFilterOptions = () => {
    const select = getElement('categoryFilterSelect');
    const currentValue = select.value || 'all';

    select.replaceChildren(new Option('すべてのカテゴリ', 'all'));
    select.add(new Option('不明', 'unknown'));
    appState.categories.forEach((category) => {
        select.add(new Option(category.name, category.id));
    });
    select.value = hasOption(select, currentValue) ? currentValue : 'all';
};

const renderBulkCategoryOptions = () => {
    const select = getElement('bulkCategorySelect');
    const currentValue = select.value;

    select.replaceChildren(new Option('カテゴリを選択', ''));
    appState.categories.forEach((category) => {
        select.add(new Option(category.name, category.id));
    });
    select.value = hasOption(select, currentValue) ? currentValue : '';
    renderBulkSubcategoryOptions();
};

const renderBulkSubcategoryOptions = () => {
    const categoryId = getElement('bulkCategorySelect').value;
    const select = getElement('bulkSubcategorySelect');

    select.replaceChildren(new Option('サブカテゴリなし', ''));
    getSubcategoriesByCategory(categoryId).forEach((subcategory) => {
        select.add(new Option(subcategory.name, subcategory.id));
    });
    select.disabled = !categoryId;
};

const hasOption = (select, value) => {
    return [...select.options].some((option) => option.value === value);
};

const applyBulkCategory = async () => {
    const categoryId = getElement('bulkCategorySelect').value;

    if (appState.selectedIds.size === 0) {
        showToast('分類する明細を選択してください');
        return;
    }

    if (!categoryId) {
        showToast('カテゴリを選択してください');
        return;
    }

    try {
        const updatedTransactions = createBulkUpdatedTransactions(categoryId);

        await putTransactions(updatedTransactions);
        await reloadAllData();
        appState.selectedIds.clear();
        refreshAllViews();
        showToast(`${updatedTransactions.length}件を分類しました`);
    } catch (error) {
        console.error('applyBulkCategory失敗:', error);
        showToast(`一括分類に失敗しました: ${error.message}`);
    }
};

const createBulkUpdatedTransactions = (categoryId) => {
    const subcategoryId = getElement('bulkSubcategorySelect').value || null;

    return appState.transactions
        .filter((transaction) => appState.selectedIds.has(transaction.id))
        .map((transaction) => ({
            ...transaction,
            allocations: [
                {
                    categoryId,
                    subcategoryId,
                    amount: transaction.amount
                }
            ],
            classificationSource: CLASSIFICATION_SOURCE.MANUAL
        }));
};

const openTransactionModal = (transactionId) => {
    const transaction = getTransactionById(transactionId);

    if (!transaction) {
        showToast('明細が見つかりません');
        return;
    }

    appState.editingTransactionId = transactionId;
    getElement('transactionModalSummary').textContent = [
        transaction.usedAt.replaceAll('-', '/'),
        transaction.merchant,
        formatCurrency(transaction.amount)
    ].join(' / ');
    renderAllocationRows(transaction);
    getElement('transactionModal').classList.remove('hidden');
};

const getTransactionById = (transactionId) => {
    return appState.transactions.find((transaction) => {
        return transaction.id === transactionId;
    });
};

const renderAllocationRows = (transaction) => {
    const rows = getElement('allocationRows');
    const allocations = transaction.allocations?.length
        ? transaction.allocations
        : [
              {
                  categoryId: '',
                  subcategoryId: null,
                  amount: transaction.amount
              }
          ];

    rows.replaceChildren();
    allocations.forEach((allocation) => {
        appendAllocationRow(allocation);
    });
    updateAllocationTotal();
};

const appendAllocationRow = (allocation) => {
    const row = createElement('div', 'allocation-row');
    const categorySelect = createAllocationCategorySelect(
        allocation?.categoryId || ''
    );
    const subcategorySelect = createAllocationSubcategorySelect(
        allocation?.categoryId || '',
        allocation?.subcategoryId || ''
    );
    const amountInput = createAllocationAmountInput(allocation?.amount || 0);
    const removeButton = createElement(
        'button',
        'allocation-remove-button',
        '×'
    );

    categorySelect.addEventListener('change', () => {
        replaceAllocationSubcategorySelect(row, categorySelect.value);
    });
    amountInput.addEventListener('input', updateAllocationTotal);
    removeButton.type = 'button';
    removeButton.addEventListener('click', () => {
        row.remove();
        updateAllocationTotal();
    });
    row.append(categorySelect, subcategorySelect, amountInput, removeButton);
    getElement('allocationRows').appendChild(row);
};

const createAllocationCategorySelect = (selectedCategoryId) => {
    const select = document.createElement('select');

    select.className = 'allocation-category-select';
    select.add(new Option('カテゴリを選択', ''));
    appState.categories.forEach((category) => {
        select.add(
            new Option(
                category.name,
                category.id,
                false,
                category.id === selectedCategoryId
            )
        );
    });
    return select;
};

const createAllocationSubcategorySelect = (
    categoryId,
    selectedSubcategoryId
) => {
    const select = document.createElement('select');

    select.className = 'allocation-subcategory-select';
    select.add(new Option('サブカテゴリなし', ''));
    getSubcategoriesByCategory(categoryId).forEach((subcategory) => {
        select.add(
            new Option(
                subcategory.name,
                subcategory.id,
                false,
                subcategory.id === selectedSubcategoryId
            )
        );
    });
    select.disabled = !categoryId;
    return select;
};

const createAllocationAmountInput = (amount) => {
    const input = document.createElement('input');
    const transactionAmount = getEditingTransaction()?.amount || amount;

    input.className = 'allocation-amount-input';
    input.type = 'number';
    input.step = '1';
    input.inputMode = transactionAmount < 0 ? 'decimal' : 'numeric';
    input.value = String(amount || 0);

    if (transactionAmount < 0) {
        input.max = '-1';
    } else {
        input.min = '1';
    }

    return input;
};

const replaceAllocationSubcategorySelect = (row, categoryId) => {
    const currentSelect = row.querySelector('.allocation-subcategory-select');

    currentSelect.replaceWith(
        createAllocationSubcategorySelect(categoryId, '')
    );
};

const equalizeAllocationAmounts = () => {
    const transaction = getEditingTransaction();
    const inputs = [...document.querySelectorAll('.allocation-amount-input')];

    if (!transaction || inputs.length === 0) {
        return;
    }

    createEqualAllocationAmounts(transaction.amount, inputs.length).forEach(
        (amount, index) => {
            inputs[index].value = String(amount);
        }
    );
    updateAllocationTotal();
};

const getEditingTransaction = () => {
    return getTransactionById(appState.editingTransactionId);
};

const updateAllocationTotal = () => {
    const transaction = getEditingTransaction();
    const total = [
        ...document.querySelectorAll('.allocation-amount-input')
    ].reduce((sum, input) => sum + (Number.parseInt(input.value, 10) || 0), 0);
    const difference = transaction ? transaction.amount - total : 0;
    const differenceElement = getElement('allocationDifference');

    getElement('allocationTotal').textContent = formatCurrency(total);
    differenceElement.textContent =
        difference === 0 ? '一致' : `差額 ${formatCurrency(difference)}`;
    differenceElement.classList.toggle('invalid', difference !== 0);
};

const readAllocationRows = () => {
    return [
        ...getElement('allocationRows').querySelectorAll('.allocation-row')
    ].map((row) => ({
        categoryId: row.querySelector('.allocation-category-select').value,
        subcategoryId:
            row.querySelector('.allocation-subcategory-select').value || null,
        amount: Number.parseInt(
            row.querySelector('.allocation-amount-input').value,
            10
        )
    }));
};

const saveTransactionClassification = async () => {
    const transaction = getEditingTransaction();
    const allocations = readAllocationRows();

    if (!transaction) {
        return;
    }

    if (!validateAllocations(transaction.amount, allocations)) {
        showToast('按分合計を明細金額と一致させてください');
        return;
    }

    try {
        await put(STORE.transactions, {
            ...transaction,
            allocations,
            classificationSource: CLASSIFICATION_SOURCE.MANUAL
        });
        await reloadAllData();
        closeTransactionModal();
        refreshAllViews();
        showToast('分類を保存しました');
    } catch (error) {
        console.error('saveTransactionClassification失敗:', error);
        showToast(`分類の保存に失敗しました: ${error.message}`);
    }
};

const markTransactionUnknown = async () => {
    const transaction = getEditingTransaction();

    if (!transaction) {
        return;
    }

    try {
        await put(STORE.transactions, {
            ...transaction,
            allocations: [],
            classificationSource: requiresManualClassification(
                transaction.merchant,
                appState.manualRules
            )
                ? CLASSIFICATION_SOURCE.MANUAL_REQUIRED
                : CLASSIFICATION_SOURCE.UNKNOWN
        });
        await reloadAllData();
        closeTransactionModal();
        refreshAllViews();
        showToast('明細を不明へ戻しました');
    } catch (error) {
        console.error('markTransactionUnknown失敗:', error);
        showToast(`更新に失敗しました: ${error.message}`);
    }
};

const closeTransactionModal = () => {
    appState.editingTransactionId = null;
    getElement('transactionModal').classList.add('hidden');
};

const openSettingsModal = () => {
    renderSettingsLists();
    getElement('settingsModal').classList.remove('hidden');
};

const closeSettingsModal = () => {
    getElement('settingsModal').classList.add('hidden');
};

const renderSettingsLists = () => {
    renderCategorySettings();
    renderSubcategoryParentOptions();
    renderSubcategorySettings();
    renderManualRuleSettings();
};

const renderCategorySettings = () => {
    const container = getElement('categorySettingsList');

    container.replaceChildren();
    appState.categories.forEach((category) => {
        container.appendChild(createCategorySettingItem(category));
    });
};

const createCategorySettingItem = (category) => {
    const item = createElement('div', 'settings-item');
    const main = createElement('div', 'settings-item-main');
    const color = createElement('span', 'category-color-dot');

    color.style.setProperty('--category-color', category.color);
    main.append(color, createElement('strong', null, category.name));
    item.appendChild(main);
    item.appendChild(
        createSettingButton('名前変更', () => renameCategory(category))
    );
    item.appendChild(
        createSettingButton(
            '削除',
            () => deleteCategory(category),
            'delete-setting-button'
        )
    );
    return item;
};

const createSettingButton = (label, onClick, className = '') => {
    const button = createElement('button', className, label);

    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
};

const addCategory = async (event) => {
    event.preventDefault();
    const input = getElement('categoryNameInput');
    const name = input.value.trim();

    if (!name || categoryNameExists(name)) {
        showToast('未使用のカテゴリ名を入力してください');
        return;
    }

    try {
        await put(STORE.categories, createCategoryRecord(name));
        input.value = '';
        await reloadAllData();
        refreshAllViews();
        showToast('カテゴリを追加しました');
    } catch (error) {
        console.error('addCategory失敗:', error);
        showToast(`カテゴリ追加に失敗しました: ${error.message}`);
    }
};

const createCategoryRecord = (name) => {
    const nextSortOrder =
        appState.categories.length === 0
            ? 0
            : Math.max(
                  ...appState.categories.map((category) => category.sortOrder)
              ) + 1;

    return {
        id: createEntityId('category'),
        name,
        color: APP_CONFIG.categoryPalette[
            appState.categories.length % APP_CONFIG.categoryPalette.length
        ],
        sortOrder: nextSortOrder
    };
};

const categoryNameExists = (name, excludedId = null) => {
    return appState.categories.some((category) => {
        return category.id !== excludedId && category.name === name;
    });
};

const renameCategory = async (category) => {
    const name = window.prompt('新しいカテゴリ名', category.name)?.trim();

    if (!name) {
        return;
    }

    if (categoryNameExists(name, category.id)) {
        showToast('同名のカテゴリが存在します');
        return;
    }

    try {
        await put(STORE.categories, { ...category, name });
        await reloadAllData();
        refreshAllViews();
        showToast('カテゴリ名を変更しました');
    } catch (error) {
        console.error('renameCategory失敗:', error);
        showToast(`カテゴリ名変更に失敗しました: ${error.message}`);
    }
};

const deleteCategory = async (category) => {
    if (isCategoryInUse(category.id)) {
        showToast('使用中のカテゴリは削除できません');
        return;
    }

    if (!window.confirm(`カテゴリ「${category.name}」を削除しますか？`)) {
        return;
    }

    try {
        await deleteCategoryAndSubcategories(category.id);
        await reloadAllData();
        refreshAllViews();
        showToast('カテゴリを削除しました');
    } catch (error) {
        console.error('deleteCategory失敗:', error);
        showToast(`カテゴリ削除に失敗しました: ${error.message}`);
    }
};

const isCategoryInUse = (categoryId) => {
    return appState.transactions.some((transaction) => {
        return transaction.allocations?.some((allocation) => {
            return allocation.categoryId === categoryId;
        });
    });
};

const deleteCategoryAndSubcategories = async (categoryId) => {
    const subcategories = getSubcategoriesByCategory(categoryId);

    await Promise.all(
        subcategories.map((subcategory) => {
            return remove(STORE.subcategories, subcategory.id);
        })
    );
    await remove(STORE.categories, categoryId);
};

const renderSubcategoryParentOptions = () => {
    const select = getElement('subcategoryParentSelect');
    const currentValue = select.value;

    select.replaceChildren();
    appState.categories.forEach((category) => {
        select.add(new Option(category.name, category.id));
    });
    select.value = hasOption(select, currentValue)
        ? currentValue
        : appState.categories[0]?.id || '';
};

const renderSubcategorySettings = () => {
    const container = getElement('subcategorySettingsList');

    container.replaceChildren();
    appState.subcategories.forEach((subcategory) => {
        container.appendChild(createSubcategorySettingItem(subcategory));
    });
};

const createSubcategorySettingItem = (subcategory) => {
    const item = createElement('div', 'settings-item');
    const category = appState.categories.find((candidate) => {
        return candidate.id === subcategory.categoryId;
    });

    item.appendChild(
        createElement(
            'div',
            'settings-item-main',
            `${category?.name || '削除済み'} / ${subcategory.name}`
        )
    );
    item.appendChild(
        createSettingButton('名前変更', () => renameSubcategory(subcategory))
    );
    item.appendChild(
        createSettingButton(
            '削除',
            () => deleteSubcategory(subcategory),
            'delete-setting-button'
        )
    );
    return item;
};

const addSubcategory = async (event) => {
    event.preventDefault();
    const nameInput = getElement('subcategoryNameInput');
    const categoryId = getElement('subcategoryParentSelect').value;
    const name = nameInput.value.trim();

    if (!categoryId || !name || subcategoryNameExists(categoryId, name)) {
        showToast('未使用のサブカテゴリ名を入力してください');
        return;
    }

    try {
        await put(
            STORE.subcategories,
            createSubcategoryRecord(categoryId, name)
        );
        nameInput.value = '';
        await reloadAllData();
        refreshAllViews();
        showToast('サブカテゴリを追加しました');
    } catch (error) {
        console.error('addSubcategory失敗:', error);
        showToast(`サブカテゴリ追加に失敗しました: ${error.message}`);
    }
};

const createSubcategoryRecord = (categoryId, name) => {
    const siblings = getSubcategoriesByCategory(categoryId);
    const sortOrder =
        siblings.length === 0
            ? 0
            : Math.max(
                  ...siblings.map((subcategory) => subcategory.sortOrder)
              ) + 1;

    return {
        id: createEntityId('subcategory'),
        categoryId,
        name,
        sortOrder
    };
};

const getSubcategoriesByCategory = (categoryId) => {
    return appState.subcategories.filter((subcategory) => {
        return subcategory.categoryId === categoryId;
    });
};

const subcategoryNameExists = (categoryId, name, excludedId = null) => {
    return appState.subcategories.some((subcategory) => {
        return (
            subcategory.id !== excludedId &&
            subcategory.categoryId === categoryId &&
            subcategory.name === name
        );
    });
};

const renameSubcategory = async (subcategory) => {
    const name = window
        .prompt('新しいサブカテゴリ名', subcategory.name)
        ?.trim();

    if (!name) {
        return;
    }

    if (subcategoryNameExists(subcategory.categoryId, name, subcategory.id)) {
        showToast('同名のサブカテゴリが存在します');
        return;
    }

    try {
        await put(STORE.subcategories, { ...subcategory, name });
        await reloadAllData();
        refreshAllViews();
        showToast('サブカテゴリ名を変更しました');
    } catch (error) {
        console.error('renameSubcategory失敗:', error);
        showToast(`サブカテゴリ名変更に失敗しました: ${error.message}`);
    }
};

const deleteSubcategory = async (subcategory) => {
    if (isSubcategoryInUse(subcategory.id)) {
        showToast('使用中のサブカテゴリは削除できません');
        return;
    }

    if (
        !window.confirm(`サブカテゴリ「${subcategory.name}」を削除しますか？`)
    ) {
        return;
    }

    try {
        await remove(STORE.subcategories, subcategory.id);
        await reloadAllData();
        refreshAllViews();
        showToast('サブカテゴリを削除しました');
    } catch (error) {
        console.error('deleteSubcategory失敗:', error);
        showToast(`サブカテゴリ削除に失敗しました: ${error.message}`);
    }
};

const isSubcategoryInUse = (subcategoryId) => {
    return appState.transactions.some((transaction) => {
        return transaction.allocations?.some((allocation) => {
            return allocation.subcategoryId === subcategoryId;
        });
    });
};

const renderManualRuleSettings = () => {
    const container = getElement('manualRuleList');

    container.replaceChildren();
    appState.manualRules.forEach((rule) => {
        container.appendChild(createManualRuleSettingItem(rule));
    });
};

const createManualRuleSettingItem = (rule) => {
    const item = createElement('div', 'settings-item');
    const main = createElement('div', 'settings-item-main');
    const enabledCheckbox = document.createElement('input');

    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.checked = rule.enabled;
    enabledCheckbox.addEventListener('change', () => {
        updateManualRuleEnabled(rule, enabledCheckbox.checked);
    });
    main.append(
        enabledCheckbox,
        createElement(
            'span',
            null,
            `${rule.pattern}（${rule.matchType === 'contains' ? '部分一致' : '完全一致'}）`
        )
    );
    item.appendChild(main);
    item.appendChild(createElement('span'));
    item.appendChild(
        createSettingButton(
            '削除',
            () => deleteManualRule(rule),
            'delete-setting-button'
        )
    );
    return item;
};

const addManualRule = async (event) => {
    event.preventDefault();
    const patternInput = getElement('manualRulePatternInput');
    const pattern = patternInput.value.trim();
    const matchType = getElement('manualRuleMatchTypeSelect').value;

    if (!pattern) {
        return;
    }

    try {
        await put(STORE.manualRules, {
            pattern,
            matchType,
            enabled: true
        });
        patternInput.value = '';
        await reloadAllData();
        refreshAllViews();
        showToast('手動分類ルールを追加しました');
    } catch (error) {
        console.error('addManualRule失敗:', error);
        showToast(`ルール追加に失敗しました: ${error.message}`);
    }
};

const updateManualRuleEnabled = async (rule, enabled) => {
    try {
        await put(STORE.manualRules, { ...rule, enabled });
        await reloadAllData();
        renderManualRuleSettings();
    } catch (error) {
        console.error('updateManualRuleEnabled失敗:', error);
        showToast(`ルール更新に失敗しました: ${error.message}`);
    }
};

const deleteManualRule = async (rule) => {
    try {
        await remove(STORE.manualRules, rule.id);
        await reloadAllData();
        renderManualRuleSettings();
        showToast('手動分類ルールを削除しました');
    } catch (error) {
        console.error('deleteManualRule失敗:', error);
        showToast(`ルール削除に失敗しました: ${error.message}`);
    }
};

const deleteAllData = async () => {
    if (!window.confirm('全明細と設定を削除しますか？')) {
        return;
    }

    try {
        await clearAllData();
        await reloadAllData();
        appState.selectedIds.clear();
        closeSettingsModal();
        refreshAllViews();
        showToast('全データを削除しました');
    } catch (error) {
        console.error('deleteAllData失敗:', error);
        showToast(`全データ削除に失敗しました: ${error.message}`);
    }
};

const exportBackup = async () => {
    try {
        const backup = buildBackupData({
            transactions: appState.transactions,
            categories: appState.categories,
            subcategories: appState.subcategories,
            manualRules: appState.manualRules,
            exportedAt: new Date().toISOString()
        });

        const handle = await window.showSaveFilePicker({
            suggestedName: APP_CONFIG.backupFilename,
            types: [
                {
                    description: 'JSON File',
                    accept: { 'application/json': ['.json'] }
                }
            ]
        });
        const writable = await handle.createWritable();

        await writable.write(JSON.stringify(backup, null, 2));
        await writable.close();
        showToast('バックアップを保存しました');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('exportBackup失敗:', error);
            showToast(`バックアップ保存に失敗しました: ${error.message}`);
        }
    }
};

const importBackup = async () => {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [
                {
                    description: 'JSON File',
                    accept: { 'application/json': ['.json'] }
                }
            ]
        });
        const file = await handle.getFile();
        const backupData = validateBackupData(JSON.parse(await file.text()));

        if (!backupData) {
            throw new Error('バックアップ形式が不正です');
        }

        if (!window.confirm('既存データをバックアップ内容で置き換えますか？')) {
            return;
        }

        await replaceAllData(backupData);
        await reloadAllData();
        appState.selectedIds.clear();
        refreshAllViews();
        showToast('バックアップから復元しました');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('importBackup失敗:', error);
            showToast(`復元に失敗しました: ${error.message}`);
        }
    }
};

initApp();
