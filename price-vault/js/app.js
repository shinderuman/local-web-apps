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

// View に渡す固定定数（TIMING/UNCATEGORIZED/NEW_CATEGORY_VALUE）
const VIEW_CONSTANTS = {
    TIMING,
    UNCATEGORIZED,
    NEW_CATEGORY_VALUE
};

// ============================================================
// 状態変数（ミュータブル）
// ============================================================

const { viewState, editState } = window.PRICE_STATE;

// ============================================================
// モジュールのインポート
// ============================================================

const {
    isValidProductInput, isValidHistoryInput,
    buildNewProduct, buildNewHistory
} = window.PRICE_LOGIC;
const { validateImportData } = window.EXPORT_LOGIC;
const {
    getAllProducts, getProduct, putProduct, deleteProductDb, clearProducts
} = window.PRICE_DB;
const {
    showToast, toggleDetails, renderCategoryTabs,
    updateCategorySelect, renderList, fillHistoryModal, closeHistoryModal
} = window.PRICE_VIEW;

// ============================================================
// UIヘルパ
// ============================================================

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

// 一覧とカテゴリタブとプルダウンをまとめて再描画（DB取得→View描画のオーケストレーション）
const refreshDataView = async () => {
    const products = await getAllProducts();
    renderCategoryTabs(products, VIEW_CONSTANTS, selectCategory);
    updateCategorySelect(products, VIEW_CONSTANTS, defaultCategoryFromTab());
    renderList(products, VIEW_CONSTANTS, {
        onDeleteProduct: deleteProduct,
        onToggleDetails: toggleDetails,
        onOpenHistoryModal: openHistoryModal,
        onDeleteHistory: deleteHistory
    });
};

// ============================================================
// カテゴリタブ選択
// ============================================================

// カテゴリタブ選択（選択状態を更新して一覧とプルダウンを再描画）
const selectCategory = (category) => {
    viewState.selectedCategory = category;
    refreshDataView();
};

// ============================================================
// 登録フォーム
// ============================================================

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
const resetForm = async () => {
    document.getElementById('inputName').value = '';
    document.getElementById('inputPrice').value = '';
    document.getElementById('inputUnitPrice').value = '';
    document.getElementById('inputMemo').value = '';
    document.getElementById('inputDate').value = todayStr();
    const products = await getAllProducts();
    updateCategorySelect(products, VIEW_CONSTANTS, defaultCategoryFromTab());
    document.getElementById('inputName').focus();
};

// 商品を登録（既存同名商品があれば履歴追加、なければ新規）
const saveProduct = async () => {
    const name = document.getElementById('inputName').value.trim();
    const priceRaw = document.getElementById('inputPrice').value.trim();
    const date = document.getElementById('inputDate').value || todayStr();

    if (!isValidProductInput(name) || !isValidHistoryInput(priceRaw, date)) {
        showToast(TOAST.INPUT_INVALID, VIEW_CONSTANTS);
        return;
    }

    const history = readFormHistory();
    const category = readFormCategory();
    const products = await getAllProducts();
    const existing = products.find(p => p.name.trim() === name);

    if (existing) {
        existing.children.push(history);
        await putProduct(existing);
        showToast(TOAST.UPDATED, VIEW_CONSTANTS);
    } else {
        const product = buildNewProduct(
            { name, category, sortOrder: products.length, children: [history] },
            Date.now()
        );
        await putProduct(product);
        showToast(TOAST.SAVED, VIEW_CONSTANTS);
    }

    await resetForm();
    refreshDataView();
};

// ============================================================
// 削除
// ============================================================

const deleteProduct = async (id) => {
    const ok = confirm('この商品を削除しますか？（全購入履歴も一括削除されます）');
    if (!ok) return;
    await deleteProductDb(id);
    showToast(TOAST.DELETED, VIEW_CONSTANTS);
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
    showToast(TOAST.DELETED, VIEW_CONSTANTS);
    closeHistoryModal();
    refreshDataView();
};

// ============================================================
// 履歴編集モーダル
// ============================================================

const openHistoryModal = async (productId, index) => {
    const product = await getProduct(productId);
    if (!product) return;
    fillHistoryModal(product, index);
};

// モーダルの保存（商品名変更は商品レコード、それ以外は履歴更新）
const saveHistoryEdit = async () => {
    const { editingProductId, editingHistoryIndex } = editState;
    if (editingProductId === null) return;

    const priceRaw = document.getElementById('editPrice').value.trim();
    const date = document.getElementById('editDate').value;
    if (!isValidHistoryInput(priceRaw, date)) {
        showToast(TOAST.INPUT_INVALID, VIEW_CONSTANTS);
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

    showToast(TOAST.HISTORY_UPDATED, VIEW_CONSTANTS);
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
    const { filterByCategory, sortProducts } = window.PRICE_LOGIC;
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
        showToast(TOAST.SAVED_FILE, VIEW_CONSTANTS);
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('ファイルの保存に失敗しました', e);
            showToast(TOAST.SAVE_FAIL, VIEW_CONSTANTS);
        }
    }
};

const importData = async (parsed) => {
    const arr = validateImportData(parsed);
    if (!arr) {
        showToast(TOAST.IMPORT_FAIL, VIEW_CONSTANTS);
        return;
    }
    if (!confirm('復元を実行しますか？\n既存のデータはすべて置き換えられます。')) return;

    await clearProducts();
    for (const product of arr) {
        await putProduct(product);
    }
    viewState.selectedCategory = 'all';
    showToast(TOAST.IMPORTED, VIEW_CONSTANTS);
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
            showToast(TOAST.IMPORT_FAIL, VIEW_CONSTANTS);
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
    document.querySelector('th[data-sort="name"]').addEventListener('click', async () => {
        viewState.sortKey = viewState.sortKey === 'name' ? 'createdAt' : 'name';
        const products = await getAllProducts();
        renderList(products, VIEW_CONSTANTS, {
            onDeleteProduct: deleteProduct,
            onToggleDetails: toggleDetails,
            onOpenHistoryModal: openHistoryModal,
            onDeleteHistory: deleteHistory
        });
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
