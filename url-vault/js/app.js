// ============================================================
// 定数
// ============================================================

// IndexedDB設定
const DB = {
    NAME: 'HighDensityTabManagerDB_v2',
    VERSION: 1
};

// ソート設定
const SORT_OPTIONS = [
    { key: 'sortOrder', label: '手動順' },
    { key: 'title', label: 'タイトル順' },
    { key: 'createdAt', label: '登録順' }
];

// 画像処理設定
const IMAGE = {
    MAX_W: 440,
    MAX_H: 620,
    JPEG_QUALITY: 0.7
};

// タイムアウト・間隔（ミリ秒）
const TIMING = {
    TOAST_DURATION: 3000,
    TOAST_HIDE_ANIM: 200,
    PANEL_ANIM: 180,
    SYNOPSIS: {
        FETCH_INTERVAL: 1200,    // 全取得の1件ごとの間隔
        RETRY_INTERVAL: 500     // 短縮再リクエストの間隔
    }
};

// あらすじ取得エラーメッセージ
const SYNOPSIS_ERROR_MESSAGES = {
    http: 'API通信エラーが発生しました（HTTPエラー）',
    api: 'APIエラーが発生しました',
    network: 'ネットワークエラーが発生しました'
};

// 表示閾値
const TOAST_TITLE_MAX_LEN = 20;

// ゴミ箱（予約ID）。削除は物理削除せずゴミ箱への移動とする
const TRASH = {
    WINDOW_ID: 99999,
    GROUP_ID: 99999,
    WINDOW_NAME: '🗑 ゴミ箱',
    GROUP_NAME: 'ゴミ箱'
};

// ============================================================
// 状態変数（ミュータブル）
// ============================================================

let db = null;
let sortableInstance = null;

// フィルタ・ソート状態
const filterState = {
    selectedWindowId: null,
    selectedGroupId: null,
    sortKey: 'sortOrder',
    sortAsc: true,
    searchQuery: '',
    renderId: 0,
    selectedGroupByWindow: {}, // ウィンドウごとの最終選択グループID { windowId: groupId }
    dupCheckEnabled: false, // 重複チェックON（表示中リストの重複候補のみ表示）
    dupCheckLength: 6 // 重複判定の作品名先頭文字数
};

// アイテム編集状態
const editState = {
    imageDataBase64: '',
    addPositionTop: true,
    editingItemId: null, // 編集中のアイテムID（null=新規作成モード）
    isEditMode: false // ✏ 編集モード（ウィンドウ・グループ・アイテム編集のトグル）
};

// UI状態
const uiState = {
    synopsisPanelItemId: null, // 右ペイン表示中のアイテムID（トグル用）
    toastTimer: null, // トーストの自動消滅タイマー
    toastVisible: false, // トースト表示中フラグ
    blurEnabled: false // サムネぼかし有効フラグ
};

// ============================================================
// モジュール関数のインポート
// ============================================================

const {
    parseVolume,
    parseBaseTitle
} = window.TITLE_PARSER;
const {
    calcNextSortOrder,
    shiftSortOrders,
    buildNewItem,
    sortItems,
    isValidItemInput,
    stripSynopsisForExport
} = window.ITEM_LOGIC;
const {
    isKindleUrl,
    hasSynopsis,
    filterVisibleItems,
    updateGroupMemory,
    getRememberedGroup,
    validateRememberedGroup,
    filterDuplicates
} = window.FILTER_LOGIC;
const {
    buildRakutenUrl,
    buildVolumeMap,
    selectTargetVolumes,
    tokenizeQuery,
    shortenQuery
} = window.SYNOPSIS_LOGIC;
const {
    serializeUIState,
    deserializeUIState
} = window.UI_LOGIC;

// ============================================================
// アプリ初期化・データビュー更新
// ============================================================

const initApp = () => {
    loadUIState();
    loadToggleStates();
    ensureTrashExists();
    updateSelectBoxes();
    renderSortButtons();
    renderFilters();
    renderList({ resetScroll: true });
    initDragAndDrop();
};

const refreshDataView = () => {
    updateSelectBoxes();
    renderFilters();
    renderList({ resetScroll: true });
};

// ============================================================
// UI 状態の保存と復元（sessionStorage）
// ============================================================

const updateAddPositionBtn = () => {
    const btn = document.getElementById('toggleAddPositionBtn');
    btn.textContent = editState.addPositionTop ? '⬆' : '⬇';
    btn.style.backgroundColor = editState.addPositionTop ? '' : '#2a2a2a';
    btn.style.color = editState.addPositionTop ? '' : '#ccc';
    btn.style.borderColor = editState.addPositionTop ? '' : '#444';
};

const loadToggleStates = () => {
    const leftPanel = document.getElementById('leftPanel');
    const navContainer = document.getElementById('navContainer');
    if (sessionStorage.getItem('leftPanelHidden') === 'true') leftPanel.classList.add('hidden');
    if (sessionStorage.getItem('navContainerHidden') === 'true') navContainer.classList.add('hidden');

    updateAddPositionBtn();
    updateDupCheckBtn();
    document.getElementById('dupCheckLengthInput').value = filterState.dupCheckLength;
};

// 重複チェックボタンのON/OFF見た目と文字数入力欄の表示を反映（ON=filter-btnのactive＋入力欄表示）
const updateDupCheckBtn = () => {
    const btn = document.getElementById('toggleDupCheckBtn');
    btn.classList.toggle('active', filterState.dupCheckEnabled);
    const wrap = document.getElementById('dupCheckLengthWrap');
    wrap.classList.toggle('hidden', !filterState.dupCheckEnabled);
};

// 重複チェックON/OFF切替
const toggleDupCheck = () => {
    filterState.dupCheckEnabled = !filterState.dupCheckEnabled;
    updateDupCheckBtn();
    saveUIState();
    renderList({ resetScroll: true });
};

// 重複判定の先頭文字数を変更
const changeDupCheckLength = (value) => {
    const n = parseInt(value, 10);
    filterState.dupCheckLength = isNaN(n) || n < 1 ? 1 : n;
    saveUIState();
    renderList({ resetScroll: true });
};

const saveUIState = () => {
    sessionStorage.setItem('uiState', serializeUIState({
        windowId: filterState.selectedWindowId,
        groupId: filterState.selectedGroupId,
        sortKey: filterState.sortKey,
        sortAsc: filterState.sortAsc,
        addPositionTop: editState.addPositionTop,
        selectedGroupByWindow: filterState.selectedGroupByWindow,
        dupCheckEnabled: filterState.dupCheckEnabled,
        dupCheckLength: filterState.dupCheckLength
    }));
};

