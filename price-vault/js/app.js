const DB = {
    NAME: 'PriceVaultDB',
    VERSION: 1,
    STORE: 'products'
};

const TIMING = {
    TOAST_DURATION: 2500
};

const BACKUP_FILENAME = 'price-vault.json';
const NEW_CATEGORY_VALUE = '__new_category__';
const UNCATEGORIZED = '未分類';

const TOAST = {
    SAVED: '商品を登録しました',
    UPDATED: '履歴を追加しました',
    INPUT_INVALID: 'エラー: 商品名・値段・日付は必須です',
    HISTORY_UPDATED: '履歴を更新しました',
    DELETED: '記録を削除しました',
    IMPORTED: 'バックアップからデータを復元しました',
    IMPORT_FAIL: 'エラー: 不正なファイル構造です',
    SAVED_FILE: 'ファイルを保存しました',
    SAVE_FAIL: 'エラー: 保存に失敗しました'
};

let db = null;

const viewState = {
    selectedCategory: 'all',
    sortKey: 'name',
    openDetailId: null
};

const editState = {
    editingProductId: null,
    editingHistoryIndex: null
};

const uiState = {
    toastTimer: null
};

const {
    calcPriceSummary,
    getAllStores,
    sortHistories,
    sortProducts,
    filterByCategory,
    isValidProductInput,
    isValidHistoryInput,
    buildNewProduct,
    buildNewHistory,
    appendProductHistory,
    removeProductHistory,
    updateProductHistory,
    reorderProducts
} = window.PRICE_LOGIC;
const { extractCategories, countProductsByCategory } = window.CATEGORY_LOGIC;
const { validateImportData } = window.EXPORT_LOGIC;

const getAllProducts = () => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readonly');
        const req = tx.objectStore(DB.STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
};

const getProduct = (id) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readonly');
        const req = tx.objectStore(DB.STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
};

