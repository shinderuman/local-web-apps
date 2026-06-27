// ============================================================
// 定数・変数
// ============================================================

const DB_NAME = 'HighDensityTabManagerDB_v2';
const DB_VERSION = 1;
const SORT_OPTIONS = [
    { key: 'sortOrder', label: '手動順' },
    { key: 'title', label: 'タイトル順' },
    { key: 'createdAt', label: '登録順' },
];
const IMAGE_MAX_W = 440;
const IMAGE_MAX_H = 620;
const IMAGE_JPEG_QUALITY = 0.7;

// 楽天ブックスAPI設定
const RAKUTEN = {
    API_URL: 'https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404',
    GENRE_COMIC: '001001',
    HITS: 30,
};

// Kindleドメイン判定
const KINDLE_URL_PATTERN = /^https?:\/\/read\.amazon\.co\.jp\//;

// タイムアウト・間隔（ミリ秒）
const TIMING = {
    TOAST_DURATION: 3000,
    TOAST_HIDE_ANIM: 200,
    PANEL_ANIM: 180,
    SYNOPSIS_FETCH_INTERVAL: 1200,
};

// 表示閾値
const TOAST_TITLE_MAX_LEN = 20;

let db = null;
let currentSelectedWindowId = null;
let currentSelectedGroupId = null;
let imageDataBase64 = '';
let currentSortKey = 'sortOrder';
let sortAsc = true;
let editMode = false;
let searchQuery = '';
let filterRenderId = 0;
let addPositionTop = true;
let editingItemId = null; // 編集中のアイテムID（null=新規作成モード）
let synopsisPanelItemId = null; // 右ペイン表示中のアイテムID（トグル用）

const pasteArea = document.getElementById('pasteArea');
const preview = document.getElementById('preview');

// ============================================================
// IndexedDB 初期化
// ============================================================

const request = indexedDB.open(DB_NAME, DB_VERSION);
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
// アプリ初期化・データビュー更新
// ============================================================

const initApp = () => {
    loadUIState();
    loadToggleStates();
    updateSelectBoxes();
    renderSortButtons();
    renderFilters();
    renderList();
    initDragAndDrop();
};

const refreshDataView = () => {
    updateSelectBoxes();
    renderFilters();
    renderList();
};

// ============================================================
// UI 状態の保存と復元（sessionStorage）
// ============================================================

const updateAddPositionBtn = () => {
    const btn = document.getElementById('toggleAddPositionBtn');
    btn.textContent = addPositionTop ? '⬆' : '⬇';
    btn.style.backgroundColor = addPositionTop ? '' : '#2a2a2a';
    btn.style.color = addPositionTop ? '' : '#ccc';
    btn.style.borderColor = addPositionTop ? '' : '#444';
};

const loadToggleStates = () => {
    const leftPanel = document.getElementById('leftPanel');
    const navContainer = document.getElementById('navContainer');
    if (sessionStorage.getItem('leftPanelHidden') === 'true') leftPanel.classList.add('hidden');
    if (sessionStorage.getItem('navContainerHidden') === 'true') navContainer.classList.add('hidden');

    updateAddPositionBtn();
};

const saveUIState = () => {
    sessionStorage.setItem('uiState', JSON.stringify({
        windowId: currentSelectedWindowId,
        groupId: currentSelectedGroupId,
        sortKey: currentSortKey,
        sortAsc: sortAsc,
        addPositionTop: addPositionTop,
    }));
};

