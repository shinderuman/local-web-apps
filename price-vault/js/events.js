// イベントハンドラとリスナー登録（Controller 層。ブラウザ/Node両方で利用）
// ブラウザ: window.PRICE_EVENTS にエクスポート
// Node: module.exports にエクスポート
// ※ ユーザー操作を受けて state/db/view を連携させるユースケース集約
// ※ 依存: PRICE_STATE / PRICE_DB / PRICE_LOGIC / PRICE_VIEW / EXPORT_LOGIC

((root, factory) => {

    const PRICE_STATE = (typeof window !== 'undefined' ? window.PRICE_STATE : null)
        || (typeof require === 'function' ? require('./state.js') : null);
    const { viewState, editState } = PRICE_STATE;
    const PRICE_DB = (typeof window !== 'undefined' ? window.PRICE_DB : null)
        || (typeof require === 'function' ? require('./db.js') : null);
    const { getAllProducts, getProduct, putProduct, deleteProductDb, clearProducts } = PRICE_DB;
    const PRICE_LOGIC = (typeof window !== 'undefined' ? window.PRICE_LOGIC : null)
        || (typeof require === 'function' ? require('./price-logic.js') : null);
    const { isValidProductInput, isValidHistoryInput, buildNewProduct, buildNewHistory, filterByCategory, sortProducts } = PRICE_LOGIC;
    const EXPORT_LOGIC = (typeof window !== 'undefined' ? window.EXPORT_LOGIC : null)
        || (typeof require === 'function' ? require('./export-logic.js') : null);
    const { validateImportData } = EXPORT_LOGIC;
    const PRICE_VIEW = (typeof window !== 'undefined' ? window.PRICE_VIEW : null)
        || (typeof require === 'function' ? require('./view.js') : null);
    const { showToast, toggleDetails, renderCategoryTabs, updateCategorySelect, renderList, fillHistoryModal, closeHistoryModal } = PRICE_VIEW;

    // 今日の日付を YYYY-MM-DD で返す
    const todayStr = () => {
        const d = new Date();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd}`;
    };

    // 選択中タブからカテゴリのデフォルト値を決定（「すべて」時は未分類）
    const defaultCategoryFromTab = (constants) => {
        return viewState.selectedCategory === 'all' ? constants.UNCATEGORIZED : viewState.selectedCategory;
    };

    // 一覧とカテゴリタブとプルダウンをまとめて再描画（DB取得→View描画のオーケストレーション）
    const refreshDataView = async (constants, handlers) => {
        const products = await getAllProducts();
        renderCategoryTabs(products, constants, handlers.onSelectCategory);
        updateCategorySelect(products, constants, defaultCategoryFromTab(constants));
        renderList(products, constants, {
            onDeleteProduct: handlers.onDeleteProduct,
            onToggleDetails: toggleDetails,
            onOpenHistoryModal: handlers.onOpenHistoryModal,
            onDeleteHistory: handlers.onDeleteHistory
        });
    };

    // カテゴリタブ選択（選択状態を更新して一覧とプルダウンを再描画）
    const selectCategory = (constants, handlers) => (category) => {
        viewState.selectedCategory = category;
        refreshDataView(constants, handlers);
    };

    // カテゴリプルダウン変更時（新規追加なら入力欄を表示）
    const onCategorySelectChange = (constants) => () => {
        const select = document.getElementById('inputCategory');
        const isNew = select.value === constants.NEW_CATEGORY_VALUE;
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
    const readFormCategory = (constants) => () => {
        const select = document.getElementById('inputCategory');
        if (select.value === constants.NEW_CATEGORY_VALUE) {
            const v = document.getElementById('inputCategoryNew').value.trim();
            return v || constants.UNCATEGORIZED;
        }
        return select.value;
    };

    // 登録フォームをリセット（買った店は連続登録のため残す。日付・カテゴリはデフォルトに戻す）
    const resetForm = async (constants) => {
        document.getElementById('inputName').value = '';
        document.getElementById('inputPrice').value = '';
        document.getElementById('inputUnitPrice').value = '';
        document.getElementById('inputMemo').value = '';
        document.getElementById('inputDate').value = todayStr();
        const products = await getAllProducts();
        updateCategorySelect(products, constants, defaultCategoryFromTab(constants));
        document.getElementById('inputName').focus();
    };

    // 商品を登録（既存同名商品があれば履歴追加、なければ新規）
    const saveProduct = (constants, messages, handlers) => async () => {
        const name = document.getElementById('inputName').value.trim();
        const priceRaw = document.getElementById('inputPrice').value.trim();
        const date = document.getElementById('inputDate').value || todayStr();

        if (!isValidProductInput(name) || !isValidHistoryInput(priceRaw, date)) {
            showToast(messages.INPUT_INVALID, constants);
            return;
        }

        const history = readFormHistory();
        const category = readFormCategory(constants)();
        const products = await getAllProducts();
        const existing = products.find(p => p.name.trim() === name);

        if (existing) {
            existing.children.push(history);
            await putProduct(existing);
            showToast(messages.UPDATED, constants);
        } else {
            const product = buildNewProduct(
                { name, category, sortOrder: products.length, children: [history] },
                Date.now()
            );
            await putProduct(product);
            showToast(messages.SAVED, constants);
        }

        await resetForm(constants);
        refreshDataView(constants, handlers);
    };

    const deleteProduct = (constants, messages, handlers) => async (id) => {
        const ok = confirm('この商品を削除しますか？（全購入履歴も一括削除されます）');
        if (!ok) return;
        await deleteProductDb(id);
        showToast(messages.DELETED, constants);
        refreshDataView(constants, handlers);
    };

    // 指定商品の子履歴を1件削除（children0件なら商品自体を削除）
    const deleteHistory = (constants, messages, handlers) => async (productId, index) => {
        const product = await getProduct(productId);
        if (!product) return;
        if (!confirm('この履歴を削除しますか？')) return;

        product.children.splice(index, 1);
        if (product.children.length === 0) {
            await deleteProductDb(productId);
        } else {
            await putProduct(product);
        }
        showToast(messages.DELETED, constants);
        closeHistoryModal();
        refreshDataView(constants, handlers);
    };

    const openHistoryModal = async (productId, index) => {
        const product = await getProduct(productId);
        if (!product) return;
        fillHistoryModal(product, index);
    };

    // モーダルの保存（商品名変更は商品レコード、それ以外は履歴更新）
    const saveHistoryEdit = (constants, messages, handlers) => async () => {
        const { editingProductId, editingHistoryIndex } = editState;
        if (editingProductId === null) return;

        const priceRaw = document.getElementById('editPrice').value.trim();
        const date = document.getElementById('editDate').value;
        if (!isValidHistoryInput(priceRaw, date)) {
            showToast(messages.INPUT_INVALID, constants);
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

        showToast(messages.HISTORY_UPDATED, constants);
        closeHistoryModal();
        refreshDataView(constants, handlers);
    };

    // 表示中アイテムの並び順を sortOrder に反映して保存
    const saveNewOrder = (constants, handlers) => async (evt) => {
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
        refreshDataView(constants, handlers);
    };

    const exportBackup = (constants, messages) => async () => {
        try {
            const products = await getAllProducts();
            const handle = await window.showSaveFilePicker({
                suggestedName: constants.BACKUP_FILENAME,
                types: [{
                    description: 'JSON File',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(products, null, 2));
            await writable.close();
            showToast(messages.SAVED_FILE, constants);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('ファイルの保存に失敗しました', e);
                showToast(messages.SAVE_FAIL, constants);
            }
        }
    };

    const importData = (constants, messages, handlers) => async (parsed) => {
        const arr = validateImportData(parsed);
        if (!arr) {
            showToast(messages.IMPORT_FAIL, constants);
            return;
        }
        if (!confirm('復元を実行しますか？\n既存のデータはすべて置き換えられます。')) return;

        await clearProducts();
        for (const product of arr) {
            await putProduct(product);
        }
        viewState.selectedCategory = 'all';
        showToast(messages.IMPORTED, constants);
        refreshDataView(constants, handlers);
    };

    const importBackup = (constants, messages, handlers) => (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                await importData(constants, messages, handlers)(parsed);
            } catch (err) {
                console.error('importBackup失敗:', err);
                showToast(messages.IMPORT_FAIL, constants);
            }
            document.getElementById('fileInput').value = '';
        };
        reader.readAsText(file);
    };

    // リスナー登録。constants/messages は app.js から注入
    const bindEvents = (constants, messages) => {
        const handlers = {
            onSelectCategory: null,
            onDeleteProduct: null,
            onOpenHistoryModal: openHistoryModal,
            onDeleteHistory: null
        };
        handlers.onSelectCategory = selectCategory(constants, handlers);
        handlers.onDeleteProduct = deleteProduct(constants, messages, handlers);
        handlers.onDeleteHistory = deleteHistory(constants, messages, handlers);

        const onSortHeaderClick = async () => {
            viewState.sortKey = viewState.sortKey === 'name' ? 'createdAt' : 'name';
            const products = await getAllProducts();
            renderList(products, constants, {
                onDeleteProduct: handlers.onDeleteProduct,
                onToggleDetails: toggleDetails,
                onOpenHistoryModal: handlers.onOpenHistoryModal,
                onDeleteHistory: handlers.onDeleteHistory
            });
        };

        document.getElementById('saveBtn').addEventListener('click', saveProduct(constants, messages, handlers));
        document.getElementById('inputCategory').addEventListener('change', onCategorySelectChange(constants));
        document.getElementById('exportBtn').addEventListener('click', exportBackup(constants, messages));
        document.getElementById('fileInput').addEventListener('change', importBackup(constants, messages, handlers));

        // モーダル
        document.getElementById('modalSaveBtn').addEventListener('click', saveHistoryEdit(constants, messages, handlers));
        document.getElementById('modalCancelBtn').addEventListener('click', closeHistoryModal);
        document.getElementById('modalClose').addEventListener('click', closeHistoryModal);
        document.getElementById('modalDeleteBtn').addEventListener('click', () => {
            if (editState.editingProductId === null) return;
            handlers.onDeleteHistory(editState.editingProductId, editState.editingHistoryIndex);
        });
        document.getElementById('historyModal').addEventListener('click', (e) => {
            if (e.target.id === 'historyModal') closeHistoryModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeHistoryModal();
        });

        // ソートヘッダ（商品名のみ）
        document.querySelector('th[data-sort="name"]').addEventListener('click', onSortHeaderClick);

        return { handlers, saveNewOrder: saveNewOrder(constants, handlers) };
    };

    const PRICE_EVENTS = {
        bindEvents,
        refreshDataView,
        selectCategory,
        saveNewOrder
    };

    factory(root, PRICE_EVENTS);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.PRICE_EVENTS = mod;
    }
});