const loadUIState = () => {
    const state = deserializeUIState(sessionStorage.getItem('uiState'));
    if (!state) return;
    filterState.selectedWindowId = state.windowId;
    filterState.selectedGroupId = state.groupId;
    filterState.sortKey = state.sortKey;
    filterState.sortAsc = state.sortAsc;
    editState.addPositionTop = state.addPositionTop;
    filterState.selectedGroupByWindow = state.selectedGroupByWindow;
    filterState.dupCheckEnabled = state.dupCheckEnabled;
    filterState.dupCheckLength = state.dupCheckLength;
};

// ゴミ箱ウィンドウ/グループが存在しなければ作成
const ensureTrashExists = () => {
    const tx = db.transaction(['windows', 'groups'], 'readwrite');
    const winStore = tx.objectStore('windows');
    const groupStore = tx.objectStore('groups');
    winStore.get(TRASH.WINDOW_ID).onsuccess = (e) => {
        if (!e.target.result) winStore.put({ id: TRASH.WINDOW_ID, name: TRASH.WINDOW_NAME });
    };
    groupStore.get(TRASH.GROUP_ID).onsuccess = (e) => {
        if (!e.target.result) groupStore.put({ id: TRASH.GROUP_ID, windowId: TRASH.WINDOW_ID, name: TRASH.GROUP_NAME });
    };
};

// ============================================================
// セレクトボックス同期
// ============================================================

const updateSelectBoxes = () => {
    const tx = db.transaction(['windows', 'groups'], 'readonly');
    tx.objectStore('windows').getAll().onsuccess = (e) => {
        const windows = e.target.result;
        const targetWin = document.getElementById('targetWindowSelect');
        const itemWin = document.getElementById('itemWindowSelect');

        const prevTargetVal = targetWin.value;
        const prevItemVal = itemWin.value;

        targetWin.innerHTML = '';
        itemWin.innerHTML = '';
        windows.forEach(w => {
            // ゴミ箱ウィンドウは新規作成/グループ作成の選択肢から除外
            if (w.id === TRASH.WINDOW_ID) return;
            targetWin.add(new Option(w.name, w.id));
            itemWin.add(new Option(w.name, w.id));
        });

        if (prevTargetVal) targetWin.value = prevTargetVal;
        if (prevItemVal) itemWin.value = prevItemVal;

        updateGroupSelectBox();
    };
};

const updateGroupSelectBox = () => {
    const winId = parseInt(document.getElementById('itemWindowSelect').value);
    const itemGroupSelect = document.getElementById('itemGroupSelect');

    const prevGroupVal = itemGroupSelect.value;
    itemGroupSelect.innerHTML = '';
    if (isNaN(winId)) return;

    const tx = db.transaction(['groups'], 'readonly');
    tx.objectStore('groups').getAll().onsuccess = (e) => {
        const groups = e.target.result.filter(g => g.windowId === winId);
        groups.forEach(g => itemGroupSelect.add(new Option(g.name, g.id)));

        if (prevGroupVal) itemGroupSelect.value = prevGroupVal;
    };
};

const syncItemSelects = () => {
    const itemWin = document.getElementById('itemWindowSelect');
    const itemGroup = document.getElementById('itemGroupSelect');
    const targetWin = document.getElementById('targetWindowSelect');
    if (filterState.selectedWindowId === null) return;

    targetWin.value = filterState.selectedWindowId;
    itemWin.value = filterState.selectedWindowId;

    const winId = parseInt(itemWin.value);
    if (isNaN(winId)) return;

    const prevGroupVal = itemGroup.value;
    itemGroup.innerHTML = '';

    const tx = db.transaction(['groups'], 'readonly');
    tx.objectStore('groups').getAll().onsuccess = (e) => {
        const groups = e.target.result.filter(g => g.windowId === winId);
        groups.forEach(g => itemGroup.add(new Option(g.name, g.id)));
        if (filterState.selectedGroupId !== null) {
            itemGroup.value = filterState.selectedGroupId;
        } else if (prevGroupVal) {
            itemGroup.value = prevGroupVal;
        }
    };
};

// ============================================================
// データ追加
// ============================================================

const executeAddWindow = () => {
    const input = document.getElementById('newWindowInput');
    const value = input.value.trim();
    if (!value) return;

    db.transaction(['windows'], 'readwrite').objectStore('windows').add({ name: value }).onsuccess = () => {
        input.value = '';
        refreshDataView();
    };
};

const executeAddGroup = () => {
    const input = document.getElementById('newGroupInput');
    const winSelect = document.getElementById('targetWindowSelect');
    const value = input.value.trim();
    if (!value || !winSelect.value) return;

    db.transaction(['groups'], 'readwrite').objectStore('groups').add({
        name: value,
        windowId: parseInt(winSelect.value)
    }).onsuccess = () => {
        input.value = '';
        refreshDataView();
    };
};

// ============================================================
// アイテム保存
// ============================================================

// 入力フォームをクリア
const clearItemForm = () => {
    document.getElementById('title').value = '';
    document.getElementById('url').value = '';
    editState.imageDataBase64 = '';
    preview.style.display = 'none';
    pasteArea.classList.remove('has-image');
};

// 既存アイテムを上書き保存（編集モード）
const saveItemEdit = (winSelect, groupSelect, titleInput, urlInput) => {
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    store.get(editState.editingItemId).onsuccess = (e) => {
        const data = e.target.result;
        if (!data) {
            endItemEdit();
            return;
        }
        const newWindowId = parseInt(winSelect.value);
        const newGroupId = parseInt(groupSelect.value);
        // ウィンドウまたはグループの移動時は新規追加と同じ位置へ再割り当て
        const moved = data.windowId !== newWindowId || data.groupId !== newGroupId;
        if (moved) {
            assignSortOrderAtInsertPosition(store, newGroupId, (sortOrder) => {
                data.sortOrder = sortOrder;
                applyItemEditFields(data, newWindowId, newGroupId, titleInput, urlInput);
                store.put(data);
            });
            return;
        }
        applyItemEditFields(data, newWindowId, newGroupId, titleInput, urlInput);
        store.put(data);
    };
    tx.oncomplete = () => {
        const savedId = editState.editingItemId;
        const savedTitle = titleInput.value;
        const savedUrl = urlInput.value;
        endItemEdit();
        renderList();
        fetchSynopsisIfMissing(savedId, savedTitle, savedUrl);
    };
};

