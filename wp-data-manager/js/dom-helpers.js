// DOM要素生成ヘルパ（状態非依存の純粋関数。ブラウザ/Node両方で利用）
// ブラウザ: window.DOM_HELPERS にエクスポート
// Node: module.exports にエクスポート
// ※ document.createElement を使うが、状態(localStorage/IndexedDB/Date.now)に依存せず
//    引数のみから要素を生成するため純粋関数モジュールとして切り出す

((root, factory) => {

    // ドラッグ用のハンドルセル（≡）を生成
    const createDragHandleCell = () => {
        const td = document.createElement('td');
        td.className = 'handle';
        td.textContent = '≡';
        return td;
    };

    // 順序表示セルを生成（クリック不可）
    const createOrderCell = (order) => {
        const td = document.createElement('td');
        td.style.color = '#666';
        td.style.fontWeight = 'bold';
        td.style.textAlign = 'center';
        td.textContent = order;
        return td;
    };

    // 系統名セルを生成（クリックでトグル）
    const createNameCell = (name) => {
        const td = document.createElement('td');
        td.className = 'name-cell';
        td.textContent = name;
        return td;
    };

    // 年齢セルを生成（クリックでトグル）
    const createAgeCell = (age) => {
        const td = document.createElement('td');
        td.className = 'age-cell';
        td.textContent = age;
        return td;
    };

    // 編集可能セルを生成。value は textContent で設定（自動エスケープ、改行は CSS pre-wrap で表示）
    // onStartEdit: クリック時に呼ぶコールバック（app.js の startEdit を注入）
    const createEditableCell = (id, key, value, onStartEdit) => {
        const td = document.createElement('td');
        td.className = 'editable' + (key === 'otherHorseNames' ? ' other-cell' : '');
        td.textContent = value;
        td.addEventListener('click', () => onStartEdit(id, key, td));
        return td;
    };

    // 削除ボタンセルを生成。onDelete: クリック時に呼ぶコールバック（app.js の deleteData を注入）
    const createDeleteCell = (id, onDelete) => {
        const td = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'delete-btn';
        btn.textContent = '削除';
        btn.addEventListener('click', () => onDelete(id));
        td.appendChild(btn);
        return td;
    };

    // 行のドラッグ＆ドロップ以外のクリック（現役/種牡馬トグル）を登録
    // onToggle: クリック時に呼ぶコールバック（app.js の toggleRunner を注入）
    const attachRowEvents = (tr, id, onToggle) => {
        tr.querySelectorAll('td:not(.editable)').forEach(td => {
            if (td.querySelector('button')) return;
            td.style.cursor = 'pointer';
            td.addEventListener('click', () => onToggle(id));
        });
    };

    const DOM_HELPERS = {
        createDragHandleCell,
        createOrderCell,
        createNameCell,
        createAgeCell,
        createEditableCell,
        createDeleteCell,
        attachRowEvents
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