const putProduct = (product) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readwrite');
        tx.objectStore(DB.STORE).put(product);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const deleteProductDb = (id) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readwrite');
        tx.objectStore(DB.STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const clearProducts = () => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readwrite');
        tx.objectStore(DB.STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const showToast = (message) => {
    const toast = document.getElementById('toastNotification');
    toast.innerText = message;
    toast.classList.add('show');

    if (uiState.toastTimer) clearTimeout(uiState.toastTimer);
    uiState.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, TIMING.TOAST_DURATION);
};

const todayStr = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

// 「すべて」選択時は未分類をデフォルトに
const defaultCategoryFromTab = () => {
    return viewState.selectedCategory === 'all'
        ? UNCATEGORIZED
        : viewState.selectedCategory;
};

const toggleDetails = (id) => {
    viewState.openDetailId = viewState.openDetailId === id ? null : id;
    const el = document.getElementById(`details-${id}`);
    if (el) el.classList.toggle('hidden');
};

const renderCategoryTabs = async () => {
    const products = await getAllProducts();
    const container = document.getElementById('filterContainer');
    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className =
        'filter-btn' + (viewState.selectedCategory === 'all' ? ' active' : '');
    allBtn.dataset.filter = 'all';
    allBtn.innerText = `すべて (${products.length})`;
    allBtn.addEventListener('click', () => selectCategory('all'));
    container.appendChild(allBtn);

    extractCategories(products).forEach((cat) => {
        const btn = document.createElement('button');
        btn.className =
            'filter-btn' +
            (viewState.selectedCategory === cat ? ' active' : '');
        btn.dataset.filter = cat;
        btn.innerText = `${cat} (${countProductsByCategory(products, cat)})`;
        btn.addEventListener('click', () => selectCategory(cat));
        container.appendChild(btn);
    });

    updateCategorySelect();
};

const selectCategory = (category) => {
    viewState.selectedCategory = category;
    refreshDataView();
};

const updateCategorySelect = async () => {
    const products = await getAllProducts();
    const select = document.getElementById('inputCategory');
    const current = defaultCategoryFromTab();

    select.innerHTML = '';
    extractCategories(products).forEach((cat) => {
        select.add(new Option(cat, cat, false, cat === current));
    });
    if (!extractCategories(products).includes(current)) {
        select.add(new Option(current, current, true, true));
    }
    select.add(new Option('＋ 新規カテゴリ追加', NEW_CATEGORY_VALUE));

    document.getElementById('inputCategoryNew').classList.add('hidden');
    document.getElementById('inputCategoryNew').value = '';
};

const onCategorySelectChange = () => {
    const select = document.getElementById('inputCategory');
    const isNew = select.value === NEW_CATEGORY_VALUE;
    const newInput = document.getElementById('inputCategoryNew');
    if (isNew) {
        newInput.classList.remove('hidden');
        newInput.focus();
    } else {
        newInput.classList.add('hidden');
        newInput.value = '';
    }
};

const readFormHistory = () => {
    const price = document.getElementById('inputPrice').value.trim();
    const date = document.getElementById('inputDate').value || todayStr();
    return buildNewHistory({
        price,
        store: document.getElementById('inputStore').value.trim(),
        unitPrice: document.getElementById('inputUnitPrice').value.trim(),
        date,
        memo: document.getElementById('inputMemo').value
    });
};

const readFormCategory = () => {
    const select = document.getElementById('inputCategory');
    if (select.value === NEW_CATEGORY_VALUE) {
        const v = document.getElementById('inputCategoryNew').value.trim();
        return v || UNCATEGORIZED;
    }
    return select.value;
};

// 買った店は連続登録のため残す
const resetForm = () => {
    document.getElementById('inputName').value = '';
    document.getElementById('inputPrice').value = '';
    document.getElementById('inputUnitPrice').value = '';
    document.getElementById('inputMemo').value = '';
    document.getElementById('inputDate').value = todayStr();
    updateCategorySelect();
    document.getElementById('inputName').focus();
};

const saveProduct = async () => {
    const name = document.getElementById('inputName').value.trim();
    const priceRaw = document.getElementById('inputPrice').value.trim();
    const date = document.getElementById('inputDate').value || todayStr();

    if (!isValidProductInput(name) || !isValidHistoryInput(priceRaw, date)) {
        showToast(TOAST.INPUT_INVALID);
        return;
    }

    const history = readFormHistory();
    const category = readFormCategory();
    const products = await getAllProducts();
    const existing = products.find((p) => p.name.trim() === name);

    if (existing) {
        await putProduct(appendProductHistory(existing, history));
        showToast(TOAST.UPDATED);
    } else {
        const product = buildNewProduct(
            { name, category, sortOrder: products.length, children: [history] },
            Date.now()
        );
        await putProduct(product);
        showToast(TOAST.SAVED);
    }

    resetForm();
    refreshDataView();
};

const createPriceSpan = (value, cls) => {
    const span = document.createElement('span');
    if (value === null) {
        span.className = 'price-empty';
        span.textContent = '—';
    } else {
        span.className = cls;
        span.textContent = '¥' + value;
    }
    return span;
};

const createMinStoreSpans = (stores) => {
    if (stores.length === 0) return null;
    return stores.map((s) => {
        const span = document.createElement('span');
        span.className = 'min-store';
        span.textContent = s;
        return span;
    });
};

const createProductRow = (product) => {
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.setAttribute('data-id', product.id);

    const summary = calcPriceSummary(product.children);
    const minStoreSpans = createMinStoreSpans(
        getAllStores(summary.minHistories)
    );

    const tdName = document.createElement('td');
    tdName.className = 'name-cell';
    tdName.innerText = product.name;
    tr.appendChild(tdName);

    const tdMin = document.createElement('td');
    tdMin.appendChild(createPriceSpan(summary.min, 'price-min'));
    tr.appendChild(tdMin);

    const tdMax = document.createElement('td');
    tdMax.appendChild(createPriceSpan(summary.max, 'price-max'));
    tr.appendChild(tdMax);

    const tdCat = document.createElement('td');
    tdCat.innerText = product.category || UNCATEGORIZED;
    tr.appendChild(tdCat);

    const tdStores = document.createElement('td');
    tdStores.className = 'stores-cell';
    if (minStoreSpans) {
        minStoreSpans.forEach((span, i) => {
            if (i > 0) tdStores.appendChild(document.createTextNode(' / '));
            tdStores.appendChild(span);
        });
    } else {
        tdStores.innerText = '—';
    }
    tr.appendChild(tdStores);

    const tdDate = document.createElement('td');
    tdDate.className = 'date-cell';
    tdDate.innerText = summary.latestMinDate || '—';
    tr.appendChild(tdDate);

    const tdDel = document.createElement('td');
    tdDel.className = 'delete-cell';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-row';
    delBtn.title = 'この商品を削除（履歴も一括削除）';
    delBtn.innerText = '×';
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteProduct(product.id);
    });
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        toggleDetails(product.id);
    });

    return tr;
};

const makeTextCell = (text, cls = '') => {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    return td;
};

const makePriceCell = (price, isMin, isMax) => {
    const td = document.createElement('td');
    if (isMin) td.className = 'price-min';
    else if (isMax) td.className = 'price-max';
    td.textContent = '¥' + price;
    return td;
};

const makeStoreCell = (store, isMin) => {
    const td = document.createElement('td');
    const txt = store || '—';
    if (isMin && store) {
        const span = document.createElement('span');
        span.className = 'min-store';
        span.textContent = txt;
        td.appendChild(span);
    } else {
        td.textContent = txt;
    }
    return td;
};