// 指定アイテムがKindleドメインかつあらすじ未取得なら取得する
const fetchSynopsisIfMissing = (itemId, title, url) => {
    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').get(itemId).onsuccess = (ev) => {
        const d = ev.target.result;
        if (d && !hasSynopsis(d)) {
            updateSynopsis(itemId, title, url);
        }
    };
};

// 追加位置設定に従い対象グループ内のsortOrderを計算する（先頭追加時は既存をシフト）
const assignSortOrderAtInsertPosition = (store, groupId, callback) => {
    store.getAll().onsuccess = (e) => {
        const groupItems = e.target.result.filter(item => item.groupId === groupId);
        if (editState.addPositionTop) {
            shiftSortOrders(groupItems).forEach(item => store.put(item));
        }
        callback(calcNextSortOrder(groupItems, editState.addPositionTop));
    };
};

// 編集アイテムの表示フィールド（sortOrder以外）を上書きする
const applyItemEditFields = (data, newWindowId, newGroupId, titleInput, urlInput) => {
    data.windowId = newWindowId;
    data.groupId = newGroupId;
    data.title = titleInput.value;
    data.url = urlInput.value;
    if (editState.imageDataBase64) {
        data.image = editState.imageDataBase64;
    }
};

// 新規アイテムを保存
const saveItemNew = (winSelect, groupSelect, titleInput, urlInput) => {
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    const newGroupId = parseInt(groupSelect.value);
    assignSortOrderAtInsertPosition(store, newGroupId, (sortOrder) => {
        const data = buildNewItem({
            windowId: parseInt(winSelect.value),
            groupId: newGroupId,
            title: titleInput.value,
            url: urlInput.value,
            image: editState.imageDataBase64,
            sortOrder: sortOrder
        }, new Date().getTime());

        store.add(data).onsuccess = (ev) => {
            const newId = ev.target.result;
            clearItemForm();
            titleInput.focus();
            renderList({ resetScroll: true });
            updateSynopsis(newId, data.title, data.url);
        };
    });
};

const saveItem = () => {
    const winSelect = document.getElementById('itemWindowSelect');
    const groupSelect = document.getElementById('itemGroupSelect');
    const titleInput = document.getElementById('title');
    const urlInput = document.getElementById('url');
    if (!isValidItemInput(winSelect.value, groupSelect.value, titleInput.value, urlInput.value)) return;

    if (editState.editingItemId !== null) {
        saveItemEdit(winSelect, groupSelect, titleInput, urlInput);
        return;
    }
    saveItemNew(winSelect, groupSelect, titleInput, urlInput);
};

// 編集モード開始: カードの内容を左パネルへセット
const startItemEdit = (item) => {
    editState.editingItemId = item.id;
    document.getElementById('itemWindowSelect').value = item.windowId;
    updateGroupSelectBox();
    document.getElementById('itemGroupSelect').value = item.groupId;
    document.getElementById('title').value = item.title;
    document.getElementById('url').value = item.url;
    editState.imageDataBase64 = '';
    if (item.image) {
        preview.src = item.image;
        preview.style.display = 'inline-block';
        pasteArea.classList.add('has-image');
    } else {
        preview.style.display = 'none';
        pasteArea.classList.remove('has-image');
    }
    renderSaveBtn();
    renderList();
    document.getElementById('title').focus();
};

// 編集モード終了: 入力欄クリア
const endItemEdit = () => {
    editState.editingItemId = null;
    document.getElementById('title').value = '';
    document.getElementById('url').value = '';
    editState.imageDataBase64 = '';
    preview.style.display = 'none';
    pasteArea.classList.remove('has-image');
    renderSaveBtn();
};

// 保存ボタン表示切替（新規作成 / 更新）
const renderSaveBtn = () => {
    const btn = document.getElementById('saveBtn');
    btn.textContent = editState.editingItemId !== null ? 'アイテムを更新' : 'アイテムを保存';
};

// ============================================================
// 画像処理ユーティリティ
// ============================================================

const sampleColor = (data, width, x, y) => {
    const i = (y * width + x) * 4;
    return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
};

const trimBackground = (img) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const { data, width } = ctx.getImageData(0, 0, img.width, img.height);
    const midY = Math.floor(img.height / 2);
    const margin = Math.max(1, Math.floor(width * 0.01));

    const bgColorLeft = sampleColor(data, width, margin, midY);
    const bgColorRight = sampleColor(data, width, width - 1 - margin, midY);

    let trimLeft = margin;
    let trimRight = margin;
    while (trimLeft < width - 1) {
        if (sampleColor(data, width, trimLeft, midY) !== bgColorLeft) break;
        trimLeft++;
    }
    while (trimRight < width - trimLeft - 1) {
        if (sampleColor(data, width, width - 1 - trimRight, midY) !== bgColorRight) break;
        trimRight++;
    }

    return { trimLeft, trimmedW: width - trimLeft - trimRight, trimmedH: img.height };
};

