const DB = {
    NAME: 'HighDensityTabManagerDB_v2',
    VERSION: 1
};

const SORT_OPTIONS = [
    { key: 'sortOrder', label: '手動順' },
    { key: 'title', label: 'タイトル順' },
    { key: 'volume', label: '巻数順' },
    { key: 'createdAt', label: '登録順' }
];

const IMAGE = {
    MAX_W: 440,
    MAX_H: 620,
    JPEG_QUALITY: 0.7
};

const TIMING = {
    TOAST_DURATION: 3000,
    TOAST_HIDE_ANIM: 200,
    SYNOPSIS: {
        FETCH_INTERVAL: 1200,
        RETRY_INTERVAL: 1200
    }
};

const SYNOPSIS_ERROR_MESSAGES = {
    http: 'API通信エラーが発生しました（HTTPエラー）',
    api: 'APIエラーが発生しました',
    network: 'ネットワークエラーが発生しました'
};

const TOAST_TITLE_MAX_LEN = 20;

// ゴミ箱（予約ID）。削除は物理削除せずゴミ箱への移動とする
const TRASH = {
    WINDOW_ID: 99999,
    GROUP_ID: 99999,
    WINDOW_NAME: '🗑 ゴミ箱',
    GROUP_NAME: 'ゴミ箱'
};

let db = null;
let sortableInstance = null;

const filterState = {
    selectedWindowId: null,
    selectedGroupId: null,
    sortKey: 'sortOrder',
    sortAsc: true,
    searchQuery: '',
    renderId: 0,
    selectedGroupByWindow: {},
    dupCheckEnabled: false,
    dupCheckLength: 6,
    noSynopsisOnly: false
};

const editState = {
    imageDataBase64: '',
    addPositionTop: true,
    editingItemId: null,
    isEditMode: false
};

const uiState = {
    synopsisPanelItemId: null,
    toastTimer: null,
    toastVisible: false,
    blurEnabled: false
};

const synopsisState = {
    errorResponsesByItem: {}
};

const { parseVolume, parseBaseTitle } = window.TITLE_PARSER;
const {
    calcNextSortOrder,
    shiftSortOrders,
    buildNewItem,
    sortItems,
    isValidItemInput,
    stripSynopsisForExport,
    formatCreatedAtJst
} = window.ITEM_LOGIC;
const {
    isKindleUrl,
    hasSynopsis,
    filterItemsByWindowId,
    filterVisibleItems,
    updateGroupMemory,
    getRememberedGroup,
    validateRememberedGroup,
    filterDuplicates,
    isNoSynopsisItem
} = window.FILTER_LOGIC;
const {
    buildRakutenUrl,
    buildVolumeMap,
    selectTargetVolumes,
    tokenizeQuery,
    shortenQuery,
    formatSynopsisResponses
} = window.SYNOPSIS_LOGIC;
const { serializeUIState, deserializeUIState } = window.UI_LOGIC;

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

const splitPasteLines = (pastedText) =>
    pastedText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

const sampleColor = (data, width, x, y) => {
    const i = (y * width + x) * 4;
    return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
};

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
    if (sessionStorage.getItem('leftPanelHidden') === 'true')
        leftPanel.classList.add('hidden');
    if (sessionStorage.getItem('navContainerHidden') === 'true')
        navContainer.classList.add('hidden');
    if (sessionStorage.getItem('synopsisPanelHidden') === 'true')
        document.getElementById('synopsisPanel').classList.add('hidden');

    updateAddPositionBtn();
    updateDupCheckBtn();
    updateNoSynopsisBtn();
    document.getElementById('dupCheckLengthInput').value =
        filterState.dupCheckLength;
};

const updateDupCheckBtn = () => {
    const btn = document.getElementById('toggleDupCheckBtn');
    btn.classList.toggle('active', filterState.dupCheckEnabled);
    const wrap = document.getElementById('dupCheckLengthWrap');
    wrap.classList.toggle('hidden', !filterState.dupCheckEnabled);
};

const updateNoSynopsisBtn = () => {
    document
        .getElementById('toggleNoSynopsisBtn')
        .classList.toggle('active', filterState.noSynopsisOnly);
};

const updateSearchClearBtn = () => {
    document.getElementById('searchClearBtn').hidden =
        document.getElementById('searchInput').value === '';
};

const toggleDupCheck = () => {
    filterState.dupCheckEnabled = !filterState.dupCheckEnabled;
    updateDupCheckBtn();
    saveUIState();
    renderList({ resetScroll: true });
};

const toggleNoSynopsisOnly = () => {
    filterState.noSynopsisOnly = !filterState.noSynopsisOnly;
    updateNoSynopsisBtn();
    saveUIState();
    renderList({ resetScroll: true });
};