const loadUIState = () => {
    const saved = sessionStorage.getItem('uiState');
    if (!saved) return;
    const state = JSON.parse(saved);
    currentSelectedWindowId = state.windowId ?? null;
    currentSelectedGroupId = state.groupId ?? null;
    currentSortKey = state.sortKey ?? 'sortOrder';
    sortAsc = state.sortAsc ?? true;
    addPositionTop = state.addPositionTop ?? true;
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
    if (currentSelectedWindowId === null) return;

    targetWin.value = currentSelectedWindowId;
    itemWin.value = currentSelectedWindowId;

    const winId = parseInt(itemWin.value);
    if (isNaN(winId)) return;

    const prevGroupVal = itemGroup.value;
    itemGroup.innerHTML = '';

    const tx = db.transaction(['groups'], 'readonly');
    tx.objectStore('groups').getAll().onsuccess = (e) => {
        const groups = e.target.result.filter(g => g.windowId === winId);
        groups.forEach(g => itemGroup.add(new Option(g.name, g.id)));
        if (currentSelectedGroupId !== null) {
            itemGroup.value = currentSelectedGroupId;
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

const saveItem = () => {
    const winSelect = document.getElementById('itemWindowSelect');
    const groupSelect = document.getElementById('itemGroupSelect');
    const titleInput = document.getElementById('title');
    const urlInput = document.getElementById('url');
    if (!winSelect.value || !groupSelect.value || !titleInput.value || !urlInput.value) return;
    if (isNaN(parseInt(winSelect.value)) || isNaN(parseInt(groupSelect.value))) return;

    // 編集モード: 既存アイテムを上書き（sortOrder/createdAtは保持）
    if (editingItemId !== null) {
        const tx = db.transaction(['items'], 'readwrite');
        const store = tx.objectStore('items');
        store.get(editingItemId).onsuccess = (e) => {
            const data = e.target.result;
            if (!data) { endItemEdit(); return; }
            data.windowId = parseInt(winSelect.value);
            data.groupId = parseInt(groupSelect.value);
            data.title = titleInput.value;
            data.url = urlInput.value;
            // 画像は新しくペーストされた場合のみ上書き
            if (imageDataBase64) data.image = imageDataBase64;
            store.put(data);
        };
        tx.oncomplete = () => {
            const savedId = editingItemId;
            const savedTitle = titleInput.value;
            const savedUrl = urlInput.value;
            endItemEdit();
            renderList();
            // Kindleドメインかつあらすじ未取得なら取得
            const tx2 = db.transaction(['items'], 'readonly');
            tx2.objectStore('items').get(savedId).onsuccess = (ev) => {
                const d = ev.target.result;
                if (d && !d.synopsis) updateSynopsis(savedId, savedTitle, savedUrl);
            };
        };
        return;
    }

    // 新規作成モード
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    store.getAll().onsuccess = (e) => {
        const currentGroupItems = e.target.result.filter(item => item.groupId === parseInt(groupSelect.value));
        currentGroupItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        if (addPositionTop) {
            // 先頭に追加: 既存アイテムを 1, 2, 3... にずらして新規を 0 で追加
            currentGroupItems.forEach((item, i) => {
                item.sortOrder = i + 1;
                store.put(item);
            });
        }

        const data = {
            windowId: parseInt(winSelect.value),
            groupId: parseInt(groupSelect.value),
            title: titleInput.value,
            url: urlInput.value,
            image: imageDataBase64,
            sortOrder: addPositionTop ? 0 : currentGroupItems.length,
            createdAt: new Date().getTime()
        };

        store.add(data).onsuccess = (e) => {
            const newId = e.target.result;
            titleInput.value = '';
            urlInput.value = '';
            imageDataBase64 = '';
            preview.style.display = 'none';
            pasteArea.classList.remove('has-image');
            titleInput.focus();
            renderList();
            // Kindleドメインならあらすじを自動取得
            updateSynopsis(newId, data.title, data.url);
        };
    };
};

// 編集モード開始: カードの内容を左パネルへセット
const startItemEdit = (item) => {
    editingItemId = item.id;
    document.getElementById('itemWindowSelect').value = item.windowId;
    updateGroupSelectBox();
    document.getElementById('itemGroupSelect').value = item.groupId;
    document.getElementById('title').value = item.title;
    document.getElementById('url').value = item.url;
    imageDataBase64 = '';
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
    editingItemId = null;
    document.getElementById('title').value = '';
    document.getElementById('url').value = '';
    imageDataBase64 = '';
    preview.style.display = 'none';
    pasteArea.classList.remove('has-image');
    renderSaveBtn();
};

// 保存ボタン表示切替（新規作成 / 更新）
const renderSaveBtn = () => {
    const btn = document.getElementById('saveBtn');
    btn.textContent = editingItemId !== null ? 'アイテムを更新' : 'アイテムを保存';
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

    if (w > IMAGE_MAX_W || h > IMAGE_MAX_H) {
        const ratio = Math.min(IMAGE_MAX_W / w, IMAGE_MAX_H / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, trimLeft, 0, trimW, trimH, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
};

// ============================================================
// あらすじ取得（楽天ブックスAPI）
// ============================================================

// 全角数字を半角に正規化
const { normalizeDigits, parseVolume, parseBaseTitle } = window.TITLE_PARSER;

// 楽天APIでタイトル検索し、該当巻の前後2巻（最大3巻）のあらすじを取得
// 楽天APIでタイトル検索。0件なら段階的にクエリを短くして再検索（フォールバック）
const searchItemsByTitle = async (applicationId, accessKey, query) => {
    const searchOnce = async (q) => {
        const url = `${RAKUTEN.API_URL}?applicationId=${applicationId}&accessKey=${accessKey}&booksGenreId=${RAKUTEN.GENRE_COMIC}&title=${encodeURIComponent(q)}&hits=${RAKUTEN.HITS}`;
        console.log('[synopsis] リクエストURL:', url);
        let data;
        try {
            const res = await fetch(url);
            if (!res.ok) { console.error('[synopsis] HTTPエラー:', res.status); return null; }
            data = await res.json();
        } catch (e) {
            console.error('[synopsis] fetch例外:', e);
            return null;
        }
        if (data.error || data.errors) { console.error('[synopsis] APIエラー:', data); return null; }
        return data;
    };

    let result = await searchOnce(query);
    if (result && result.Items && result.Items.length > 0) return result;
    console.warn('[synopsis] 検索結果0件、クエリ短縮で再検索:', query);

    // フォールバック: 記号・空白で区切り、後ろから削って再検索
    const tokens = query.split(/[\s　：:、，,]+/).filter(t => t);
    for (let len = tokens.length - 1; len >= 1; len--) {
        const shorter = tokens.slice(0, len).join(' ');
        result = await searchOnce(shorter);
        if (result && result.Items && result.Items.length > 0) return result;
        console.warn('[synopsis] 検索結果0件、更に短縮:', shorter);
    }
    return null;
};

const fetchSynopsis = async (title, explicitVolume, skipParse) => {
    if (!window.RAKUTEN_CONFIG || !window.RAKUTEN_CONFIG.applicationId) {
        console.warn('[synopsis] config.js に楽天APIの認証情報が未設定');
        alert('config.js に楽天APIの認証情報が設定されていません');
        return null;
    }
    const { applicationId, accessKey } = window.RAKUTEN_CONFIG;
    // skipParse=true（フォーム値修正時）はパースせずそのまま使用
    const baseTitle = skipParse ? title : parseBaseTitle(title);
    const currentVolume = explicitVolume ? parseInt(explicitVolume, 10) : parseVolume(title);
    console.log('[synopsis] 検索タイトル:', baseTitle, '(巻数:', currentVolume + ')');

    const data = await searchItemsByTitle(applicationId, accessKey, baseTitle);
    if (!data) {
        console.warn('[synopsis] 最終的に検索結果0件:', baseTitle);
        return null;
    }

    // タイトル→巻数→あらすじ に整理
    const volumeMap = {};
    data.Items.forEach(it => {
        const v = parseVolume(it.Item.title);
        if (!volumeMap[v] && it.Item.itemCaption) {
            volumeMap[v] = { volume: v, title: it.Item.title, caption: it.Item.itemCaption };
        }
    });

    // 起点巻で終わる3巻の窓を作る（前が足りなければ後ろで埋める）
    // 例: 1巻→1,2,3 / 3巻→1,2,3 / 5巻→3,4,5
    const startVolume = Math.max(1, currentVolume - 2);
    const targetVolumes = [startVolume, startVolume + 1, startVolume + 2]
        .map(v => volumeMap[v])
        .filter(Boolean);

    if (targetVolumes.length === 0) {
        console.warn('[synopsis] あらすじデータなし（APIレスポンスにitemCaptionが無い）:', baseTitle);
        return null;
    }
    console.log('[synopsis] 取得巻:', targetVolumes.map(t => t.volume).join(','));

    return targetVolumes;
};

// URLがKindleドメインか判定
const isKindleUrl = (url) => {
    return KINDLE_URL_PATTERN.test(url);
};

// 指定アイテムのあらすじを取得して保存
const updateSynopsis = async (itemId, title, url, explicitVolume, skipParse) => {
    if (!isKindleUrl(url)) return;
    const synopsis = await fetchSynopsis(title, explicitVolume, skipParse);
    if (!synopsis) return;
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    store.get(itemId).onsuccess = (e) => {
        const data = e.target.result;
        if (data) { data.synopsis = synopsis; store.put(data); }
    };
    tx.oncomplete = () => renderList();
};

// あらすじモーダル表示
// 右ペインにあらすじ表示。editedStateがあればその値を入力欄に引き継ぐ
const showSynopsisPanel = (item, editedState) => {
    const panel = document.getElementById('synopsisPanel');
    const titleEl = document.getElementById('synopsisPanelTitle');
    const bodyEl = document.getElementById('synopsisPanelBody');

    // 同一アイテムを再度指定したらトグルで閉じる（editedState再描画時は除く）
    if (!editedState && synopsisPanelItemId === item.id) {
        hideSynopsisPanel();
        return;
    }
    synopsisPanelItemId = item.id;

    titleEl.textContent = item.title;
    bodyEl.innerHTML = '';

    if (!item.synopsis || item.synopsis.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'synopsis-empty';
        if (isKindleUrl(item.url)) {
            empty.textContent = 'あらすじが取得されていません';
        } else {
            empty.textContent = 'あらすじが取得されていません（Kindleドメインのみ取得可能）';
        }
        bodyEl.appendChild(empty);
    } else {
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
    }

    // タイトル・巻数の編集フォームと再取得ボタン（Kindleドメインのみ）
    if (isKindleUrl(item.url)) {
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

        const refetchBtn = document.createElement('button');
        refetchBtn.textContent = item.synopsis && item.synopsis.length > 0 ? '再取得' : '取得';
        refetchBtn.className = 'synopsis-fetch-btn';
        refetchBtn.onclick = async () => {
            const editedTitle = titleInput.value.trim();
            const editedVolume = volInput.value.trim();
            if (!editedTitle) return;
            refetchBtn.disabled = true;
            refetchBtn.textContent = '取得中...';
            await updateSynopsis(item.id, editedTitle, item.url, editedVolume, true);
            // 再取得したデータでパネル再描画（編集値を引き継ぐ）
            db.transaction(['items'], 'readonly').objectStore('items').get(item.id).onsuccess = (ev) => {
                if (ev.target.result) {
                    showSynopsisPanel(ev.target.result, { title: editedTitle, volume: editedVolume });
                }
            };
        };

        // 巻数入力と再取得ボタンを同じ行に並べる
        const volRow = document.createElement('div');
        volRow.className = 'synopsis-vol-row';
        volRow.appendChild(volLabel);
        volRow.appendChild(volInput);
        volRow.appendChild(refetchBtn);
        formWrap.appendChild(volRow);

        bodyEl.appendChild(formWrap);
    }

    panel.style.display = 'flex';
    // アニメーション再実行のため一度外して付与
    panel.classList.remove('synopsis-panel-open');
    void panel.offsetWidth;
    panel.classList.add('synopsis-panel-open');
};

const hideSynopsisPanel = () => {
    const panel = document.getElementById('synopsisPanel');
    const bodyEl = document.getElementById('synopsisPanelBody');
    const titleEl = document.getElementById('synopsisPanelTitle');
    // 非表示中は再侵入を防ぐためIDをnull化
    synopsisPanelItemId = null;
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
let toastTimer = null;
let toastVisible = false;
const showToast = (msg, opts = {}) => {
    const toast = document.getElementById('synopsisToast');
    toast.textContent = msg;
    toast.classList.toggle('error', !!opts.error);

    if (toastVisible) {
        // 表示中: テキスト更新のみ（アニメーションしない）
        if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
        if (!opts.persistent) {
            toastTimer = setTimeout(() => hideToast(), TIMING.TOAST_DURATION);
        }
        return;
    }

    // 新規表示: 登場アニメーション
    toastVisible = true;
    toast.classList.remove('synopsis-toast-hide');
    toast.style.display = 'block';
    toast.classList.remove('synopsis-toast-show');
    void toast.offsetWidth;
    toast.classList.add('synopsis-toast-show');

    if (!opts.persistent) {
        toastTimer = setTimeout(() => hideToast(), TIMING.TOAST_DURATION);
    }
};

const hideToast = () => {
    const toast = document.getElementById('synopsisToast');
    if (!toastVisible) return;
    toastVisible = false;
    toast.classList.remove('synopsis-toast-show');
    toast.classList.add('synopsis-toast-hide');
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
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
        let items = e.target.result;
        // 表示中のウィンドウ・グループ絞り込みを適用
        if (currentSelectedWindowId !== null) items = items.filter(item => item.windowId === currentSelectedWindowId);
        if (currentSelectedGroupId !== null) items = items.filter(item => item.groupId === currentSelectedGroupId);
        // force=true: Kindleドメイン全件 / force=false: Kindleドメインかつ未取得
        const targets = items.filter(item =>
            isKindleUrl(item.url) && (force || !item.synopsis)
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
        for (const item of targets) {
            showToast(`あらすじ取得中... (${done}/${targets.length}) ${item.title.slice(0, TOAST_TITLE_MAX_LEN)}`, { persistent: true });
            await updateSynopsis(item.id, item.title, item.url);
            done++;
            // レートリミット対策: 1.2秒間隔に間引く（最後は待たない）
            if (done < targets.length) await sleep(TIMING.SYNOPSIS_FETCH_INTERVAL);
        }
        showToast(`あらすじ取得完了 (${done}/${targets.length})`);
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
                imageDataBase64 = resizeToJpeg(img, trimLeft, trimmedW, trimmedH);

                preview.src = imageDataBase64;
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
        const isActive = currentSortKey === opt.key;
        btn.className = `sort-btn ${isActive ? 'active' : ''}`;
        btn.textContent = opt.label;
        if (isActive && opt.key !== 'sortOrder') {
            const arrow = document.createElement('span');
            arrow.className = 'arrow';
            arrow.textContent = sortAsc ? '▲' : '▼';
            btn.appendChild(arrow);
        }
        btn.onclick = () => {
            if (currentSortKey === opt.key && opt.key !== 'sortOrder') {
                sortAsc = !sortAsc;
            } else {
                currentSortKey = opt.key;
                sortAsc = true;
            }
            saveUIState();
            renderSortButtons();
            renderList();
        };
        sortRow.appendChild(btn);
    });
};

// ============================================================
// フィルター描画
// ============================================================

// フィルタ選択切替の共通処理（右ペイン閉じる→保存→再描画）
const applyFilterChange = (windowId, groupId) => {
    currentSelectedWindowId = windowId;
    currentSelectedGroupId = groupId;
    hideSynopsisPanel();
    saveUIState();
    renderFilters();
    renderList();
};

// フィルタ編集/削除アイコンのクリック共通処理
const onFilterIconClick = (e, handler) => {
    e.stopPropagation();
    handler();
};


const renderFilters = () => {
    const myId = ++filterRenderId;
    const winRow = document.getElementById('windowFilterRow');
    const tx = db.transaction(['windows', 'groups'], 'readonly');
    tx.objectStore('windows').getAll().onsuccess = (e) => {
        if (myId !== filterRenderId) return;
        winRow.innerHTML = '';
        const windows = e.target.result;
        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${currentSelectedWindowId === null ? 'active' : ''}`;
        allBtn.textContent = 'すべて';
        allBtn.onclick = () => applyFilterChange(null, null);
        winRow.appendChild(allBtn);

        windows.forEach(w => {
            const btn = document.createElement('button');
            const classes = ['filter-btn'];
            if (currentSelectedWindowId === w.id) classes.push('active');
            if (editMode) classes.push('editable-btn');
            btn.className = classes.join(' ');
            btn.textContent = w.name;
            btn.onclick = () => applyFilterChange(w.id, null);

            if (editMode) {
                const editIcon = document.createElement('span');
                editIcon.className = 'icon edit-icon';
                editIcon.textContent = '✏';
                editIcon.onclick = (e) => onFilterIconClick(e, () => startEditFilter(w.id, 'windows', w.name, btn));
                btn.appendChild(editIcon);

                const delIcon = document.createElement('span');
                delIcon.className = 'icon delete-icon';
                delIcon.textContent = '×';
                delIcon.onclick = (e) => onFilterIconClick(e, () => deleteWindow(w.id, w.name));
                btn.appendChild(delIcon);
            }

            winRow.appendChild(btn);
        });
        renderGroupFilters(tx);
        syncItemSelects();
    };
};

const renderGroupFilters = (tx) => {
    const myId = filterRenderId;
    const groupRow = document.getElementById('groupFilterRow');
    if (currentSelectedWindowId === null) {
        groupRow.innerHTML = '<span style="font-size:11px; color:#555;">ウィンドウを選択してください</span>'; return;
    }
    tx.objectStore('groups').getAll().onsuccess = (e) => {
        if (myId !== filterRenderId) return;
        groupRow.innerHTML = '';
        const groups = e.target.result.filter(g => g.windowId === currentSelectedWindowId);
        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${currentSelectedGroupId === null ? 'active' : ''}`;
        allBtn.textContent = 'すべて';
        allBtn.onclick = () => applyFilterChange(currentSelectedWindowId, null);
        groupRow.appendChild(allBtn);

        groups.forEach(g => {
            const btn = document.createElement('button');
            const classes = ['filter-btn'];
            if (currentSelectedGroupId === g.id) classes.push('active');
            if (editMode) classes.push('editable-btn');
            btn.className = classes.join(' ');
            btn.textContent = g.name;
            btn.onclick = () => applyFilterChange(currentSelectedWindowId, g.id);

            if (editMode) {
                const editIcon = document.createElement('span');
                editIcon.className = 'icon edit-icon';
                editIcon.textContent = '✏';
                editIcon.onclick = (e) => onFilterIconClick(e, () => startEditFilter(g.id, 'groups', g.name, btn));
                btn.appendChild(editIcon);

                const delIcon = document.createElement('span');
                delIcon.className = 'icon delete-icon';
                delIcon.textContent = '×';
                delIcon.onclick = (e) => onFilterIconClick(e, () => deleteGroup(g.id, g.name));
                btn.appendChild(delIcon);
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
                if (data) { data.name = newName; tx.objectStore(storeName).put(data); }
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
        if (e.key === 'Enter') { input.onblur = null; finishEdit(); }
        if (e.key === 'Escape') { finished = true; input.onblur = null; refreshDataView(); }
    };
};

const deleteWindow = (id, name) => {
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
            if (currentSelectedWindowId === id) {
                currentSelectedWindowId = null;
                currentSelectedGroupId = null;
                saveUIState();
            }
            refreshDataView();
            syncItemSelects();
        };
    };
};

const deleteGroup = (id, name) => {
    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = (e) => {
        const count = e.target.result.filter(item => item.groupId === id).length;
        if (count > 0) {
            alert(`このグループには${count}件のアイテムが存在します。\n先にアイテムを削除してください。`);
            return;
        }
        if (!confirm(`グループ「${name}」を削除しますか？`)) return;

        db.transaction(['groups'], 'readwrite').objectStore('groups').delete(id).onsuccess = () => {
            if (currentSelectedGroupId === id) {
                currentSelectedGroupId = null;
                saveUIState();
            }
            refreshDataView();
            syncItemSelects();
        };
    };
};

// ============================================================
// メインカードリスト描画
// ============================================================

const renderList = () => {
    const listSection = document.getElementById('listSection');
    listSection.innerHTML = '';

    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = (e) => {
        let items = e.target.result;

        if (currentSelectedWindowId !== null) items = items.filter(item => item.windowId === currentSelectedWindowId);
        if (currentSelectedGroupId !== null) items = items.filter(item => item.groupId === currentSelectedGroupId);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(item => item.title.toLowerCase().includes(q));
        }

        const isDragEnabled = currentSortKey === 'sortOrder';
        if (currentSortKey === 'sortOrder') {
            items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        } else if (currentSortKey === 'title') {
            items.sort((a, b) => sortAsc ? a.title.localeCompare(b.title, 'ja') : b.title.localeCompare(a.title, 'ja'));
        } else if (currentSortKey === 'createdAt') {
            items.sort((a, b) => sortAsc ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
        }

        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'card';
            if (editingItemId === item.id) card.classList.add('editing-image');
            if (item.synopsis && item.synopsis.length > 0) {
                card.classList.add('has-synopsis');
            } else if (isKindleUrl(item.url)) {
                card.classList.add('no-synopsis');
            }
            card.draggable = isDragEnabled;
            card.dataset.id = item.id;
            card.tabIndex = 0;

            // 長押しであらすじ表示（右ペイン）。短押しでリンクオープン。
            // シングルクリックでリンクオープン、右クリックであらすじ表示（右ペイン）
            card.onclick = (e) => {
                if (e.target.closest('.delete-icon-btn')) return;
                if (editMode) { startItemEdit(item); return; }
                window.open(item.url, '_blank', 'noopener,noreferrer');
            };
            card.oncontextmenu = (e) => {
                if (editMode) return;
                e.preventDefault();
                if (!isKindleUrl(item.url)) {
                    showToast('このカードはあらすじ非対応（Kindleドメインのみ）', { error: true });
                    return;
                }
                showSynopsisPanel(item);
            };

            if (editMode) {
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-icon-btn';
                delBtn.textContent = '×';
                delBtn.onclick = () => {
                    db.transaction(['items'], 'readwrite').objectStore('items').delete(item.id).onsuccess = () => renderList();
                };
                card.appendChild(delBtn);
            }

            const imgBox = document.createElement('div');
            imgBox.className = 'card-img-box';
            if (item.image) {
                const img = document.createElement('img');
                img.className = 'card-img';
                img.src = item.image;
                if (blurEnabled) img.classList.add('blurred');
                imgBox.appendChild(img);
            }
            card.appendChild(imgBox);

            const content = document.createElement('div');
            content.className = 'card-content';
            const title = document.createElement('p');
            title.className = 'card-title';
            title.textContent = item.title;
            card.title = item.title;
            content.appendChild(title);
            card.appendChild(content);

            listSection.appendChild(card);
        });
    };
};

// ============================================================
// ドラッグ＆ドロップ並び替え
// ============================================================

const initDragAndDrop = () => {
    const listSection = document.getElementById('listSection');
    listSection.addEventListener('dragstart', (e) => {
        const targetCard = e.target.closest('.card');
        if (targetCard) { targetCard.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
    });
    listSection.addEventListener('dragend', (e) => {
        const targetCard = e.target.closest('.card');
        if (targetCard) { targetCard.classList.remove('dragging'); saveNewOrder(); }
    });
    listSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingCard = listSection.querySelector('.dragging'); if (!draggingCard) return;
        const afterElement = getDragAfterElement(listSection, e.clientX, e.clientY);
        if (afterElement == null) { listSection.appendChild(draggingCard); } else { listSection.insertBefore(draggingCard, afterElement); }
    });
};

const getDragAfterElement = (container, x, y) => {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offsetX = x - (box.left + box.width / 2);
        const offsetY = y - (box.top + box.height / 2);
        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
            if (distance < closest.distance) return { distance: distance, element: child };
        } else if (closest.element == null && distance < closest.distance) {
            return { distance: distance, element: child };
        }
        return closest;
    }, { distance: Infinity, element: null }).element;
};