const resizeToJpeg = (img, trimLeft, trimW, trimH) => {
    let w = trimW;
    let h = trimH;

    if (w > IMAGE.MAX_W || h > IMAGE.MAX_H) {
        const ratio = Math.min(IMAGE.MAX_W / w, IMAGE.MAX_H / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, trimLeft, 0, trimW, trimH, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', IMAGE.JPEG_QUALITY);
};

// ============================================================
// あらすじ取得（楽天ブックスAPI）
// ============================================================

// 楽天APIでタイトル検索し、該当巻の前後2巻（最大3巻）のあらすじを取得
// 楽天APIでタイトル検索。0件なら段階的にクエリを短くして再検索（フォールバック）
const searchItemsByTitle = async (applicationId, accessKey, query) => {
    // 戻り値: { data } | { error } （dataは楽天レスポンス、errorは'http'|'api'|'network'）
    const searchOnce = async (q) => {
        const url = buildRakutenUrl(applicationId, accessKey, q);
        console.log('[synopsis] リクエストURL:', url);
        let res;
        try {
            res = await fetch(url);
        } catch (e) {
            console.error('[synopsis] fetch例外:', e);
            return { error: 'network' };
        }
        if (!res.ok) {
            console.error('[synopsis] HTTPエラー:', res.status);
            return { error: 'http' };
        }
        let data;
        try {
            data = await res.json();
        } catch (e) {
            console.error('[synopsis] JSONパース例外:', e);
            return { error: 'network' };
        }
        if (data.error || data.errors) {
            console.error('[synopsis] APIエラー:', data);
            return { error: 'api' };
        }
        return { data };
    };

    const first = await searchOnce(query);
    if (first.error) return first;
    if (first.data && first.data.Items && first.data.Items.length > 0) return { data: first.data };

    console.warn('[synopsis] 検索結果0件、クエリ短縮で再検索:', query);
    // フォールバック: 記号・空白で区切り、後ろから削って再検索（0.5秒間隔）
    const tokens = tokenizeQuery(query);
    for (let len = tokens.length - 1; len >= 1; len--) {
        await sleep(TIMING.SYNOPSIS.RETRY_INTERVAL);
        const shorter = shortenQuery(tokens, len);
        const r = await searchOnce(shorter);
        if (r.error) return r;
        if (r.data && r.data.Items && r.data.Items.length > 0) return { data: r.data };
        console.warn('[synopsis] 検索結果0件、更に短縮:', shorter);
    }
    return { data: { Items: [] } };
};

const fetchSynopsis = async (title, explicitVolume) => {
    if (!window.RAKUTEN_CONFIG || !window.RAKUTEN_CONFIG.applicationId) {
        console.warn('[synopsis] config.js に楽天APIの認証情報が未設定');
        alert('config.js に楽天APIの認証情報が設定されていません');
        return null;
    }
    const { applicationId, accessKey } = window.RAKUTEN_CONFIG;
    const baseTitle = parseBaseTitle(title);
    const currentVolume = explicitVolume ? parseInt(explicitVolume, 10) : parseVolume(title);
    console.log('[synopsis] 検索タイトル:', baseTitle, '(巻数:', currentVolume + ')');

    const result = await searchItemsByTitle(applicationId, accessKey, baseTitle);
    if (result.error) return { error: result.error };
    const data = result.data;
    if (!data.Items || data.Items.length === 0) {
        console.warn('[synopsis] 最終的に検索結果0件:', baseTitle);
        return null;
    }

    // タイトル→巻数→あらすじ に整理
    const volumeMap = buildVolumeMap(data.Items, parseVolume);

    // 起点巻で終わる3巻の窓を選択（例: 1巻→1,2,3 / 3巻→1,2,3 / 5巻→3,4,5）
    const targetVolumes = selectTargetVolumes(volumeMap, currentVolume);

    if (targetVolumes.length === 0) {
        console.warn('[synopsis] あらすじデータなし（APIレスポンスにitemCaptionが無い）:', baseTitle);
        return null;
    }
    console.log('[synopsis] 取得巻:', targetVolumes.map(t => t.volume).join(','));

    return targetVolumes;
};

// 指定アイテムのあらすじを取得して保存。エラー時はトースト表示して { error } を返す
const updateSynopsis = async (itemId, title, url, explicitVolume) => {
    if (!isKindleUrl(url)) return { skipped: true };
    const result = await fetchSynopsis(title, explicitVolume);
    if (result && result.error) {
        const msg = SYNOPSIS_ERROR_MESSAGES[result.error] || 'あらすじ取得に失敗しました';
        showToast(`${msg}: ${title.slice(0, TOAST_TITLE_MAX_LEN)}`, { error: true });
        return { error: result.error };
    }
    const synopsis = result;
    if (!synopsis) return { empty: true };
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    store.get(itemId).onsuccess = (e) => {
        const data = e.target.result;
        if (data) {
            data.synopsis = synopsis;
            store.put(data);
        }
    };
    tx.oncomplete = () => renderList();
    return { ok: true };
};

// あらすじモーダル表示
// 右ペインにあらすじ表示。editedStateがあればその値を入力欄に引き継ぐ
// あらすじ本文（各巻のあらすじ）を描画
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
const createRefetchButton = (item, titleInput, volInput) => {
    const btn = document.createElement('button');
    btn.textContent = hasSynopsis(item) ? '再取得' : '取得';
    btn.className = 'synopsis-fetch-btn';
    btn.onclick = async () => {
        const editedTitle = titleInput.value.trim();
        const editedVolume = volInput.value.trim();
        if (!editedTitle) return;
        btn.disabled = true;
        btn.textContent = '取得中...';
        await updateSynopsis(item.id, editedTitle, item.url, editedVolume);
        db.transaction(['items'], 'readonly').objectStore('items').get(item.id).onsuccess = (ev) => {
            if (ev.target.result) {
                showSynopsisPanel(ev.target.result, { title: editedTitle, volume: editedVolume });
            }
        };
    };
    return btn;
};

// あらすじ編集フォーム（タイトル・巻数・再取得ボタン）を描画
const renderSynopsisForm = (item, bodyEl, editedState) => {
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

    const refetchBtn = createRefetchButton(item, titleInput, volInput);

    const volRow = document.createElement('div');
    volRow.className = 'synopsis-vol-row';
    volRow.appendChild(volLabel);
    volRow.appendChild(volInput);
    volRow.appendChild(refetchBtn);
    formWrap.appendChild(volRow);

    bodyEl.appendChild(formWrap);
};

const showSynopsisPanel = (item, editedState) => {
    const panel = document.getElementById('synopsisPanel');
    const titleEl = document.getElementById('synopsisPanelTitle');
    const bodyEl = document.getElementById('synopsisPanelBody');

    // 同一アイテムを再度指定したらトグルで閉じる（editedState再描画時は除く）
    if (!editedState && uiState.synopsisPanelItemId === item.id) {
        hideSynopsisPanel();
        return;
    }
    uiState.synopsisPanelItemId = item.id;

    // フォーカス表示：前回のフォーカスを解除し、対象カードを強調
    document.querySelectorAll('.card.synopsis-active').forEach(c => c.classList.remove('synopsis-active'));
    const activeCard = document.querySelector(`.card[data-id="${item.id}"]`);
    if (activeCard) activeCard.classList.add('synopsis-active');

    titleEl.textContent = item.title;
    bodyEl.innerHTML = '';
    renderSynopsisContent(item, bodyEl);
    renderSynopsisForm(item, bodyEl, editedState);

    panel.style.display = 'flex';
    panel.classList.remove('synopsis-panel-open');
    void panel.offsetWidth;
    panel.classList.add('synopsis-panel-open');

    // パネル展開でカード一覧の幅が縮み対象カードが押し出されるのを補正する
    if (activeCard) activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

const hideSynopsisPanel = () => {
    const panel = document.getElementById('synopsisPanel');
    const bodyEl = document.getElementById('synopsisPanelBody');
    const titleEl = document.getElementById('synopsisPanelTitle');
    // 非表示中は再侵入を防ぐためIDをnull化
    uiState.synopsisPanelItemId = null;
    // フォーカス表示を解除
    document.querySelectorAll('.card.synopsis-active').forEach(c => c.classList.remove('synopsis-active'));
    // 閉じるアニメーション後に非表示
    panel.classList.remove('synopsis-panel-open');
    panel.classList.add('synopsis-panel-close');
    setTimeout(() => {
        panel.classList.remove('synopsis-panel-close');
        panel.style.display = 'none';
        titleEl.textContent = 'あらすじ';
        bodyEl.innerHTML = '<p class="synopsis-empty">カードを右クリックするとあらすじを表示します</p>';
    }, TIMING.PANEL_ANIM);
};

// 共通トースト（右上・アニメーション付き）
// opts: { persistent: 進行中表示（手動で消すまで残す）, error: エラー扱い（赤） }
// 既に表示中の更新はテキストのみ書き換え（登場/消去アニメーションは最初と最後の1回だけ）
const showToast = (msg, opts = {}) => {
    const toast = document.getElementById('synopsisToast');
    toast.textContent = msg;
    toast.classList.toggle('error', !!opts.error);

    if (uiState.toastVisible) {
        // 表示中: テキスト更新のみ（アニメーションしない）
        if (uiState.toastTimer) {
            clearTimeout(uiState.toastTimer);
            uiState.toastTimer = null;
        }
        if (!opts.persistent) {
            uiState.toastTimer = setTimeout(() => hideToast(), TIMING.TOAST_DURATION);
        }
        return;
    }

    // 新規表示: 登場アニメーション
    uiState.toastVisible = true;
    toast.classList.remove('synopsis-toast-hide');
    toast.style.display = 'block';
    toast.classList.remove('synopsis-toast-show');
    void toast.offsetWidth;
    toast.classList.add('synopsis-toast-show');

    if (!opts.persistent) {
        uiState.toastTimer = setTimeout(() => hideToast(), TIMING.TOAST_DURATION);
    }
};

const hideToast = () => {
    const toast = document.getElementById('synopsisToast');
    if (!uiState.toastVisible) return;
    uiState.toastVisible = false;
    toast.classList.remove('synopsis-toast-show');
    toast.classList.add('synopsis-toast-hide');
    if (uiState.toastTimer) {
        clearTimeout(uiState.toastTimer);
        uiState.toastTimer = null;
    }
    setTimeout(() => { toast.style.display = 'none'; }, TIMING.TOAST_HIDE_ANIM);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchAllSynopsis = async (force) => {
    const message = force
        ? '表示中のKindleアイテムのあらすじを全件再取得（上書き）しますか？'
        : '表示中のKindleアイテムのうち、あらすじ未取得のものを取得しますか？';
    if (!confirm(message)) return;

    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = async (e) => {
        const items = filterVisibleItems(e.target.result, filterState.selectedWindowId, filterState.selectedGroupId, filterState.searchQuery, TRASH.WINDOW_ID);
        // force=true: Kindleドメイン全件 / force=false: Kindleドメインかつ未取得
        const targets = items.filter(item =>
            isKindleUrl(item.url) && (force || !hasSynopsis(item))
        );
        if (targets.length === 0) {
            showToast('取得対象のアイテムはありません', { error: true });
            return;
        }
        const btn = document.getElementById('fetchAllSynopsisBtn');
        const btnForce = document.getElementById('fetchAllSynopsisForceBtn');
        btn.disabled = true;
        btnForce.disabled = true;
        showToast(`あらすじ取得中... (0/${targets.length})`, { persistent: true });
        let done = 0;
        let errorCount = 0;
        for (const item of targets) {
            showToast(`あらすじ取得中... (${done}/${targets.length}) ${item.title.slice(0, TOAST_TITLE_MAX_LEN)}`, { persistent: true });
            const r = await updateSynopsis(item.id, item.title, item.url);
            done++;
            if (r && r.error) errorCount++;
            // レートリミット対策: 1.2秒間隔に間引く（最後は待たない）
            if (done < targets.length) await sleep(TIMING.SYNOPSIS.FETCH_INTERVAL);
        }
        const summary = `あらすじ取得完了 (${done}/${targets.length}${errorCount > 0 ? `, エラー${errorCount}件` : ''})`;
        showToast(summary, { error: errorCount > 0 });
        btn.disabled = false;
        btnForce.disabled = false;
    };
};

// ============================================================
// 画像ペースト
// ============================================================

const handleImagePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            const img = new Image();
            img.onload = () => {
                const { trimLeft, trimmedW, trimmedH } = trimBackground(img);
                editState.imageDataBase64 = resizeToJpeg(img, trimLeft, trimmedW, trimmedH);

                preview.src = editState.imageDataBase64;
                preview.style.display = 'inline-block';
                pasteArea.classList.add('has-image');
                URL.revokeObjectURL(img.src);

                const titleInput = document.getElementById('title');
                const urlInput = document.getElementById('url');
                if (titleInput.value.trim() && urlInput.value.trim()) {
                    saveItem();
                }
            };
            img.src = URL.createObjectURL(blob);
            break;
        }
    }
};

const handleTwoLinePaste = (e) => {
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const lines = pastedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length >= 2 && lines[1].startsWith('http')) {
        e.preventDefault();
        document.getElementById('title').value = lines[0];
        document.getElementById('url').value = lines[1];
    }
};

