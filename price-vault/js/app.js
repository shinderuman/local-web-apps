// ============================================================
// 定数
// ============================================================

// IndexedDB設定
const DB = {
    NAME: 'PriceVaultDB',
    VERSION: 1,
    STORE: 'products'
};

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

let db = null;

// 表示状態（選択カテゴリ・ソート・開閉中ID）
const viewState = {
    selectedCategory: 'all',
    sortKey: 'name',
    openDetailId: null
};

// 編集状態（モーダル編集中の商品ID・履歴インデックス）
const editState = {
    editingProductId: null,
    editingHistoryIndex: null
};

// UI状態
const uiState = {
    toastTimer: null
};

// ============================================================
// モジュール（純粋関数）のインポート
// ============================================================

const {
    calcPriceSummary, getAllStores, sortHistories,
    sortProducts, filterByCategory,
    isValidProductInput, isValidHistoryInput,
    buildNewProduct, buildNewHistory
} = window.PRICE_LOGIC;
const { extractCategories, countProductsByCategory } = window.CATEGORY_LOGIC;
const { validateImportData } = window.EXPORT_LOGIC;

// ============================================================
// IndexedDB ヘルパ
// ============================================================

// 全商品取得（降順で返す）
const getAllProducts = () => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readonly');
        const req = tx.objectStore(DB.STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
};

// 1商品取得
const getProduct = (id) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readonly');
        const req = tx.objectStore(DB.STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
};

// 商品を保存（新規・更新）
const putProduct = (product) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readwrite');
        tx.objectStore(DB.STORE).put(product);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

// 商品を削除
const deleteProductDb = (id) => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readwrite');
        tx.objectStore(DB.STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

// ストアを全削除
const clearProducts = () => {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([DB.STORE], 'readwrite');
        tx.objectStore(DB.STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

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

// 強調クラス付きの金額spanを生成。valueがnullなら「—」の空クラスspan
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

// 最安値の店名span群を生成（空なら null）
const createMinStoreSpans = (stores) => {
    if (stores.length === 0) return null;
    return stores.map(s => {
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

    // 最安値/最高値サマリ（1走査）。店名・購入日もここから導出
    const summary = calcPriceSummary(product.children);
    const minStoreSpans = createMinStoreSpans(getAllStores(summary.minHistories));

    // 商品名
    const tdName = document.createElement('td');
    tdName.className = 'name-cell';
    tdName.innerText = product.name;
    tr.appendChild(tdName);

    // 最安値（緑強調）
    const tdMin = document.createElement('td');
    tdMin.appendChild(createPriceSpan(summary.min, 'price-min'));
    tr.appendChild(tdMin);

    // 最高値（赤強調）
    const tdMax = document.createElement('td');
    tdMax.appendChild(createPriceSpan(summary.max, 'price-max'));
    tr.appendChild(tdMax);

    // カテゴリ
    const tdCat = document.createElement('td');
    tdCat.innerText = product.category || UNCATEGORIZED;
    tr.appendChild(tdCat);

    // 最安値の店（同額の店が複数あれば全て、強調）。なければ「—」
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

    // 購入日（最安値の購入日のうち最新。参考情報）
    const tdDate = document.createElement('td');
    tdDate.className = 'date-cell';
    tdDate.innerText = summary.latestMinDate || '—';
    tr.appendChild(tdDate);

    // 削除ボタン（親レコード削除＝子履歴も一括）
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

// テキストセルを生成
const makeTextCell = (text, cls = '') => {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    return td;
};

// 履歴の値段セルを生成（最安=緑/最高=赤を強調）
const makePriceCell = (price, isMin, isMax) => {
    const td = document.createElement('td');
    if (isMin) td.className = 'price-min';
    else if (isMax) td.className = 'price-max';
    td.textContent = '¥' + price;
    return td;
};

// 履歴の店セルを生成（最安値の店なら強調span）
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

// 履歴削除アイコンセルを生成（行クリックのモーダルを開かず直接削除確認）
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

// 履歴1行を生成（値段/店は最安・最高に応じて強調）
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
    cells.forEach(c => row.appendChild(c));
    row.appendChild(makeHistoryDeleteCell(productId, idx));
    return row;
};

// 履歴テーブルを生成（ヘッダ + ソート済み履歴行）
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
        tbody.appendChild(createHistoryRow(h, idx, product.id, minIds.has(h), maxIds.has(h)));
    });
    table.appendChild(tbody);
    return table;
};

const createDetailsRow = (product) => {
    const tr = document.createElement('tr');
    tr.className = viewState.openDetailId === product.id ? 'details-row' : 'details-row hidden';
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
    td.innerText = '商品が登録されていません。上部のフォームから登録してください。';
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

    sorted.forEach(product => {
        tbody.appendChild(createProductRow(product));
        tbody.appendChild(createDetailsRow(product));
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
// IndexedDB 初期化（実行順序依存のため末尾に配置）
// ============================================================

const request = indexedDB.open(DB.NAME, DB.VERSION);
request.onupgradeneeded = (e) => {
    const database = e.target.result;
    database.createObjectStore(DB.STORE, { keyPath: 'id', autoIncrement: true });
};
request.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};
request.onerror = (e) => {
    console.error('IndexedDBのオープンに失敗しました', e.target.error);
};