const changeDupCheckLength = (value) => {
    const n = parseInt(value, 10);
    filterState.dupCheckLength = isNaN(n) || n < 1 ? 1 : n;
    saveUIState();
    renderList({ resetScroll: true });
};

const saveUIState = () => {
    sessionStorage.setItem(
        'uiState',
        serializeUIState({
            windowId: filterState.selectedWindowId,
            groupId: filterState.selectedGroupId,
            sortKey: filterState.sortKey,
            sortAsc: filterState.sortAsc,
            addPositionTop: editState.addPositionTop,
            selectedGroupByWindow: filterState.selectedGroupByWindow,
            dupCheckEnabled: filterState.dupCheckEnabled,
            dupCheckLength: filterState.dupCheckLength,
            noSynopsisOnly: filterState.noSynopsisOnly
        })
    );
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
    filterState.noSynopsisOnly = state.noSynopsisOnly;
};

const ensureTrashExists = () => {
    const tx = db.transaction(['windows', 'groups'], 'readwrite');
    const winStore = tx.objectStore('windows');
    const groupStore = tx.objectStore('groups');
    winStore.get(TRASH.WINDOW_ID).onsuccess = (e) => {
        if (!e.target.result)
            winStore.put({ id: TRASH.WINDOW_ID, name: TRASH.WINDOW_NAME });
    };
    groupStore.get(TRASH.GROUP_ID).onsuccess = (e) => {
        if (!e.target.result)
            groupStore.put({
                id: TRASH.GROUP_ID,
                windowId: TRASH.WINDOW_ID,
                name: TRASH.GROUP_NAME
            });
    };
};

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
        windows.forEach((w) => {
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
        const groups = e.target.result.filter((g) => g.windowId === winId);
        groups.forEach((g) => itemGroupSelect.add(new Option(g.name, g.id)));

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
        const groups = e.target.result.filter((g) => g.windowId === winId);
        groups.forEach((g) => itemGroup.add(new Option(g.name, g.id)));
        if (filterState.selectedGroupId !== null) {
            itemGroup.value = filterState.selectedGroupId;
        } else if (prevGroupVal) {
            itemGroup.value = prevGroupVal;
        }
    };
};

const executeAddWindow = () => {
    const input = document.getElementById('newWindowInput');
    const value = input.value.trim();
    if (!value) return;

    db
        .transaction(['windows'], 'readwrite')
        .objectStore('windows')
        .add({ name: value }).onsuccess = () => {
        input.value = '';
        refreshDataView();
    };
};

const executeAddGroup = () => {
    const input = document.getElementById('newGroupInput');
    const winSelect = document.getElementById('targetWindowSelect');
    const value = input.value.trim();
    if (!value || !winSelect.value) return;

    db
        .transaction(['groups'], 'readwrite')
        .objectStore('groups')
        .add({
            name: value,
            windowId: parseInt(winSelect.value)
        }).onsuccess = () => {
        input.value = '';
        refreshDataView();
    };
};

const clearItemForm = () => {
    document.getElementById('title').value = '';
    document.getElementById('url').value = '';
    editState.imageDataBase64 = '';
    preview.style.display = 'none';
    pasteArea.classList.remove('has-image');
};

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
        const moved =
            data.windowId !== newWindowId || data.groupId !== newGroupId;
        if (moved) {
            assignSortOrderAtInsertPosition(store, newGroupId, (sortOrder) => {
                data.sortOrder = sortOrder;
                applyItemEditFields(
                    data,
                    newWindowId,
                    newGroupId,
                    titleInput,
                    urlInput
                );
                store.put(data);
            });
            return;
        }
        applyItemEditFields(
            data,
            newWindowId,
            newGroupId,
            titleInput,
            urlInput
        );
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

const fetchSynopsisIfMissing = (itemId, title, url) => {
    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').get(itemId).onsuccess = (ev) => {
        const d = ev.target.result;
        if (d && !hasSynopsis(d)) {
            updateSynopsis(itemId, title, url);
        }
    };
};

const assignSortOrderAtInsertPosition = (store, groupId, callback) => {
    store.getAll().onsuccess = (e) => {
        const groupItems = e.target.result.filter(
            (item) => item.groupId === groupId
        );
        if (editState.addPositionTop) {
            shiftSortOrders(groupItems).forEach((item) => store.put(item));
        }
        callback(calcNextSortOrder(groupItems, editState.addPositionTop));
    };
};

const applyItemEditFields = (
    data,
    newWindowId,
    newGroupId,
    titleInput,
    urlInput
) => {
    data.windowId = newWindowId;
    data.groupId = newGroupId;
    data.title = titleInput.value;
    data.url = urlInput.value;
    if (editState.imageDataBase64) {
        data.image = editState.imageDataBase64;
    }
};