const saveNewOrder = () => {
    const cards = [...document.querySelectorAll('#listSection .card')];
    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    cards.forEach((card, index) => {
        const id = parseInt(card.dataset.id);
        store.get(id).onsuccess = (e) => {
            const data = e.target.result;
            if (data) { data.sortOrder = index; store.put(data); }
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
        backupData.items = e.target.result.map(item => {
            const { synopsis, ...rest } = item;
            return rest;
        });
    };
    tx.oncomplete = () => callback(backupData);
};

const handleExport = () => {
    fetchAllData((backupData) => {
        const jsonString = JSON.stringify(backupData);
        const textarea = document.getElementById('ioTextarea');
        textarea.value = jsonString;
        navigator.clipboard.writeText(jsonString).then(() => textarea.select()).catch(err => {
            console.error('クリップボードへのコピーに失敗しました', err);
        });
    });
};

const handleSaveFile = () => {
    fetchAllData(async (backupData) => {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'url-vault-backup.json',
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
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
    if (!parsedData.windows || !parsedData.groups || !parsedData.items) { alert('データ構造が不正です'); return false; }
    if (!confirm('インポートを実行しますか？\n既存のデータはすべて置き換えられます。')) return false;

    const tx = db.transaction(['windows', 'groups', 'items'], 'readwrite');
    tx.objectStore('windows').clear();
    tx.objectStore('groups').clear();
    tx.objectStore('items').clear();

    parsedData.windows.forEach(w => tx.objectStore('windows').put(w));
    parsedData.groups.forEach(g => tx.objectStore('groups').put(g));
    parsedData.items.forEach(i => tx.objectStore('items').put(i));

    tx.oncomplete = () => {
        currentSelectedWindowId = null;
        currentSelectedGroupId = null;
        saveUIState();
        initApp();
    };
    return true;
};

const handleImport = () => {
    const jsonString = document.getElementById('ioTextarea').value.trim();
    if (!jsonString) return;
    let parsedData;
    try { parsedData = JSON.parse(jsonString); } catch (e) { alert('JSONのパースに失敗しました。'); return; }
    importData(parsedData);
};

const handleLoadFile = async () => {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const file = await handle.getFile();
        const jsonString = await file.text();
        let parsedData;
        try { parsedData = JSON.parse(jsonString); } catch (e) { alert('JSONのパースに失敗しました。'); return; }
        importData(parsedData);
    } catch (e) {
        if (e.name !== 'AbortError') console.error('ファイルの読み込みに失敗しました', e);
    }
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
    editMode = !editMode;
    if (!editMode) endItemEdit();
    const btn = document.getElementById('toggleEditModeBtn');
    btn.style.backgroundColor = editMode ? '#6a4c93' : '';
    btn.style.color = editMode ? '#fff' : '';
    renderFilters();
    renderList();
});

// サムネぼかしトグル
let blurEnabled = false;
document.getElementById('toggleBlurBtn').addEventListener('click', () => {
    blurEnabled = !blurEnabled;
    const btn = document.getElementById('toggleBlurBtn');
    btn.style.backgroundColor = blurEnabled ? '#c62828' : '';
    btn.style.color = blurEnabled ? '#fff' : '';
    btn.textContent = blurEnabled ? '🔓 ぼかし解除' : '🔒 ぼかし';
    document.querySelectorAll('.card-img').forEach(img => {
        img.classList.toggle('blurred', blurEnabled);
    });
});

// 検索
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderList();
});

