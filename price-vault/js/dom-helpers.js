// DOM要素生成ヘルパ（状態非依存の純粋関数。ブラウザ/Node両方で利用）
// ブラウザ: window.DOM_HELPERS にエクスポート
// Node: module.exports にエクスポート
// ※ document.createElement を使うが、状態(localStorage/IndexedDB/Date.now)に依存せず
//    引数のみから要素を生成するため純粋関数モジュールとして切り出す
// ※ calcPriceSummary/sortHistories/getAllStores は PRICE_LOGIC に依存

((root, factory) => {

    const PRICE_LOGIC = (typeof window !== 'undefined' ? window.PRICE_LOGIC : null)
        || (typeof require === 'function' ? require('./price-logic.js') : null);
    const { calcPriceSummary, sortHistories, getAllStores } = PRICE_LOGIC;

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

    // 0件時のメッセージ行を生成（colSpan は引数で指定）
    const createEmptyRow = (colSpan) => {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = colSpan;
        td.className = 'empty-message';
        td.innerText = '商品が登録されていません。上部のフォームから登録してください。';
        tr.appendChild(td);
        return tr;
    };

    // 履歴テーブルを生成（ヘッダ + ソート済み履歴行）
    // createRowFn: 1行を生成する関数（イベント結びつけを持つため app.js から注入）
    const createHistoryTable = (product, createRowFn) => {
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
            tbody.appendChild(createRowFn(h, idx, product.id, minIds.has(h), maxIds.has(h)));
        });
        table.appendChild(tbody);
        return table;
    };

    // 詳細（履歴一覧）行を生成
    // isOpen: 展開状態か。historyTableFactory: テーブル生成関数（app.js から注入）
    const createDetailsRow = (product, isOpen, historyTableFactory) => {
        const tr = document.createElement('tr');
        tr.className = isOpen ? 'details-row' : 'details-row hidden';
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
            container.appendChild(historyTableFactory(product));
        }

        td.appendChild(container);
        tr.appendChild(td);
        return tr;
    };

    // 商品一覧の親行を生成
    // onDeleteProduct: 削除ボタン押下時に呼ぶコールバック（app.js の deleteProduct を注入）
    // onToggleDetails: 行クリック（ボタン以外）時に呼ぶコールバック（app.js の toggleDetails を注入）
    // uncategorized: カテゴリ未設定時の表示名（app.js の UNCATEGORIZED 定数を注入）
    const createProductRow = (product, onDeleteProduct, onToggleDetails, uncategorized) => {
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

        // カテゴリ（空なら引数で受け取った未分類ラベル）
        const tdCat = document.createElement('td');
        tdCat.innerText = product.category || uncategorized;
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
            onDeleteProduct(product.id);
        });
        tdDel.appendChild(delBtn);
        tr.appendChild(tdDel);

        // 行クリック（ボタン以外）で詳細トグル
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            onToggleDetails(product.id);
        });

        return tr;
    };

    // 履歴削除アイコンセルを生成（行クリックのモーダルを開かず直接削除確認）
    // onDeleteHistory: クリック時に呼ぶコールバック（app.js の deleteHistory を注入）
    const makeHistoryDeleteCell = (productId, idx, onDeleteHistory) => {
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-row';
        delBtn.title = 'この履歴を削除';
        delBtn.innerText = '×';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onDeleteHistory(productId, idx);
        });
        const td = document.createElement('td');
        td.className = 'delete-cell';
        td.appendChild(delBtn);
        return td;
    };

    // 履歴1行を生成（値段/店は最安・最高に応じて強調）
    // onOpenHistoryModal: 行クリック時に呼ぶコールバック（app.js の openHistoryModal を注入）
    // onDeleteHistory: 履歴削除ボタン押下時に呼ぶコールバック（app.js の deleteHistory を注入）
    const createHistoryRow = (h, idx, productId, isMin, isMax, onOpenHistoryModal, onDeleteHistory) => {
        const row = document.createElement('tr');
        row.addEventListener('click', () => onOpenHistoryModal(productId, idx));

        const cells = [
            makeTextCell(h.date),
            makePriceCell(h.price, isMin, isMax),
            makeStoreCell(h.store, isMin),
            makeTextCell(h.unitPrice || '—'),
            makeTextCell(h.memo || '—', 'history-memo')
        ];
        cells.forEach(c => row.appendChild(c));
        row.appendChild(makeHistoryDeleteCell(productId, idx, onDeleteHistory));
        return row;
    };

    const DOM_HELPERS = {
        createPriceSpan,
        makeTextCell,
        makePriceCell,
        makeStoreCell,
        createMinStoreSpans,
        createEmptyRow,
        createHistoryTable,
        createDetailsRow,
        createProductRow,
        makeHistoryDeleteCell,
        createHistoryRow
    };

    factory(root, DOM_HELPERS);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.DOM_HELPERS = mod;
    }
});