// ============================================================
// ソートボタン
// ============================================================

const renderSortButtons = () => {
    const sortRow = document.getElementById('sortRow');
    sortRow.innerHTML = '';
    SORT_OPTIONS.forEach(opt => {
        const btn = document.createElement('button');
        const isActive = filterState.sortKey === opt.key;
        btn.className = `sort-btn ${isActive ? 'active' : ''}`;
        btn.textContent = opt.label;
        if (isActive && opt.key !== 'sortOrder') {
            const arrow = document.createElement('span');
            arrow.className = 'arrow';
            arrow.textContent = filterState.sortAsc ? '▲' : '▼';
            btn.appendChild(arrow);
        }
        btn.onclick = () => {
            if (filterState.sortKey === opt.key && opt.key !== 'sortOrder') {
                filterState.sortAsc = !filterState.sortAsc;
            } else {
                filterState.sortKey = opt.key;
                filterState.sortAsc = true;
            }
            saveUIState();
            renderSortButtons();
            renderList({ resetScroll: true });
        };
        sortRow.appendChild(btn);
    });
};

// ============================================================
// フィルター描画
// ============================================================

// フィルタ選択切替の共通処理（右ペイン閉じる→保存→再描画）
const applyFilterChange = (windowId, groupId) => {
    filterState.selectedWindowId = windowId;
    filterState.selectedGroupId = groupId;
    // グループを選んだ場合はウィンドウごとの記憶を更新
    if (groupId !== null && windowId !== null) {
        filterState.selectedGroupByWindow = updateGroupMemory(filterState.selectedGroupByWindow, windowId, groupId);
    }
    hideSynopsisPanel();
    saveUIState();
    renderFilters();
    renderList({ resetScroll: true });
};