// セレクトボックス
document.getElementById('itemWindowSelect').addEventListener('change', updateGroupSelectBox);

// ウィンドウ追加
document.getElementById('addWindowBtn').addEventListener('click', executeAddWindow);
document.getElementById('newWindowInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); executeAddWindow(); }
});

// グループ追加
document.getElementById('addGroupBtn').addEventListener('click', executeAddGroup);
document.getElementById('newGroupInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); executeAddGroup(); }
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
    if (e.key === 'Enter') { e.preventDefault(); saveItem(); }
});
document.getElementById('url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveItem(); }
});

// 保存
document.getElementById('saveBtn').addEventListener('click', saveItem);

document.getElementById('fetchAllSynopsisBtn').addEventListener('click', () => fetchAllSynopsis(false));
document.getElementById('fetchAllSynopsisForceBtn').addEventListener('click', () => fetchAllSynopsis(true));

// あらすじパネル
document.getElementById('synopsisPanelClose').addEventListener('click', hideSynopsisPanel);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideSynopsisPanel();
});

document.getElementById('toggleAddPositionBtn').addEventListener('click', () => {
    addPositionTop = !addPositionTop;
    updateAddPositionBtn();
    saveUIState();
});

// インポート・エクスポート
document.getElementById('exportBtn').addEventListener('click', handleExport);
document.getElementById('importBtn').addEventListener('click', handleImport);
document.getElementById('exportFileBtn').addEventListener('click', handleSaveFile);
document.getElementById('importFileBtn').addEventListener('click', handleLoadFile);
