// ============================================================
// 定数
// ============================================================

// タイムアウト（ミリ秒）
const TIMING = {
    TOAST_DURATION: 2500
};

// バックアップファイル名・カテゴリ新規追加のセンチネル値
const BACKUP_FILENAME = 'price-vault.json';
const NEW_CATEGORY_VALUE = '__new_category__';
const UNCATEGORIZED = '未分類';

// トーストメッセージ
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

// ============================================================
// 状態変数（ミュータブル）
// ============================================================

const { viewState, editState, uiState } = window.PRICE_STATE;

// ============================================================
// モジュール（純粋関数）のインポート
// ============================================================

const {
    sortProducts, filterByCategory,
    isValidProductInput, isValidHistoryInput,
    buildNewProduct, buildNewHistory
} = window.PRICE_LOGIC;
const { extractCategories, countProductsByCategory } = window.CATEGORY_LOGIC;
const { validateImportData } = window.EXPORT_LOGIC;
const {
    createEmptyRow, createHistoryTable, createDetailsRow,
    createProductRow, createHistoryRow
} = window.DOM_HELPERS;
const {
    getAllProducts, getProduct, putProduct, deleteProductDb, clearProducts
} = window.PRICE_DB;

// ============================================================
// UIヘルパ
// ============================================================

const showToast = (message) => {
    const toast = document.getElementById('toastNotification');
    toast.innerText = message;
    toast.classList.add('show');

    if (uiState.toastTimer) clearTimeout(uiState.toastTimer);
    uiState.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, TIMING.TOAST_DURATION);
};

// 今日の日付を YYYY-MM-DD で返す
const todayStr = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

// 選択中タブからカテゴリのデフォルト値を決定（「すべて」時は未分類）
const defaultCategoryFromTab = () => {
    return viewState.selectedCategory === 'all' ? UNCATEGORIZED : viewState.selectedCategory;
};

// 詳細の開閉を viewState で管理（再描画後も維持）
const toggleDetails = (id) => {
    viewState.openDetailId = (viewState.openDetailId === id) ? null : id;
    const el = document.getElementById(`details-${id}`);
    if (el) el.classList.toggle('hidden');
};

// ============================================================
// カテゴリタブ描画
// ============================================================

const renderCategoryTabs = async () => {
    const products = await getAllProducts();
    const container = document.getElementById('filterContainer');
    container.innerHTML = '';

    // 「すべて」固定
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn' + (viewState.selectedCategory === 'all' ? ' active' : '');
    allBtn.dataset.filter = 'all';
    allBtn.innerText = `すべて (${products.length})`;
    allBtn.addEventListener('click', () => selectCategory('all'));
    container.appendChild(allBtn);

    // ユーザーカテゴリ（商品から動的抽出）
    extractCategories(products).forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (viewState.selectedCategory === cat ? ' active' : '');
        btn.dataset.filter = cat;
        btn.innerText = `${cat} (${countProductsByCategory(products, cat)})`;
        btn.addEventListener('click', () => selectCategory(cat));
        container.appendChild(btn);
    });

    updateCategorySelect();
};

// カテゴリタブ選択（選択状態を更新して一覧とプルダウンを再描画）
const selectCategory = (category) => {
    viewState.selectedCategory = category;
    refreshDataView();
};

// ============================================================
// 登録フォーム
// ============================================================

// カテゴリプルダウンを再構築（既存カテゴリ＋「新規追加」。選択中タブをデフォルト）
const updateCategorySelect = async () => {
    const products = await getAllProducts();
    const select = document.getElementById('inputCategory');
    const current = defaultCategoryFromTab();

    select.innerHTML = '';
    extractCategories(products).forEach(cat => {
        select.add(new Option(cat, cat, false, cat === current));
    });
    // 未分類と新規追加
    if (!extractCategories(products).includes(current)) {
        select.add(new Option(current, current, true, true));
    }
    select.add(new Option('＋ 新規カテゴリ追加', NEW_CATEGORY_VALUE));

    document.getElementById('inputCategoryNew').classList.add('hidden');
    document.getElementById('inputCategoryNew').value = '';
};

// カテゴリプルダウン変更時（新規追加なら入力欄を表示）
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

// フォーム入力から履歴データを組み立て
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

// フォームから決定したカテゴリ値（新規追加時は入力欄の値）
const readFormCategory = () => {
    const select = document.getElementById('inputCategory');
    if (select.value === NEW_CATEGORY_VALUE) {
        const v = document.getElementById('inputCategoryNew').value.trim();
        return v || UNCATEGORIZED;
    }
    return select.value;
};

// 登録フォームをリセット（買った店は連続登録のため残す。日付・カテゴリはデフォルトに戻す）
const resetForm = () => {
    document.getElementById('inputName').value = '';
    document.getElementById('inputPrice').value = '';
    document.getElementById('inputUnitPrice').value = '';
    document.getElementById('inputMemo').value = '';
    document.getElementById('inputDate').value = todayStr();
    updateCategorySelect();
    document.getElementById('inputName').focus();
};