// ウィンドウ切替: 最後に選んだグループを復元（無効ならnull）
const changeWindow = (windowId) => {
    const remembered = getRememberedGroup(filterState.selectedGroupByWindow, windowId);
    applyFilterChange(windowId, remembered);
};

// フィルタ編集/削除アイコンのクリック共通処理
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

const renderFilters = () => {
    const myId = ++filterState.renderId;
    const winRow = document.getElementById('windowFilterRow');
    const tx = db.transaction(['windows', 'groups'], 'readonly');
    tx.objectStore('windows').getAll().onsuccess = (e) => {
        if (myId !== filterState.renderId) return;
        winRow.innerHTML = '';
        const windows = e.target.result;

        // 「すべて」ボタン
        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${filterState.selectedWindowId === null ? 'active' : ''}`;
        allBtn.textContent = 'すべて';
        allBtn.onclick = () => changeWindow(null);
        winRow.appendChild(allBtn);

        // 通常ウィンドウ
        windows.forEach(w => {
            if (w.id === TRASH.WINDOW_ID) return;
            const btn = document.createElement('button');
            const classes = ['filter-btn'];
            if (filterState.selectedWindowId === w.id) classes.push('active');
            if (editState.isEditMode) classes.push('editable-btn');
            btn.className = classes.join(' ');
            btn.textContent = w.name;
            btn.onclick = () => changeWindow(w.id);
            if (editState.isEditMode) {
                appendFilterIcons(btn, () => startEditFilter(w.id, 'windows', w.name, btn), () => deleteWindow(w.id, w.name));
            }
            winRow.appendChild(btn);
        });

        // ゴミ箱ウィンドウ
        const trashWindow = windows.find(w => w.id === TRASH.WINDOW_ID);
        if (trashWindow) {
            const trashBtn = document.createElement('button');
            const classes = ['filter-btn', 'trash-btn'];
            if (filterState.selectedWindowId === TRASH.WINDOW_ID) classes.push('active');
            trashBtn.className = classes.join(' ');
            trashBtn.textContent = trashWindow.name;
            trashBtn.onclick = () => changeWindow(TRASH.WINDOW_ID);
            winRow.appendChild(trashBtn);
        }
        renderGroupFilters(tx);
        syncItemSelects();
    };
};

const renderGroupFilters = (tx) => {
    const myId = filterState.renderId;
    const groupRow = document.getElementById('groupFilterRow');
    if (filterState.selectedWindowId === null) {
        groupRow.innerHTML = '<span style="font-size:11px; color:#555;">ウィンドウを選択してください</span>';
        return;
    }
    tx.objectStore('groups').getAll().onsuccess = (e) => {
        if (myId !== filterState.renderId) return;
        groupRow.innerHTML = '';
        const groups = e.target.result.filter(g => g.windowId === filterState.selectedWindowId);
        filterState.selectedGroupId = validateRememberedGroup(filterState.selectedGroupId, groups);

        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${filterState.selectedGroupId === null ? 'active' : ''}`;
        allBtn.textContent = 'すべて';
        allBtn.onclick = () => applyFilterChange(filterState.selectedWindowId, null);
        groupRow.appendChild(allBtn);

        groups.forEach(g => {
            const btn = document.createElement('button');
            const classes = ['filter-btn'];
            if (filterState.selectedGroupId === g.id) classes.push('active');
            if (editState.isEditMode) classes.push('editable-btn');
            btn.className = classes.join(' ');
            btn.textContent = g.name;
            btn.onclick = () => applyFilterChange(filterState.selectedWindowId, g.id);
            if (editState.isEditMode) {
                appendFilterIcons(btn, () => startEditFilter(g.id, 'groups', g.name, btn), () => deleteGroup(g.id, g.name));
            }
            groupRow.appendChild(btn);
        });
    };
};

// ============================================================
// フィルタボタンの名前編集・削除
// ============================================================

const startEditFilter = (id, storeName, currentName, btnElement) => {
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
            const tx = db.transaction([storeName], 'readwrite');
            tx.objectStore(storeName).get(id).onsuccess = (e) => {
                const data = e.target.result;
                if (data) {
                    data.name = newName;
                    tx.objectStore(storeName).put(data);
                }
            };
            tx.oncomplete = () => {
                refreshDataView();
                syncItemSelects();
            };
        } else {
            refreshDataView();
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
            refreshDataView();
        }
    };
};

const deleteWindow = (id, name) => {
    if (id === TRASH.WINDOW_ID) return;
    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = (e) => {
        const count = e.target.result.filter(item => item.windowId === id).length;
        if (count > 0) {
            alert(`このウィンドウには${count}件のアイテムが存在します。\n先にアイテムを削除してください。`);
            return;
        }
        if (!confirm(`ウィンドウ「${name}」を削除しますか？`)) return;

        const tx2 = db.transaction(['windows', 'groups'], 'readwrite');
        tx2.objectStore('windows').delete(id);
        tx2.objectStore('groups').getAll().onsuccess = (e2) => {
            e2.target.result.filter(g => g.windowId === id).forEach(g => {
                tx2.objectStore('groups').delete(g.id);
            });
        };
        tx2.oncomplete = () => {
            if (filterState.selectedWindowId === id) {
                filterState.selectedWindowId = null;
                filterState.selectedGroupId = null;
                saveUIState();
            }
            refreshDataView();
            syncItemSelects();
        };
    };
};

