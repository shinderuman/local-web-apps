// 描画・UI操作ヘルパ（ブラウザ/Node両方で利用）
// ブラウザ: window.PRICE_VIEW にエクスポート
// Node: module.exports にエクスポート
// ※ DBアクセスを行わず、データとコールバックを引数で受け取って描画のみ行う（View の純粋化）
// ※ 状態（viewState/editState/uiState）は PRICE_STATE から参照・更新する
// ※ 定数（UNCATEGORIZED/NEW_CATEGORY_VALUE/TIMING/TOAST）は app.js から引数注入

((root, factory) => {

    const PRICE_STATE = (typeof window !== 'undefined' ? window.PRICE_STATE : null)
        || (typeof require === 'function' ? require('./state.js') : null);
    const { viewState, editState, uiState } = PRICE_STATE;
    const PRICE_LOGIC = (typeof window !== 'undefined' ? window.PRICE_LOGIC : null)
        || (typeof require === 'function' ? require('./price-logic.js') : null);
    const { filterByCategory, sortProducts } = PRICE_LOGIC;
    const CATEGORY_LOGIC = (typeof window !== 'undefined' ? window.CATEGORY_LOGIC : null)
        || (typeof require === 'function' ? require('./category-logic.js') : null);
    const { extractCategories, countProductsByCategory } = CATEGORY_LOGIC;
    const DOM_HELPERS = (typeof window !== 'undefined' ? window.DOM_HELPERS : null)
        || (typeof require === 'function' ? require('./dom-helpers.js') : null);
    const {
        createEmptyRow, createHistoryTable, createDetailsRow,
        createProductRow, createHistoryRow
    } = DOM_HELPERS;

    // トーストを表示。constants.TIMING.TOAST_DURATION で自動消去
    const showToast = (message, constants) => {
        const toast = document.getElementById('toastNotification');
        toast.innerText = message;
        toast.classList.add('show');

        if (uiState.toastTimer) clearTimeout(uiState.toastTimer);
        uiState.toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, constants.TIMING.TOAST_DURATION);
    };

    // 詳細の開閉を viewState で管理（再描画後も維持）
    const toggleDetails = (id) => {
        viewState.openDetailId = (viewState.openDetailId === id) ? null : id;
        const el = document.getElementById(`details-${id}`);
        if (el) el.classList.toggle('hidden');
    };

    // カテゴリタブを描画。onSelectCategory: タブ選択時に呼ぶコールバック
    const renderCategoryTabs = (products, constants, onSelectCategory) => {
        const container = document.getElementById('filterContainer');
        container.innerHTML = '';

        // 「すべて」固定
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn' + (viewState.selectedCategory === 'all' ? ' active' : '');
        allBtn.dataset.filter = 'all';
        allBtn.innerText = `すべて (${products.length})`;
        allBtn.addEventListener('click', () => onSelectCategory('all'));
        container.appendChild(allBtn);

        // ユーザーカテゴリ（商品から動的抽出）
        extractCategories(products).forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn' + (viewState.selectedCategory === cat ? ' active' : '');
            btn.dataset.filter = cat;
            btn.innerText = `${cat} (${countProductsByCategory(products, cat)})`;
            btn.addEventListener('click', () => onSelectCategory(cat));
            container.appendChild(btn);
        });
    };

    // カテゴリプルダウンを再構築（既存カテゴリ＋「新規追加」。選択中タブをデフォルト）
    const updateCategorySelect = (products, constants, defaultCategory) => {
        const select = document.getElementById('inputCategory');
        const current = defaultCategory;

        select.innerHTML = '';
        extractCategories(products).forEach(cat => {
            select.add(new Option(cat, cat, false, cat === current));
        });
        // 未分類と新規追加
        if (!extractCategories(products).includes(current)) {
            select.add(new Option(current, current, true, true));
        }
        select.add(new Option('＋ 新規カテゴリ追加', constants.NEW_CATEGORY_VALUE));

        document.getElementById('inputCategoryNew').classList.add('hidden');
        document.getElementById('inputCategoryNew').value = '';
    };

    // 商品一覧を描画。handlers: { onDeleteProduct, onToggleDetails, onOpenHistoryModal, onDeleteHistory }
    const renderList = (products, constants, handlers) => {
        const tbody = document.getElementById('storageTbody');
        tbody.innerHTML = '';

        const filtered = filterByCategory(products, viewState.selectedCategory);
        const sorted = sortProducts(filtered, viewState.sortKey);

        if (sorted.length === 0) {
            tbody.appendChild(createEmptyRow(7));
            return;
        }

        // createHistoryTable に渡す行生成関数: createHistoryRow にコールバックを部分適用
        const buildHistoryTable = (p) => {
            return createHistoryTable(p, (h, idx, productId, isMin, isMax) => {
                return createHistoryRow(h, idx, productId, isMin, isMax, handlers.onOpenHistoryModal, handlers.onDeleteHistory);
            });
        };

        sorted.forEach(product => {
            tbody.appendChild(createProductRow(product, handlers.onDeleteProduct, handlers.onToggleDetails, constants.UNCATEGORIZED));
            tbody.appendChild(createDetailsRow(product, viewState.openDetailId === product.id, buildHistoryTable));
        });
    };

    // 履歴編集モーダルに値をセット（getProduct は呼ばず、引数で受け取る）
    const fillHistoryModal = (product, index) => {
        const history = product.children[index];
        if (!history) return;

        editState.editingProductId = product.id;
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

    // 履歴編集モーダルを閉じる
    const closeHistoryModal = () => {
        document.getElementById('historyModal').classList.add('hidden');
        editState.editingProductId = null;
        editState.editingHistoryIndex = null;
    };

    const PRICE_VIEW = {
        showToast,
        toggleDetails,
        renderCategoryTabs,
        updateCategorySelect,
        renderList,
        fillHistoryModal,
        closeHistoryModal
    };

    factory(root, PRICE_VIEW);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.PRICE_VIEW = mod;
    }
});