const makeHistoryDeleteCell = (productId, idx) => {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-row';
    delBtn.title = 'この履歴を削除';
    delBtn.innerText = '×';
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistory(productId, idx);
    });
    const td = document.createElement('td');
    td.className = 'delete-cell';
    td.appendChild(delBtn);
    return td;
};

const createHistoryRow = (h, idx, productId, isMin, isMax) => {
    const row = document.createElement('tr');
    row.addEventListener('click', () => openHistoryModal(productId, idx));

    const cells = [
        makeTextCell(h.date),
        makePriceCell(h.price, isMin, isMax),
        makeStoreCell(h.store, isMin),
        makeTextCell(h.unitPrice || '—'),
        makeTextCell(h.memo || '—', 'history-memo')
    ];
    cells.forEach((c) => row.appendChild(c));
    row.appendChild(makeHistoryDeleteCell(productId, idx));
    return row;
};

const createHistoryTable = (product) => {
    const summary = calcPriceSummary(product.children);
    const minIds = new Set(summary.minHistories);
    const maxIds = new Set(summary.maxHistories);
    const table = document.createElement('table');
    table.className = 'history-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['日付', '値段', '店', 'グラム単価', 'メモ', ''].forEach((label) => {
        const th = document.createElement('th');
        th.textContent = label;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    sortHistories(product.children).forEach((h) => {
        const idx = product.children.indexOf(h);
        tbody.appendChild(
            createHistoryRow(h, idx, product.id, minIds.has(h), maxIds.has(h))
        );
    });
    table.appendChild(tbody);
    return table;
};

const createDetailsRow = (product) => {
    const tr = document.createElement('tr');
    tr.className =
        viewState.openDetailId === product.id
            ? 'details-row'
            : 'details-row hidden';
    tr.id = `details-${product.id}`;

    const td = document.createElement('td');
    td.colSpan = 7;

    const container = document.createElement('div');
    container.className = 'details-container';

    const title = document.createElement('div');
    title.className = 'details-title';
    title.innerText = '購入履歴（新しい順）';
    container.appendChild(title);

    const histories = sortHistories(product.children);
    if (histories.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'history-empty';
        empty.innerText = '履歴がありません';
        container.appendChild(empty);
    } else {
        container.appendChild(createHistoryTable(product));
    }

    td.appendChild(container);
    tr.appendChild(td);
    return tr;
};

const createEmptyRow = () => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'empty-message';
    td.innerText =
        '商品が登録されていません。上部のフォームから登録してください。';
    tr.appendChild(td);
    return tr;
};

const renderList = async () => {
    const tbody = document.getElementById('storageTbody');
    tbody.innerHTML = '';

    const products = await getAllProducts();
    const filtered = filterByCategory(products, viewState.selectedCategory);
    const sorted = sortProducts(filtered, viewState.sortKey);

    if (sorted.length === 0) {
        tbody.appendChild(createEmptyRow());
        return;
    }

    sorted.forEach((product) => {
        tbody.appendChild(createProductRow(product));
        tbody.appendChild(createDetailsRow(product));
    });
};

const refreshDataView = async () => {
    await renderCategoryTabs();
    await renderList();
};

const deleteProduct = async (id) => {
    const ok = confirm(
        'この商品を削除しますか？（全購入履歴も一括削除されます）'
    );
    if (!ok) return;
    await deleteProductDb(id);
    showToast(TOAST.DELETED);
    refreshDataView();
};

// children0件なら商品自体を削除
const deleteHistory = async (productId, index) => {
    const product = await getProduct(productId);
    if (!product) return;
    if (!confirm('この履歴を削除しますか？')) return;

    const updatedProduct = removeProductHistory(product, index);
    if (updatedProduct.children.length === 0) {
        await deleteProductDb(productId);
    } else {
        await putProduct(updatedProduct);
    }
    showToast(TOAST.DELETED);
    closeHistoryModal();
    refreshDataView();
};

const openHistoryModal = async (productId, index) => {
    const product = await getProduct(productId);
    if (!product) return;
    const history = product.children[index];
    if (!history) return;

    editState.editingProductId = productId;
    editState.editingHistoryIndex = index;

    document.getElementById('modalTitle').innerText =
        `${product.name} の履歴を編集`;
    document.getElementById('editName').value = product.name;
    document.getElementById('editPrice').value = history.price;
    document.getElementById('editStore').value = history.store || '';
    document.getElementById('editUnitPrice').value = history.unitPrice || '';
    document.getElementById('editDate').value = history.date;
    document.getElementById('editMemo').value = history.memo || '';

    document.getElementById('historyModal').classList.remove('hidden');
};

const closeHistoryModal = () => {
    document.getElementById('historyModal').classList.add('hidden');
    editState.editingProductId = null;
    editState.editingHistoryIndex = null;
};