// 商品を登録（既存同名商品があれば履歴追加、なければ新規）
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
    const existing = products.find(p => p.name.trim() === name);

    if (existing) {
        existing.children.push(history);
        await putProduct(existing);
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

// ============================================================
// レンダリング（商品一覧）
// ============================================================

const renderList = async () => {
    const tbody = document.getElementById('storageTbody');
    tbody.innerHTML = '';

    const products = await getAllProducts();
    const filtered = filterByCategory(products, viewState.selectedCategory);
    const sorted = sortProducts(filtered, viewState.sortKey);

    if (sorted.length === 0) {
        tbody.appendChild(createEmptyRow(7));
        return;
    }

    // createHistoryTable に渡す行生成関数: createHistoryRow に openHistoryModal/deleteHistory を部分適用
    const buildHistoryTable = (p) => {
        return createHistoryTable(p, (h, idx, productId, isMin, isMax) => {
            return createHistoryRow(h, idx, productId, isMin, isMax, openHistoryModal, deleteHistory);
        });
    };

    sorted.forEach(product => {
        tbody.appendChild(createProductRow(product, deleteProduct, toggleDetails, UNCATEGORIZED));
        tbody.appendChild(createDetailsRow(product, viewState.openDetailId === product.id, buildHistoryTable));
    });
};

// 一覧とカテゴリタブとプルダウンをまとめて再描画
const refreshDataView = async () => {
    await renderCategoryTabs();
    await renderList();
};

// ============================================================
// 削除
// ============================================================

const deleteProduct = async (id) => {
    const ok = confirm('この商品を削除しますか？（全購入履歴も一括削除されます）');
    if (!ok) return;
    await deleteProductDb(id);
    showToast(TOAST.DELETED);
    refreshDataView();
};

// 指定商品の子履歴を1件削除（children0件なら商品自体を削除）
const deleteHistory = async (productId, index) => {
    const product = await getProduct(productId);
    if (!product) return;
    if (!confirm('この履歴を削除しますか？')) return;

    product.children.splice(index, 1);
    if (product.children.length === 0) {
        await deleteProductDb(productId);
    } else {
        await putProduct(product);
    }
    showToast(TOAST.DELETED);
    closeHistoryModal();
    refreshDataView();
};

// ============================================================
// 履歴編集モーダル
// ============================================================

const openHistoryModal = async (productId, index) => {
    const product = await getProduct(productId);
    if (!product) return;
    const history = product.children[index];
    if (!history) return;

    editState.editingProductId = productId;
    editState.editingHistoryIndex = index;

    document.getElementById('modalTitle').innerText = `${product.name} の履歴を編集`;
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

// モーダルの保存（商品名変更は商品レコード、それ以外は履歴更新）
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

    product.name = document.getElementById('editName').value.trim() || product.name;
    product.children[editingHistoryIndex] = buildNewHistory({
        price: priceRaw,
        store: document.getElementById('editStore').value.trim(),
        unitPrice: document.getElementById('editUnitPrice').value.trim(),
        date,
        memo: document.getElementById('editMemo').value
    });
    await putProduct(product);

    showToast(TOAST.HISTORY_UPDATED);
    closeHistoryModal();
    refreshDataView();
};

// ============================================================
// D&D（商品並び替え）
// ============================================================

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

// 表示中アイテムの並び順を sortOrder に反映して保存
const saveNewOrder = async (evt) => {
    if (evt.oldDraggableIndex === evt.newDraggableIndex) return;
    const products = await getAllProducts();
    const filtered = filterByCategory(products, viewState.selectedCategory);
    const sorted = sortProducts(filtered, viewState.sortKey);
    const moved = sorted.splice(evt.oldDraggableIndex, 1)[0];
    sorted.splice(evt.newDraggableIndex, 0, moved);
    sorted.forEach((p, i) => { p.sortOrder = i; });
    for (const p of sorted) {
        await putProduct(p);
    }
    refreshDataView();
};

// ============================================================
// バックアップ（エクスポート / インポート）
// ============================================================

const exportBackup = async () => {
    try {
        const products = await getAllProducts();
        const handle = await window.showSaveFilePicker({
            suggestedName: BACKUP_FILENAME,
            types: [{
                description: 'JSON File',
                accept: { 'application/json': ['.json'] }
            }]
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
    if (!confirm('復元を実行しますか？\n既存のデータはすべて置き換えられます。')) return;

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

// ============================================================
// 初期化・イベントバインド
// ============================================================

const bindEvents = () => {
    document.getElementById('saveBtn').addEventListener('click', saveProduct);

    document.getElementById('inputCategory').addEventListener('change', onCategorySelectChange);

    document.getElementById('exportBtn').addEventListener('click', exportBackup);
    document.getElementById('fileInput').addEventListener('change', importBackup);

    // モーダル
    document.getElementById('modalSaveBtn').addEventListener('click', saveHistoryEdit);
    document.getElementById('modalCancelBtn').addEventListener('click', closeHistoryModal);
    document.getElementById('modalClose').addEventListener('click', closeHistoryModal);
    document.getElementById('modalDeleteBtn').addEventListener('click', () => {
        if (editState.editingProductId === null) return;
        deleteHistory(editState.editingProductId, editState.editingHistoryIndex);
    });
    document.getElementById('historyModal').addEventListener('click', (e) => {
        if (e.target.id === 'historyModal') closeHistoryModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeHistoryModal();
    });

    // ソートヘッダ（商品名のみ）
    document.querySelector('th[data-sort="name"]').addEventListener('click', () => {
        viewState.sortKey = viewState.sortKey === 'name' ? 'createdAt' : 'name';
        renderList();
    });
};

const initApp = () => {
    document.getElementById('inputDate').value = todayStr();
    bindEvents();
    refreshDataView();
    initDragAndDrop();
};

// ============================================================
// IndexedDB 初期化（準備完了後に initApp を呼ぶ）
// ============================================================

window.PRICE_DB.open(initApp);