const deleteGroup = (id, name) => {
    if (id === TRASH.GROUP_ID) return;
    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = (e) => {
        const count = e.target.result.filter(item => item.groupId === id).length;
        if (count > 0) {
            alert(`このグループには${count}件のアイテムが存在します。\n先にアイテムを削除してください。`);
            return;
        }
        if (!confirm(`グループ「${name}」を削除しますか？`)) return;

        db.transaction(['groups'], 'readwrite').objectStore('groups').delete(id).onsuccess = () => {
            if (filterState.selectedGroupId === id) {
                filterState.selectedGroupId = null;
                saveUIState();
            }
            refreshDataView();
            syncItemSelects();
        };
    };
};

// ゴミ箱を空にする（ゴミ箱内のアイテムを物理削除）
const emptyTrash = () => {
    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = (e) => {
        const trashItems = e.target.result.filter(item => item.windowId === TRASH.WINDOW_ID);
        if (trashItems.length === 0) {
            showToast('ゴミ箱は空です');
            return;
        }
        if (!confirm(`ゴミ箱内の${trashItems.length}件のアイテムを完全に削除しますか？\nこの操作は取り消せません。`)) return;

        const tx2 = db.transaction(['items'], 'readwrite');
        const store = tx2.objectStore('items');
        trashItems.forEach(item => store.delete(item.id));
        tx2.oncomplete = () => {
            renderList({ resetScroll: true });
            showToast(`ゴミ箱を空にしました（${trashItems.length}件削除）`);
        };
    };
};

// ============================================================
// メインカードリスト描画
// ============================================================

// アイテムをゴミ箱へ移動
const moveToTrash = (itemId) => {
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    store.get(itemId).onsuccess = (e) => {
        const data = e.target.result;
        if (data) {
            data.windowId = TRASH.WINDOW_ID;
            data.groupId = TRASH.GROUP_ID;
            store.put(data);
        }
    };
    tx.oncomplete = () => renderList();
};

// 削除ボタンを生成
const createDeleteButton = (itemId) => {
    const btn = document.createElement('button');
    btn.className = 'delete-icon-btn';
    btn.textContent = '×';
    btn.onclick = () => moveToTrash(itemId);
    return btn;
};

// カードの画像領域を生成
const createCardImage = (item) => {
    const imgBox = document.createElement('div');
    imgBox.className = 'card-img-box';
    if (item.image) {
        const img = document.createElement('img');
        img.className = 'card-img';
        img.src = item.image;
        if (uiState.blurEnabled) {
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
const createCardElement = (item) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (editState.editingItemId === item.id) {
        card.classList.add('editing-image');
    }
    if (uiState.synopsisPanelItemId === item.id) {
        card.classList.add('synopsis-active');
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
        if (editState.isEditMode) {
            startItemEdit(item);
            return;
        }
        window.open(item.url, '_blank', 'noopener,noreferrer');
    };
    card.oncontextmenu = (e) => {
        if (editState.isEditMode) return;
        e.preventDefault();
        if (!isKindleUrl(item.url)) {
            showToast('このカードはあらすじ非対応（Kindleドメインのみ）', { error: true });
            return;
        }
        showSynopsisPanel(item);
    };

    card.appendChild(createDeleteButton(item.id));
    card.appendChild(createCardImage(item));
    card.appendChild(createCardContent(item));
    return card;
};

// カード一覧を items の順序・内容に一致させる差分更新（スクロール位置維持のため全破棄しない）
const reconcileList = (listSection, items) => {
    const existing = new Map();
    listSection.querySelectorAll(':scope > .card').forEach((el) => {
        existing.set(el.dataset.id, el);
    });

    items.forEach((item) => {
        const idStr = String(item.id);
        const fresh = createCardElement(item);
        const old = existing.get(idStr);
        if (old) {
            old.replaceWith(fresh);
            existing.delete(idStr);
        }
        listSection.appendChild(fresh);
    });

    existing.forEach((el) => el.remove());
};

const renderList = ({ resetScroll = false } = {}) => {
    const listSection = document.getElementById('listSection');

    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = (e) => {
        let items = filterVisibleItems(e.target.result, filterState.selectedWindowId, filterState.selectedGroupId, filterState.searchQuery, TRASH.WINDOW_ID);
        items = sortItems(items, filterState.sortKey, filterState.sortAsc);
        if (filterState.dupCheckEnabled) {
            items = filterDuplicates(items, filterState.dupCheckLength, parseBaseTitle);
        }

        reconcileList(listSection, items);
        updateDragEnabled();

        // 内容が変わる操作ではスクロールを先頭へ戻す（内容不変の再描画では維持）
        if (resetScroll) {
            listSection.parentElement.scrollTop = 0;
        }

        document.getElementById('cardCount').textContent = `${items.length}件`;
    };
};

// ============================================================
// ドラッグ＆ドロップ並び替え
// ============================================================

const initDragAndDrop = () => {
    const listSection = document.getElementById('listSection');
    sortableInstance = Sortable.create(listSection, {
        animation: 150,
        disabled: filterState.sortKey !== 'sortOrder',
        onEnd: () => saveNewOrder()
    });
};

// ソートキー変更時にD&Dの有効/無効を切替え
const updateDragEnabled = () => {
    if (sortableInstance) {
        sortableInstance.option('disabled', filterState.sortKey !== 'sortOrder');
    }
};

const saveNewOrder = () => {
    const cards = [...document.querySelectorAll('#listSection .card')];
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    cards.forEach((card, index) => {
        const id = parseInt(card.dataset.id);
        store.get(id).onsuccess = (e) => {
            const data = e.target.result;
            if (data) {
                data.sortOrder = index;
                store.put(data);
            }
        };
    });
};

// ============================================================
// エクスポート
// ============================================================

const fetchAllData = (callback) => {
    const backupData = { windows: [], groups: [], items: [] };
    const tx = db.transaction(['windows', 'groups', 'items'], 'readonly');
    tx.objectStore('windows').getAll().onsuccess = (e) => backupData.windows = e.target.result;
    tx.objectStore('groups').getAll().onsuccess = (e) => backupData.groups = e.target.result;
    tx.objectStore('items').getAll().onsuccess = (e) => {
        // あらすじは容量肥大化を避けるためバックアップ対象外
        backupData.items = e.target.result.map(stripSynopsisForExport);
    };
    tx.oncomplete = () => callback(backupData);
};

const handleSaveFile = () => {
    fetchAllData(async (backupData) => {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'url-vault-backup.json',
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(backupData));
            await writable.close();
        } catch (e) {
            if (e.name !== 'AbortError') console.error('ファイルの保存に失敗しました', e);
        }
    });
};

// ============================================================
// インポート
// ============================================================