const saveItemNew = (winSelect, groupSelect, titleInput, urlInput) => {
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    const newGroupId = parseInt(groupSelect.value);
    assignSortOrderAtInsertPosition(store, newGroupId, (sortOrder) => {
        const data = buildNewItem(
            {
                windowId: parseInt(winSelect.value),
                groupId: newGroupId,
                title: titleInput.value,
                url: urlInput.value,
                image: editState.imageDataBase64,
                sortOrder: sortOrder
            },
            new Date().getTime()
        );

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
    if (
        !isValidItemInput(
            winSelect.value,
            groupSelect.value,
            titleInput.value,
            urlInput.value
        )
    )
        return;

    if (editState.editingItemId !== null) {
        saveItemEdit(winSelect, groupSelect, titleInput, urlInput);
        return;
    }
    saveItemNew(winSelect, groupSelect, titleInput, urlInput);
};

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

const endItemEdit = () => {
    editState.editingItemId = null;
    document.getElementById('title').value = '';
    document.getElementById('url').value = '';
    editState.imageDataBase64 = '';
    preview.style.display = 'none';
    pasteArea.classList.remove('has-image');
    renderSaveBtn();
};

const renderSaveBtn = () => {
    const btn = document.getElementById('saveBtn');
    btn.textContent =
        editState.editingItemId !== null ? 'アイテムを更新' : 'アイテムを保存';
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
        if (
            sampleColor(data, width, width - 1 - trimRight, midY) !==
            bgColorRight
        )
            break;
        trimRight++;
    }

    return {
        trimLeft,
        trimmedW: width - trimLeft - trimRight,
        trimmedH: img.height
    };
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

// rawResponses: 全リクエストの生レスポンスを蓄積（デバッグ表示用）
const searchItemsByTitle = async (
    applicationId,
    accessKey,
    query,
    rawResponses
) => {
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
            // HTTPエラー時も本文JSONを記録（取れなければステータス情報）
            let errBody = null;
            try {
                errBody = await res.json();
            } catch {
                errBody = {
                    httpStatus: res.status,
                    statusText: res.statusText
                };
            }
            rawResponses.push({ query: q, error: 'http', body: errBody });
            return { error: 'http' };
        }
        let data;
        try {
            data = await res.json();
        } catch (e) {
            console.error('[synopsis] JSONパース例外:', e);
            return { error: 'network' };
        }
        // APIエラー・成功問わず生レスポンスを記録
        rawResponses.push({ query: q, body: data });
        if (data.error || data.errors) {
            console.error('[synopsis] APIエラー:', data);
            return { error: 'api' };
        }
        return { data };
    };

    const first = await searchOnce(query);
    if (first.error) return first;
    if (first.data && first.data.Items && first.data.Items.length > 0)
        return { data: first.data };

    console.warn('[synopsis] 検索結果0件、クエリ短縮で再検索:', query);
    // 0件なら記号・空白で区切り、後ろから削って再検索
    const tokens = tokenizeQuery(query);
    for (let len = tokens.length - 1; len >= 1; len--) {
        await sleep(TIMING.SYNOPSIS.RETRY_INTERVAL);
        const shorter = shortenQuery(tokens, len);
        const r = await searchOnce(shorter);
        if (r.error) return r;
        if (r.data && r.data.Items && r.data.Items.length > 0)
            return { data: r.data };
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
    const currentVolume = explicitVolume
        ? parseInt(explicitVolume, 10)
        : parseVolume(title);
    console.log(
        '[synopsis] 検索タイトル:',
        baseTitle,
        '(巻数:',
        currentVolume + ')'
    );

    const rawResponses = [];
    const result = await searchItemsByTitle(
        applicationId,
        accessKey,
        baseTitle,
        rawResponses
    );
    if (result.error) return { error: result.error, rawResponses };
    const data = result.data;
    if (!data.Items || data.Items.length === 0) {
        console.warn('[synopsis] 最終的に検索結果0件:', baseTitle);
        return { empty: true, rawResponses };
    }

    const volumeMap = buildVolumeMap(data.Items, parseVolume);
    const targetVolumes = selectTargetVolumes(volumeMap, currentVolume);

    if (targetVolumes.length === 0) {
        console.warn(
            '[synopsis] あらすじデータなし（APIレスポンスにitemCaptionが無い）:',
            baseTitle
        );
        return { empty: true, rawResponses };
    }
    console.log(
        '[synopsis] 取得巻:',
        targetVolumes.map((t) => t.volume).join(',')
    );

    return { synopsis: targetVolumes, rawResponses };
};

const updateSynopsis = async (itemId, title, url, explicitVolume) => {
    if (!isKindleUrl(url)) return { skipped: true };
    const result = await fetchSynopsis(title, explicitVolume);
    if (result && result.error) {
        const msg =
            SYNOPSIS_ERROR_MESSAGES[result.error] ||
            'あらすじ取得に失敗しました';
        showToast(`${msg}: ${title.slice(0, TOAST_TITLE_MAX_LEN)}`, {
            error: true
        });
        return { error: result.error, rawResponses: result.rawResponses };
    }
    if (!result || result.empty)
        return { empty: true, rawResponses: result?.rawResponses };
    const synopsis = result.synopsis;
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

const appendSynopsisCreatedAt = (item, bodyEl) => {
    if (!item.createdAt) return;
    const meta = document.createElement('p');
    meta.className = 'synopsis-meta';
    meta.textContent = `登録日時: ${formatCreatedAtJst(item.createdAt)}`;
    bodyEl.appendChild(meta);
};

const renderSynopsisContent = (item, bodyEl) => {
    if (!hasSynopsis(item)) {
        const empty = document.createElement('p');
        empty.className = 'synopsis-empty';
        if (isKindleUrl(item.url)) {
            empty.textContent = 'あらすじが取得されていません';
        } else {
            empty.textContent =
                'このカードは対象外です（Kindleドメインのみ対応）';
        }
        bodyEl.appendChild(empty);
        return;
    }
    item.synopsis.forEach((s) => {
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
        const r = await updateSynopsis(
            item.id,
            editedTitle,
            item.url,
            editedVolume
        );
        storeSynopsisResponse(item.id, r);
        db
            .transaction(['items'], 'readonly')
            .objectStore('items')
            .get(item.id).onsuccess = (ev) => {
            if (ev.target.result) {
                showSynopsisPanel(ev.target.result, {
                    title: editedTitle,
                    volume: editedVolume
                });
            }
        };
    };
    return btn;
};

const storeSynopsisResponse = (itemId, result) => {
    const isError =
        result && (result.error || result.empty) && result.rawResponses;
    if (isError) {
        synopsisState.errorResponsesByItem[itemId] = {
            rawResponses: result.rawResponses
        };
    } else {
        delete synopsisState.errorResponsesByItem[itemId];
    }
};

const renderSynopsisErrorResponse = (result, jsonContainer) => {
    if (!jsonContainer) return;
    jsonContainer.innerHTML = '';

    const responses = result?.rawResponses;
    const jsonText = formatSynopsisResponses(responses);
    if (!jsonText) return;

    const title = document.createElement('p');
    title.className = 'synopsis-json-title';
    title.textContent = 'APIレスポンス（取得失敗 / あらすじ無し）';
    jsonContainer.appendChild(title);

    const pre = document.createElement('pre');
    pre.className = 'synopsis-json';
    pre.textContent = jsonText;
    jsonContainer.appendChild(pre);
};

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

    const jsonContainer = document.createElement('div');
    jsonContainer.className = 'synopsis-json-container';
    const errorResponse = synopsisState.errorResponsesByItem[item.id] ?? null;
    renderSynopsisErrorResponse(errorResponse, jsonContainer);

    const refetchBtn = createRefetchButton(item, titleInput, volInput);

    const volRow = document.createElement('div');
    volRow.className = 'synopsis-vol-row';
    volRow.appendChild(volLabel);
    volRow.appendChild(volInput);
    volRow.appendChild(refetchBtn);
    formWrap.appendChild(volRow);
    formWrap.appendChild(jsonContainer);

    bodyEl.appendChild(formWrap);
};

const setCardFocus = (stateKey, itemId, className) => {
    clearCardFocus(stateKey, className);
    uiState[stateKey] = itemId;
    const target = document.querySelector(`.card[data-id="${itemId}"]`);
    if (target) target.classList.add(className);
};

const clearCardFocus = (stateKey, className) => {
    uiState[stateKey] = null;
    document
        .querySelectorAll(`.card.${className}`)
        .forEach((c) => c.classList.remove(className));
};

const showSynopsisPanel = (item, editedState) => {
    const titleEl = document.getElementById('synopsisPanelTitle');
    const bodyEl = document.getElementById('synopsisPanelBody');

    if (!editedState && uiState.synopsisPanelItemId === item.id) {
        clearSynopsisPanelSelection();
        return;
    }
    uiState.synopsisPanelItemId = item.id;

    setCardFocus('synopsisPanelItemId', item.id, 'synopsis-active');

    titleEl.textContent = item.title;
    bodyEl.innerHTML = '';
    appendSynopsisCreatedAt(item, bodyEl);
    renderSynopsisContent(item, bodyEl);
    renderSynopsisForm(item, bodyEl, editedState);
};

const clearSynopsisPanelSelection = () => {
    const bodyEl = document.getElementById('synopsisPanelBody');
    const titleEl = document.getElementById('synopsisPanelTitle');
    clearCardFocus('synopsisPanelItemId', 'synopsis-active');
    titleEl.textContent = 'カード詳細';
    bodyEl.innerHTML =
        '<p class="synopsis-empty">カードをクリックすると詳細を表示します</p>';
};

const showToast = (msg, opts = {}) => {
    const toast = document.getElementById('synopsisToast');
    toast.textContent = msg;
    toast.classList.toggle('error', !!opts.error);

    if (uiState.toastVisible) {
        if (uiState.toastTimer) {
            clearTimeout(uiState.toastTimer);
            uiState.toastTimer = null;
        }
        if (!opts.persistent) {
            uiState.toastTimer = setTimeout(
                () => hideToast(),
                TIMING.TOAST_DURATION
            );
        }
        return;
    }

    uiState.toastVisible = true;
    toast.classList.remove('synopsis-toast-hide');
    toast.style.display = 'block';
    toast.classList.remove('synopsis-toast-show');
    void toast.offsetWidth;
    toast.classList.add('synopsis-toast-show');

    if (!opts.persistent) {
        uiState.toastTimer = setTimeout(
            () => hideToast(),
            TIMING.TOAST_DURATION
        );
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
    setTimeout(() => {
        toast.style.display = 'none';
    }, TIMING.TOAST_HIDE_ANIM);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchAllSynopsis = async (force) => {
    const message = force
        ? '表示中のKindleアイテムのあらすじを全件再取得（上書き）しますか？'
        : '表示中のKindleアイテムのうち、あらすじ未取得のものを取得しますか？';
    if (!confirm(message)) return;

    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = async (e) => {
        const items = filterVisibleItems(
            e.target.result,
            filterState.selectedWindowId,
            filterState.selectedGroupId,
            filterState.searchQuery,
            TRASH.WINDOW_ID
        );
        const targets = items.filter(
            (item) => isKindleUrl(item.url) && (force || !hasSynopsis(item))
        );
        if (targets.length === 0) {
            showToast('取得対象のアイテムはありません', { error: true });
            return;
        }
        const btn = document.getElementById('fetchAllSynopsisBtn');
        const btnForce = document.getElementById('fetchAllSynopsisForceBtn');
        btn.disabled = true;
        btnForce.disabled = true;
        showToast(`あらすじ取得中... (0/${targets.length})`, {
            persistent: true
        });
        let done = 0;
        let errorCount = 0;
        for (const item of targets) {
            showToast(
                `あらすじ取得中... (${done}/${targets.length}) ${item.title.slice(0, TOAST_TITLE_MAX_LEN)}`,
                { persistent: true }
            );
            const r = await updateSynopsis(item.id, item.title, item.url);
            storeSynopsisResponse(item.id, r);
            done++;
            if (r && r.error) errorCount++;
            // レートリミット対策: 1.2秒間隔に間引く（最後は待たない）
            if (done < targets.length)
                await sleep(TIMING.SYNOPSIS.FETCH_INTERVAL);
        }
        const summary = `あらすじ取得完了 (${done}/${targets.length}${errorCount > 0 ? `, エラー${errorCount}件` : ''})`;
        showToast(summary, { error: errorCount > 0 });
        btn.disabled = false;
        btnForce.disabled = false;
    };
};

const handleImagePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            const img = new Image();
            img.onload = () => {
                const { trimLeft, trimmedW, trimmedH } = trimBackground(img);
                editState.imageDataBase64 = resizeToJpeg(
                    img,
                    trimLeft,
                    trimmedW,
                    trimmedH
                );

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

const setFormItemFieldsFromLines = (lines) => {
    if (lines.length < 2 || !lines[1].startsWith('http')) return false;
    document.getElementById('title').value = lines[0];
    document.getElementById('url').value = lines[1];
    return true;
};

const handleTwoLinePaste = (e) => {
    const pastedText = (e.clipboardData || window.clipboardData).getData(
        'text'
    );
    const lines = splitPasteLines(pastedText);
    if (setFormItemFieldsFromLines(lines)) {
        e.preventDefault();
    }
};

const renderSortButtons = () => {
    const sortRow = document.getElementById('sortRow');
    sortRow.innerHTML = '';
    SORT_OPTIONS.forEach((opt) => {
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

const applyFilterChange = (windowId, groupId) => {
    filterState.selectedWindowId = windowId;
    filterState.selectedGroupId = groupId;
    if (groupId !== null && windowId !== null) {
        filterState.selectedGroupByWindow = updateGroupMemory(
            filterState.selectedGroupByWindow,
            windowId,
            groupId
        );
    }
    clearSynopsisPanelSelection();
    saveUIState();
    renderFilters();
    renderList({ resetScroll: true });
};

const changeWindow = (windowId) => {
    const remembered = getRememberedGroup(
        filterState.selectedGroupByWindow,
        windowId
    );
    applyFilterChange(windowId, remembered);
};

const onFilterIconClick = (e, handler) => {
    e.stopPropagation();
    handler();
};

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

        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${filterState.selectedWindowId === null ? 'active' : ''}`;
        allBtn.textContent = 'すべて';
        allBtn.onclick = () => changeWindow(null);
        winRow.appendChild(allBtn);

        windows.forEach((w) => {
            if (w.id === TRASH.WINDOW_ID) return;
            const btn = document.createElement('button');
            const classes = ['filter-btn'];
            if (filterState.selectedWindowId === w.id) classes.push('active');
            if (editState.isEditMode) classes.push('editable-btn');
            btn.className = classes.join(' ');
            btn.textContent = w.name;
            btn.onclick = () => changeWindow(w.id);
            if (editState.isEditMode) {
                appendFilterIcons(
                    btn,
                    () => startEditFilter(w.id, 'windows', w.name, btn),
                    () => deleteWindow(w.id, w.name)
                );
            }
            winRow.appendChild(btn);
        });

        const trashWindow = windows.find((w) => w.id === TRASH.WINDOW_ID);
        if (trashWindow) {
            const trashBtn = document.createElement('button');
            const classes = ['filter-btn', 'trash-btn'];
            if (filterState.selectedWindowId === TRASH.WINDOW_ID)
                classes.push('active');
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
        groupRow.innerHTML =
            '<span style="font-size:11px; color:#555;">ウィンドウを選択してください</span>';
        return;
    }
    tx.objectStore('groups').getAll().onsuccess = (e) => {
        if (myId !== filterState.renderId) return;
        groupRow.innerHTML = '';
        const groups = e.target.result.filter(
            (g) => g.windowId === filterState.selectedWindowId
        );
        filterState.selectedGroupId = validateRememberedGroup(
            filterState.selectedGroupId,
            groups
        );

        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${filterState.selectedGroupId === null ? 'active' : ''}`;
        allBtn.textContent = 'すべて';
        allBtn.onclick = () =>
            applyFilterChange(filterState.selectedWindowId, null);
        groupRow.appendChild(allBtn);

        groups.forEach((g) => {
            const btn = document.createElement('button');
            const classes = ['filter-btn'];
            if (filterState.selectedGroupId === g.id) classes.push('active');
            if (editState.isEditMode) classes.push('editable-btn');
            btn.className = classes.join(' ');
            btn.textContent = g.name;
            btn.onclick = () =>
                applyFilterChange(filterState.selectedWindowId, g.id);
            if (editState.isEditMode) {
                appendFilterIcons(
                    btn,
                    () => startEditFilter(g.id, 'groups', g.name, btn),
                    () => deleteGroup(g.id, g.name)
                );
            }
            groupRow.appendChild(btn);
        });
    };
};

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
        if (e.key === 'Enter' && !e.isComposing) {
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
        const count = e.target.result.filter(
            (item) => item.windowId === id
        ).length;
        if (count > 0) {
            alert(
                `このウィンドウには${count}件のアイテムが存在します。\n先にアイテムを削除してください。`
            );
            return;
        }
        if (!confirm(`ウィンドウ「${name}」を削除しますか？`)) return;

        const tx2 = db.transaction(['windows', 'groups'], 'readwrite');
        tx2.objectStore('windows').delete(id);
        tx2.objectStore('groups').getAll().onsuccess = (e2) => {
            e2.target.result
                .filter((g) => g.windowId === id)
                .forEach((g) => {
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
        const count = e.target.result.filter(
            (item) => item.groupId === id
        ).length;
        if (count > 0) {
            alert(
                `このグループには${count}件のアイテムが存在します。\n先にアイテムを削除してください。`
            );
            return;
        }
        if (!confirm(`グループ「${name}」を削除しますか？`)) return;

        db
            .transaction(['groups'], 'readwrite')
            .objectStore('groups')
            .delete(id).onsuccess = () => {
            if (filterState.selectedGroupId === id) {
                filterState.selectedGroupId = null;
                saveUIState();
            }
            refreshDataView();
            syncItemSelects();
        };
    };
};

const emptyTrash = () => {
    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = (e) => {
        const trashItems = filterItemsByWindowId(
            e.target.result,
            TRASH.WINDOW_ID
        );
        if (trashItems.length === 0) {
            showToast('ゴミ箱は空です');
            return;
        }
        if (
            !confirm(
                `ゴミ箱内の${trashItems.length}件のアイテムを完全に削除しますか？\nこの操作は取り消せません。`
            )
        )
            return;

        const tx2 = db.transaction(['items'], 'readwrite');
        const store = tx2.objectStore('items');
        trashItems.forEach((item) => store.delete(item.id));
        tx2.oncomplete = () => {
            renderList({ resetScroll: true });
            showToast(`ゴミ箱を空にしました（${trashItems.length}件削除）`);
        };
    };
};

const moveToTrash = (itemId) => {
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    store.getAll().onsuccess = (e) => {
        const trashItems = filterItemsByWindowId(
            e.target.result,
            TRASH.WINDOW_ID
        );
        store.get(itemId).onsuccess = (e2) => {
            const data = e2.target.result;
            if (data) {
                data.windowId = TRASH.WINDOW_ID;
                data.groupId = TRASH.GROUP_ID;
                data.sortOrder = calcNextSortOrder(trashItems, false);
                store.put(data);
            }
        };
    };
    tx.oncomplete = () => renderList();
};

const createDeleteButton = (itemId) => {
    const btn = document.createElement('button');
    btn.className = 'delete-icon-btn';
    btn.textContent = '×';
    btn.onclick = () => moveToTrash(itemId);
    return btn;
};

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

const createCardContent = (item) => {
    const content = document.createElement('div');
    content.className = 'card-content';
    const title = document.createElement('p');
    title.className = 'card-title';
    title.textContent = item.title;
    content.appendChild(title);
    return content;
};

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

    card.onclick = (e) => {
        if (e.target.closest('.delete-icon-btn')) return;
        if (editState.isEditMode) {
            startItemEdit(item);
            return;
        }
        showSynopsisPanel(item);
        window.open(item.url, '_blank', 'noopener,noreferrer');
    };
    card.oncontextmenu = (e) => {
        if (editState.isEditMode) return;
        e.preventDefault();
        showSynopsisPanel(item);
    };

    card.appendChild(createDeleteButton(item.id));
    card.appendChild(createCardImage(item));
    card.appendChild(createCardContent(item));
    return card;
};

// スクロール位置維持のため全破棄せず差分更新
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
        let items = filterVisibleItems(
            e.target.result,
            filterState.selectedWindowId,
            filterState.selectedGroupId,
            filterState.searchQuery,
            TRASH.WINDOW_ID
        );
        if (filterState.noSynopsisOnly) {
            items = items.filter(isNoSynopsisItem);
        }
        items = sortItems(
            items,
            filterState.sortKey,
            filterState.sortAsc,
            parseVolume
        );
        if (filterState.dupCheckEnabled) {
            items = filterDuplicates(
                items,
                filterState.dupCheckLength,
                parseBaseTitle
            );
        }

        reconcileList(listSection, items);
        updateDragEnabled();

        if (resetScroll) {
            listSection.parentElement.scrollTop = 0;
        }

        document.getElementById('cardCount').textContent = `${items.length}件`;
    };
};

const initDragAndDrop = () => {
    const listSection = document.getElementById('listSection');
    sortableInstance = Sortable.create(listSection, {
        animation: 150,
        disabled: filterState.sortKey !== 'sortOrder',
        onEnd: () => saveNewOrder()
    });
};

const updateDragEnabled = () => {
    if (sortableInstance) {
        sortableInstance.option(
            'disabled',
            filterState.sortKey !== 'sortOrder'
        );
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

const fetchAllData = (callback) => {
    const backupData = { windows: [], groups: [], items: [] };
    const tx = db.transaction(['windows', 'groups', 'items'], 'readonly');
    tx.objectStore('windows').getAll().onsuccess = (e) =>
        (backupData.windows = e.target.result);
    tx.objectStore('groups').getAll().onsuccess = (e) =>
        (backupData.groups = e.target.result);
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
                types: [
                    {
                        description: 'JSON',
                        accept: { 'application/json': ['.json'] }
                    }
                ]
            });
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(backupData));
            await writable.close();
        } catch (e) {
            if (e.name !== 'AbortError')
                console.error('ファイルの保存に失敗しました', e);
        }
    });
};

const importData = (parsedData) => {
    if (!parsedData.windows || !parsedData.groups || !parsedData.items) {
        alert('データ構造が不正です');
        return false;
    }
    if (
        !confirm(
            'インポートを実行しますか？\n既存のデータはすべて置き換えられます。'
        )
    )
        return false;

    const tx = db.transaction(['windows', 'groups', 'items'], 'readwrite');
    tx.objectStore('windows').clear();
    tx.objectStore('groups').clear();
    tx.objectStore('items').clear();

    parsedData.windows.forEach((w) => tx.objectStore('windows').put(w));
    parsedData.groups.forEach((g) => tx.objectStore('groups').put(g));
    parsedData.items.forEach((i) => tx.objectStore('items').put(i));

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
            types: [
                {
                    description: 'JSON',
                    accept: { 'application/json': ['.json'] }
                }
            ]
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
        if (e.name !== 'AbortError')
            console.error('ファイルの読み込みに失敗しました', e);
    }
};

