// DOM要素生成ヘルパ（状態非依存の純粋関数。ブラウザ/Node両方で利用）
// ブラウザ: window.DOM_HELPERS にエクスポート
// Node: module.exports にエクスポート
// ※ document.createElement を使うが、状態(localStorage/IndexedDB/Date.now)に依存せず
//    引数のみから要素を生成するため純粋関数モジュールとして切り出す
// ※ hasSynopsis/isKindleUrl/parseVolume は FILTER_LOGIC/TITLE_PARSER に依存（window 経由で呼び出し）

((root, factory) => {

    const FILTER_LOGIC = (typeof window !== 'undefined' ? window.FILTER_LOGIC : null)
        || (typeof require === 'function' ? require('./filter-logic.js') : null);
    const TITLE_PARSER = (typeof window !== 'undefined' ? window.TITLE_PARSER : null)
        || (typeof require === 'function' ? require('./title-parser.js') : null);
    const { hasSynopsis, isKindleUrl } = FILTER_LOGIC;
    const { parseVolume } = TITLE_PARSER;

    // フィルタアイコンクリックの共通処理（親要素のクリック発火を抑止してハンドラ呼び出し）
    const onFilterIconClick = (e, handler) => {
        e.stopPropagation();
        handler();
    };

    // フィルタボタンに編集・削除アイコンを付与（共通）
    const appendFilterIcons = (btn, editHandler, deleteHandler) => {
        const editIcon = document.createElement('span');
        editIcon.className = 'icon edit-icon';
        editIcon.textContent = '✏';
        editIcon.onclick = (e) => onFilterIconClick(e, editHandler);
        btn.appendChild(editIcon);

        const delIcon = document.createElement('span');
        delIcon.className = 'icon delete-icon';
        delIcon.textContent = '×';
        delIcon.onclick = (e) => onFilterIconClick(e, deleteHandler);
        btn.appendChild(delIcon);
    };

    // 削除ボタンを生成。onDelete: クリック時に呼ぶコールバック（app.js の moveToTrash を注入）
    const createDeleteButton = (itemId, onDelete) => {
        const btn = document.createElement('button');
        btn.className = 'delete-icon-btn';
        btn.textContent = '×';
        btn.onclick = () => onDelete(itemId);
        return btn;
    };

    // カードの画像領域を生成。blurEnabled: ぼかし表示フラグ（app.js の uiState.blurEnabled を注入）
    const createCardImage = (item, blurEnabled) => {
        const imgBox = document.createElement('div');
        imgBox.className = 'card-img-box';
        if (item.image) {
            const img = document.createElement('img');
            img.className = 'card-img';
            img.src = item.image;
            if (blurEnabled) {
                img.classList.add('blurred');
            }
            imgBox.appendChild(img);
        }
        return imgBox;
    };

    // カードのコンテンツ（タイトル）領域を生成
    const createCardContent = (item) => {
        const content = document.createElement('div');
        content.className = 'card-content';
        const title = document.createElement('p');
        title.className = 'card-title';
        title.textContent = item.title;
        content.appendChild(title);
        return content;
    };

    // カード要素を生成
    // editingItemId: 編集中カードID（app.js editState.editingItemId を注入）
    // isEditMode: 編集モードか（app.js editState.isEditMode を注入）
    // blurEnabled: ぼかし表示フラグ（app.js uiState.blurEnabled を注入）
    // onStartItemEdit/onShowToast/onShowSynopsisPanel/onDelete: 各操作時に呼ぶコールバック（app.js から注入）
    const createCardElement = (item, editingItemId, isEditMode, blurEnabled, onStartItemEdit, onShowToast, onShowSynopsisPanel, onDelete) => {
        const card = document.createElement('div');
        card.className = 'card';
        if (editingItemId === item.id) {
            card.classList.add('editing-image');
        }
        if (hasSynopsis(item)) {
            card.classList.add('has-synopsis');
        } else if (isKindleUrl(item.url)) {
            card.classList.add('no-synopsis');
        }
        card.dataset.id = item.id;
        card.tabIndex = 0;
        card.title = item.title;

        // シングルクリックでリンクオープン、右クリックであらすじ表示（右ペイン）
        card.onclick = (e) => {
            if (e.target.closest('.delete-icon-btn')) return;
            if (isEditMode) {
                onStartItemEdit(item);
                return;
            }
            window.open(item.url, '_blank', 'noopener,noreferrer');
        };
        card.oncontextmenu = (e) => {
            if (isEditMode) return;
            e.preventDefault();
            if (!isKindleUrl(item.url)) {
                onShowToast('このカードはあらすじ非対応（Kindleドメインのみ）', { error: true });
                return;
            }
            onShowSynopsisPanel(item);
        };

        card.appendChild(createDeleteButton(item.id, onDelete));
        card.appendChild(createCardImage(item, blurEnabled));
        card.appendChild(createCardContent(item));
        return card;
    };

    // あらすじ本文を描画（取得済み巻のリスト、または未取得メッセージ）
    const renderSynopsisContent = (item, bodyEl) => {
        if (!hasSynopsis(item)) {
            const empty = document.createElement('p');
            empty.className = 'synopsis-empty';
            if (isKindleUrl(item.url)) {
                empty.textContent = 'あらすじが取得されていません';
            } else {
                empty.textContent = 'あらすじが取得されていません（Kindleドメインのみ取得可能）';
            }
            bodyEl.appendChild(empty);
            return;
        }
        item.synopsis.forEach(s => {
            const wrap = document.createElement('div');
            wrap.className = 'synopsis-volume';
            const t = document.createElement('p');
            t.className = 'synopsis-volume-title';
            t.textContent = `${s.volume}巻`;
            wrap.appendChild(t);
            const text = document.createElement('p');
            text.className = 'synopsis-volume-text';
            text.textContent = s.caption;
            wrap.appendChild(text);
            bodyEl.appendChild(wrap);
        });
    };

    // 再取得ボタンを生成
    // onRefetch: 取得実行時に呼ぶ async コールバック（app.js の updateSynopsis を注入）
    // onRefetched: 取得完了後に最新アイテムを渡すコールバック（app.js の showSynopsisPanel を注入）
    // getItem: itemId から最新アイテムを取得するコールバック（app.js から db 参照を隠すため注入）
    const createRefetchButton = (item, titleInput, volInput, onRefetch, onRefetched, getItem) => {
        const btn = document.createElement('button');
        btn.textContent = hasSynopsis(item) ? '再取得' : '取得';
        btn.className = 'synopsis-fetch-btn';
        btn.onclick = async () => {
            const editedTitle = titleInput.value.trim();
            const editedVolume = volInput.value.trim();
            if (!editedTitle) return;
            btn.disabled = true;
            btn.textContent = '取得中...';
            await onRefetch(item.id, editedTitle, item.url, editedVolume);
            const latest = await getItem(item.id);
            if (latest) {
                onRefetched(latest, { title: editedTitle, volume: editedVolume });
            }
        };
        return btn;
    };

    // あらすじ編集フォーム（タイトル・巻数・再取得ボタン）を描画
    const renderSynopsisForm = (item, bodyEl, editedState, onRefetch, onRefetched, getItem) => {
        if (!isKindleUrl(item.url)) return;

        const formWrap = document.createElement('div');
        formWrap.className = 'synopsis-form';

        const titleLabel = document.createElement('label');
        titleLabel.textContent = 'タイトル（取得に使う作品名）';
        titleLabel.htmlFor = 'synopsisTitleInput';
        formWrap.appendChild(titleLabel);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.id = 'synopsisTitleInput';
        titleInput.className = 'synopsis-input';
        titleInput.value = editedState ? editedState.title : item.title;
        formWrap.appendChild(titleInput);

        const volLabel = document.createElement('label');
        volLabel.textContent = '巻数';
        volLabel.htmlFor = 'synopsisVolumeInput';

        const volInput = document.createElement('input');
        volInput.type = 'number';
        volInput.id = 'synopsisVolumeInput';
        volInput.className = 'synopsis-input synopsis-volume-input';
        volInput.value = editedState ? editedState.volume : parseVolume(item.title);

        const refetchBtn = createRefetchButton(item, titleInput, volInput, onRefetch, onRefetched, getItem);

        const volRow = document.createElement('div');
        volRow.className = 'synopsis-vol-row';
        volRow.appendChild(volLabel);
        volRow.appendChild(volInput);
        volRow.appendChild(refetchBtn);
        formWrap.appendChild(volRow);

        bodyEl.appendChild(formWrap);
    };

    // ソートボタン群を描画
    // sortKey/sortAsc: 現在のソート状態（app.js filterState から注入）
    // sortOptions: ソート選択肢（app.js SORT_OPTIONS を注入）
    // onSortChange: ボタン押下時に呼ぶコールバック（app.js 側で状態更新＋再描画）
    const renderSortButtonRow = (sortRow, sortKey, sortAsc, sortOptions, onSortChange) => {
        sortRow.innerHTML = '';
        sortOptions.forEach(opt => {
            const btn = document.createElement('button');
            const isActive = sortKey === opt.key;
            btn.className = `sort-btn ${isActive ? 'active' : ''}`;
            btn.textContent = opt.label;
            if (isActive && opt.key !== 'sortOrder') {
                const arrow = document.createElement('span');
                arrow.className = 'arrow';
                arrow.textContent = sortAsc ? '▲' : '▼';
                btn.appendChild(arrow);
            }
            btn.onclick = () => onSortChange(opt);
            sortRow.appendChild(btn);
        });
    };

    // フィルタ編集 input を生成し、ボタン要素を入力欄に置換
    // onCommit: 確定時に呼ぶコールバック（app.js 側で db 更新）
    // onCancel: キャンセル時に呼ぶコールバック
    const startFilterEditInput = (id, storeName, currentName, btnElement, onCommit, onCancel) => {
        let finished = false;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = currentName;
        btnElement.textContent = '';
        btnElement.appendChild(input);
        input.focus();

        const finishEdit = () => {
            if (finished) return;
            finished = true;
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                onCommit(id, storeName, newName);
            } else {
                onCancel();
            }
        };

        input.onblur = finishEdit;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.onblur = null;
                finishEdit();
            }
            if (e.key === 'Escape') {
                finished = true;
                input.onblur = null;
                onCancel();
            }
        };
    };

    const DOM_HELPERS = {
        onFilterIconClick,
        appendFilterIcons,
        createDeleteButton,
        createCardImage,
        createCardContent,
        createCardElement,
        renderSynopsisContent,
        createRefetchButton,
        renderSynopsisForm,
        renderSortButtonRow,
        startFilterEditInput
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