const saveHistoryEdit = async () => {
    const { editingProductId, editingHistoryIndex } = editState;
    if (editingProductId === null) return;

    const priceRaw = document.getElementById('editPrice').value.trim();
    const date = document.getElementById('editDate').value;
    if (!isValidHistoryInput(priceRaw, date)) {
        showToast(TOAST.INPUT_INVALID);
        return;
    }

    const product = await getProduct(editingProductId);
    if (!product) return;

    await putProduct(
        updateProductHistory(
            product,
            document.getElementById('editName').value.trim(),
            editingHistoryIndex,
            buildNewHistory({
                price: priceRaw,
                store: document.getElementById('editStore').value.trim(),
                unitPrice: document
                    .getElementById('editUnitPrice')
                    .value.trim(),
                date,
                memo: document.getElementById('editMemo').value
            })
        )
    );

    showToast(TOAST.HISTORY_UPDATED);
    closeHistoryModal();
    refreshDataView();
};

const initDragAndDrop = () => {
    const tbody = document.getElementById('storageTbody');
    Sortable.create(tbody, {
        animation: 150,
        draggable: '.item-row',
        filter: '.details-row, button, input, select',
        preventOnFilter: false,
        onEnd: saveNewOrder
    });
};

const saveNewOrder = async (evt) => {
    if (evt.oldDraggableIndex === evt.newDraggableIndex) return;
    const products = await getAllProducts();
    const filtered = filterByCategory(products, viewState.selectedCategory);
    const sorted = sortProducts(filtered, viewState.sortKey);
    for (const product of reorderProducts(
        sorted,
        evt.oldDraggableIndex,
        evt.newDraggableIndex
    )) {
        await putProduct(product);
    }
    refreshDataView();
};

const exportBackup = async () => {
    try {
        const products = await getAllProducts();
        const handle = await window.showSaveFilePicker({
            suggestedName: BACKUP_FILENAME,
            types: [
                {
                    description: 'JSON File',
                    accept: { 'application/json': ['.json'] }
                }
            ]
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(products, null, 2));
        await writable.close();
        showToast(TOAST.SAVED_FILE);
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('ファイルの保存に失敗しました', e);
            showToast(TOAST.SAVE_FAIL);
        }
    }
};

const importData = async (parsed) => {
    const arr = validateImportData(parsed);
    if (!arr) {
        showToast(TOAST.IMPORT_FAIL);
        return;
    }
    if (
        !confirm('復元を実行しますか？\n既存のデータはすべて置き換えられます。')
    )
        return;

    await clearProducts();
    for (const product of arr) {
        await putProduct(product);
    }
    viewState.selectedCategory = 'all';
    showToast(TOAST.IMPORTED);
    refreshDataView();
};

const importBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            await importData(parsed);
        } catch (err) {
            console.error('importBackup失敗:', err);
            showToast(TOAST.IMPORT_FAIL);
        }
        document.getElementById('fileInput').value = '';
    };
    reader.readAsText(file);
};

const bindEvents = () => {
    document.getElementById('saveBtn').addEventListener('click', saveProduct);

    document
        .getElementById('inputCategory')
        .addEventListener('change', onCategorySelectChange);

    document
        .getElementById('exportBtn')
        .addEventListener('click', exportBackup);
    document
        .getElementById('fileInput')
        .addEventListener('change', importBackup);

    document
        .getElementById('modalSaveBtn')
        .addEventListener('click', saveHistoryEdit);
    document
        .getElementById('modalCancelBtn')
        .addEventListener('click', closeHistoryModal);
    document
        .getElementById('modalClose')
        .addEventListener('click', closeHistoryModal);
    document.getElementById('modalDeleteBtn').addEventListener('click', () => {
        if (editState.editingProductId === null) return;
        deleteHistory(
            editState.editingProductId,
            editState.editingHistoryIndex
        );
    });
    document.getElementById('historyModal').addEventListener('click', (e) => {
        if (e.target.id === 'historyModal') closeHistoryModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeHistoryModal();
    });

    document
        .querySelector('th[data-sort="name"]')
        .addEventListener('click', () => {
            viewState.sortKey =
                viewState.sortKey === 'name' ? 'createdAt' : 'name';
            renderList();
        });
};

const initApp = () => {
    document.getElementById('inputDate').value = todayStr();
    bindEvents();
    refreshDataView();
    initDragAndDrop();
};

// 実行順序依存のため末尾に配置
const request = indexedDB.open(DB.NAME, DB.VERSION);
request.onupgradeneeded = (e) => {
    const database = e.target.result;
    database.createObjectStore(DB.STORE, {
        keyPath: 'id',
        autoIncrement: true
    });
};
request.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};
request.onerror = (e) => {
    console.error('IndexedDBのオープンに失敗しました', e.target.error);
};