// 実行順序依存のため末尾に配置
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

document.getElementById('toggleLeftBtn').addEventListener('click', () => {
    const leftPanel = document.getElementById('leftPanel');
    leftPanel.classList.toggle('hidden');
    sessionStorage.setItem(
        'leftPanelHidden',
        leftPanel.classList.contains('hidden')
    );
});

document.getElementById('toggleRightBtn').addEventListener('click', () => {
    const synopsisPanel = document.getElementById('synopsisPanel');
    synopsisPanel.classList.toggle('hidden');
    sessionStorage.setItem(
        'synopsisPanelHidden',
        synopsisPanel.classList.contains('hidden')
    );
});

document.getElementById('toggleNavBtn').addEventListener('click', () => {
    const navContainer = document.getElementById('navContainer');
    navContainer.classList.toggle('hidden');
    sessionStorage.setItem(
        'navContainerHidden',
        navContainer.classList.contains('hidden')
    );
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

document
    .getElementById('toggleDupCheckBtn')
    .addEventListener('click', toggleDupCheck);

document
    .getElementById('toggleNoSynopsisBtn')
    .addEventListener('click', toggleNoSynopsisOnly);

document
    .getElementById('dupCheckLengthInput')
    .addEventListener('input', (e) => {
        changeDupCheckLength(e.target.value);
    });

document.getElementById('toggleBlurBtn').addEventListener('click', () => {
    uiState.blurEnabled = !uiState.blurEnabled;
    const btn = document.getElementById('toggleBlurBtn');
    btn.style.backgroundColor = uiState.blurEnabled ? '#c62828' : '';
    btn.style.color = uiState.blurEnabled ? '#fff' : '';
    btn.textContent = uiState.blurEnabled ? '🔓 ぼかし解除' : '🔒 ぼかし';
    document.querySelectorAll('.card-img').forEach((img) => {
        img.classList.toggle('blurred', uiState.blurEnabled);
    });
});

document.getElementById('searchInput').addEventListener('input', (e) => {
    filterState.searchQuery = e.target.value.trim();
    updateSearchClearBtn();
    renderList({ resetScroll: true });
});

document.getElementById('searchClearBtn').addEventListener('click', () => {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    filterState.searchQuery = '';
    updateSearchClearBtn();
    renderList({ resetScroll: true });
    searchInput.focus();
});

// 検索欄への2行ペースト: URL行を排除し、1行目をparseBaseTitleで短縮して検索。
// 同時に登録作業用へタイトルと2行目を事前入力
document.getElementById('searchInput').addEventListener('paste', (e) => {
    const pastedText = (e.clipboardData || window.clipboardData).getData(
        'text'
    );
    const lines = splitPasteLines(pastedText);
    if (lines.length < 2) return;
    e.preventDefault();
    const searchQuery = parseBaseTitle(lines[0]);
    e.target.value = searchQuery;
    filterState.searchQuery = searchQuery;
    updateSearchClearBtn();
    renderList({ resetScroll: true });
    document.getElementById('title').value = lines[0];
    document.getElementById('url').value = lines[1];
});

document
    .getElementById('itemWindowSelect')
    .addEventListener('change', updateGroupSelectBox);

document
    .getElementById('addWindowBtn')
    .addEventListener('click', executeAddWindow);

document
    .getElementById('addGroupBtn')
    .addEventListener('click', executeAddGroup);

document.getElementById('title').addEventListener('paste', (e) => {
    const hasImage = [...e.clipboardData.items].some(
        (item) => item.type.indexOf('image') !== -1
    );
    const hasPlainText = [...e.clipboardData.items].some(
        (item) => item.type === 'text/plain'
    );
    if (hasImage && !hasPlainText) {
        handleImagePaste(e);
    } else {
        handleTwoLinePaste(e);
    }
});
document.getElementById('url').addEventListener('paste', (e) => {
    const hasImage = [...e.clipboardData.items].some(
        (item) => item.type.indexOf('image') !== -1
    );
    const hasPlainText = [...e.clipboardData.items].some(
        (item) => item.type === 'text/plain'
    );
    if (hasImage && !hasPlainText) handleImagePaste(e);
});
pasteArea.addEventListener('paste', handleImagePaste);

document.getElementById('saveBtn').addEventListener('click', saveItem);

document
    .getElementById('fetchAllSynopsisBtn')
    .addEventListener('click', () => fetchAllSynopsis(false));
document
    .getElementById('fetchAllSynopsisForceBtn')
    .addEventListener('click', () => fetchAllSynopsis(true));

document.getElementById('emptyTrashBtn').addEventListener('click', emptyTrash);

document
    .querySelector('.list-section-wrapper')
    .addEventListener('click', (e) => {
        if (e.target.closest('.card')) return;
        clearSynopsisPanelSelection();
    });

document
    .getElementById('toggleAddPositionBtn')
    .addEventListener('click', () => {
        editState.addPositionTop = !editState.addPositionTop;
        updateAddPositionBtn();
        saveUIState();
    });

document
    .getElementById('exportFileBtn')
    .addEventListener('click', handleSaveFile);
document
    .getElementById('importFileBtn')
    .addEventListener('click', handleLoadFile);