const importData = (parsedData) => {
    if (!parsedData.windows || !parsedData.groups || !parsedData.items) {
        alert('データ構造が不正です');
        return false;
    }
    if (!confirm('インポートを実行しますか？\n既存のデータはすべて置き換えられます。')) return false;

    const tx = db.transaction(['windows', 'groups', 'items'], 'readwrite');
    tx.objectStore('windows').clear();
    tx.objectStore('groups').clear();
    tx.objectStore('items').clear();

    parsedData.windows.forEach(w => tx.objectStore('windows').put(w));
    parsedData.groups.forEach(g => tx.objectStore('groups').put(g));
    parsedData.items.forEach(i => tx.objectStore('items').put(i));

    tx.oncomplete = () => {
        filterState.selectedWindowId = null;
        filterState.selectedGroupId = null;
        saveUIState();
        initApp();
    };
    return true;
};

const handleLoadFile = async () => {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const file = await handle.getFile();
        const jsonString = await file.text();
        let parsedData;
        try {
            parsedData = JSON.parse(jsonString);
        } catch {
            alert('JSONのパースに失敗しました。');
            return;
        }
        importData(parsedData);
    } catch (e) {
        if (e.name !== 'AbortError') console.error('ファイルの読み込みに失敗しました', e);
    }
};

// ============================================================
// DOMキャッシュ・IndexedDB初期化（実行順序依存のため末尾に配置）
// ============================================================

const pasteArea = document.getElementById('pasteArea');
const preview = document.getElementById('preview');

const request = indexedDB.open(DB.NAME, DB.VERSION);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore('windows', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('groups', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
};
request.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};

// ============================================================
// イベントリスナー登録
// ============================================================

// トグルボタン
document.getElementById('toggleLeftBtn').addEventListener('click', () => {
    const leftPanel = document.getElementById('leftPanel');
    leftPanel.classList.toggle('hidden');
    sessionStorage.setItem('leftPanelHidden', leftPanel.classList.contains('hidden'));
});

document.getElementById('toggleNavBtn').addEventListener('click', () => {
    const navContainer = document.getElementById('navContainer');
    navContainer.classList.toggle('hidden');
    sessionStorage.setItem('navContainerHidden', navContainer.classList.contains('hidden'));
});

document.getElementById('toggleEditModeBtn').addEventListener('click', () => {
    editState.isEditMode = !editState.isEditMode;
    if (!editState.isEditMode) endItemEdit();
    const btn = document.getElementById('toggleEditModeBtn');
    btn.style.backgroundColor = editState.isEditMode ? '#6a4c93' : '';
    btn.style.color = editState.isEditMode ? '#fff' : '';
    renderFilters();
    renderList();
});

// 重複チェックトグル
document.getElementById('toggleDupCheckBtn').addEventListener('click', toggleDupCheck);

// 重複判定の先頭文字数
document.getElementById('dupCheckLengthInput').addEventListener('input', (e) => {
    changeDupCheckLength(e.target.value);
});

// サムネぼかしトグル
document.getElementById('toggleBlurBtn').addEventListener('click', () => {
    uiState.blurEnabled = !uiState.blurEnabled;
    const btn = document.getElementById('toggleBlurBtn');
    btn.style.backgroundColor = uiState.blurEnabled ? '#c62828' : '';
    btn.style.color = uiState.blurEnabled ? '#fff' : '';
    btn.textContent = uiState.blurEnabled ? '🔓 ぼかし解除' : '🔒 ぼかし';
    document.querySelectorAll('.card-img').forEach(img => {
        img.classList.toggle('blurred', uiState.blurEnabled);
    });
});

// 検索
document.getElementById('searchInput').addEventListener('input', (e) => {
    filterState.searchQuery = e.target.value.trim();
    renderList({ resetScroll: true });
});

// 検索欄へのペースト: 2行（タイトル＋URL）ならURL行を排除し、
// 1行目のタイトルをあらすじ検索と同じ短縮処理（parseBaseTitle）で検索
document.getElementById('searchInput').addEventListener('paste', (e) => {
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const lines = pastedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return;
    e.preventDefault();
    const searchQuery = parseBaseTitle(lines[0]);
    e.target.value = searchQuery;
    filterState.searchQuery = searchQuery;
    renderList({ resetScroll: true });
});

// セレクトボックス
document.getElementById('itemWindowSelect').addEventListener('change', updateGroupSelectBox);

// ウィンドウ追加
document.getElementById('addWindowBtn').addEventListener('click', executeAddWindow);
document.getElementById('newWindowInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        executeAddWindow();
    }
});

// グループ追加
document.getElementById('addGroupBtn').addEventListener('click', executeAddGroup);
document.getElementById('newGroupInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        executeAddGroup();
    }
});

// ペースト
document.getElementById('title').addEventListener('paste', (e) => {
    const hasImage = [...e.clipboardData.items].some(item => item.type.indexOf('image') !== -1);
    const hasPlainText = [...e.clipboardData.items].some(item => item.type === 'text/plain');
    if (hasImage && !hasPlainText) {
        handleImagePaste(e);
    } else {
        handleTwoLinePaste(e);
    }
});
document.getElementById('url').addEventListener('paste', (e) => {
    const hasImage = [...e.clipboardData.items].some(item => item.type.indexOf('image') !== -1);
    const hasPlainText = [...e.clipboardData.items].some(item => item.type === 'text/plain');
    if (hasImage && !hasPlainText) handleImagePaste(e);
});
pasteArea.addEventListener('paste', handleImagePaste);

// Enter で保存
document.getElementById('title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveItem();
    }
});
document.getElementById('url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveItem();
    }
});

// 保存
document.getElementById('saveBtn').addEventListener('click', saveItem);

document.getElementById('fetchAllSynopsisBtn').addEventListener('click', () => fetchAllSynopsis(false));
document.getElementById('fetchAllSynopsisForceBtn').addEventListener('click', () => fetchAllSynopsis(true));

document.getElementById('emptyTrashBtn').addEventListener('click', emptyTrash);

// あらすじパネル
document.getElementById('synopsisPanelClose').addEventListener('click', hideSynopsisPanel);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSynopsisPanel();
});

document.getElementById('toggleAddPositionBtn').addEventListener('click', () => {
    editState.addPositionTop = !editState.addPositionTop;
    updateAddPositionBtn();
    saveUIState();
});

// インポート・エクスポート
document.getElementById('exportFileBtn').addEventListener('click', handleSaveFile);
document.getElementById('importFileBtn').addEventListener('click', handleLoadFile);
