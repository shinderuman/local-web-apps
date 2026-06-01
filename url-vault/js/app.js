const DB_NAME = 'HighDensityTabManagerDB_v2';
const DB_VERSION = 1;
let db = null;

let currentSelectedWindowId = null;
let currentSelectedGroupId = null;
let imageDataBase64 = '';
let currentSortKey = 'sortOrder';
let sortAsc = true;

// IndexedDB初期化
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

function initApp() {
    loadToggleStates();
    updateSelectBoxes();
    renderSortButtons();
    renderFilters();
    renderList();
    initDragAndDrop();
}

// 後からデータを追加した際、画面構成を崩さずにセレクトボックスとフィルター、リストだけを部分更新する関数
function refreshDataView() {
    updateSelectBoxes();
    renderFilters();
    renderList();
}

// --- トグル状態の保存と復元 ---
function loadToggleStates() {
    const leftPanel = document.getElementById('leftPanel');
    const navContainer = document.getElementById('navContainer');
    if (localStorage.getItem('leftPanelHidden') === 'true') leftPanel.classList.add('hidden');
    if (localStorage.getItem('navContainerHidden') === 'true') navContainer.classList.add('hidden');
}

document.getElementById('toggleLeftBtn').addEventListener('click', () => {
    const leftPanel = document.getElementById('leftPanel');
    leftPanel.classList.toggle('hidden');
    localStorage.setItem('leftPanelHidden', leftPanel.classList.contains('hidden'));
});

document.getElementById('toggleNavBtn').addEventListener('click', () => {
    const navContainer = document.getElementById('navContainer');
    navContainer.classList.toggle('hidden');
    localStorage.setItem('navContainerHidden', navContainer.classList.contains('hidden'));
});

// --- セレクトボックスの同期 ---
function updateSelectBoxes() {
    const tx = db.transaction(['windows', 'groups'], 'readonly');
    tx.objectStore('windows').getAll().onsuccess = (e) => {
        const windows = e.target.result;
        const targetWin = document.getElementById('targetWindowSelect');
        const itemWin = document.getElementById('itemWindowSelect');

        // 現在の選択値を退避
        const prevTargetVal = targetWin.value;
        const prevItemVal = itemWin.value;

        targetWin.innerHTML = ''; itemWin.innerHTML = '';
        windows.forEach(w => {
            targetWin.add(new Option(w.name, w.id));
            itemWin.add(new Option(w.name, w.id));
        });

        // 選択値を復元（存在すれば）
        if (prevTargetVal) targetWin.value = prevTargetVal;
        if (prevItemVal) itemWin.value = prevItemVal;

        updateGroupSelectBox();
    };
}

document.getElementById('itemWindowSelect').addEventListener('change', updateGroupSelectBox);

function updateGroupSelectBox() {
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
}

// ① ウィンドウ枠のデータ追加
function executeAddWindow() {
    const input = document.getElementById('newWindowInput');
    const value = input.value.trim();
    if (!value) return;

    db.transaction(['windows'], 'readwrite').objectStore('windows').add({ name: value }).onsuccess = () => {
        input.value = '';
        refreshDataView();
    };
}
document.getElementById('addWindowBtn').addEventListener('click', executeAddWindow);
document.getElementById('newWindowInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); executeAddWindow(); }
});

// ② グループ枠のデータ追加
function executeAddGroup() {
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
}
document.getElementById('addGroupBtn').addEventListener('click', executeAddGroup);
document.getElementById('newGroupInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); executeAddGroup(); }
});

// 2行テキストのパース
document.getElementById('title').addEventListener('paste', (e) => {
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const lines = pastedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length >= 2 && lines[1].startsWith('http')) {
        e.preventDefault();
        document.getElementById('title').value = lines[0];
        document.getElementById('url').value = lines[1];
    }
});

// サムネ画像貼り付け（Canvas リサイズ付き）
const pasteArea = document.getElementById('pasteArea');
const preview = document.getElementById('preview');
pasteArea.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            const img = new Image();
            img.onload = () => {
                const MAX_W = 220;
                const MAX_H = 310;
                let w = img.width;
                let h = img.height;

                if (w > MAX_W || h > MAX_H) {
                    const ratio = Math.min(MAX_W / w, MAX_H / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                imageDataBase64 = canvas.toDataURL('image/jpeg', 0.7);
                preview.src = imageDataBase64;
                preview.style.display = 'inline-block';
                pasteArea.classList.add('has-image');
                URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(blob);
            break;
        }
    }
});

// アイテムの新規保存処理
document.getElementById('saveBtn').addEventListener('click', () => {
    const winSelect = document.getElementById('itemWindowSelect'); const groupSelect = document.getElementById('itemGroupSelect');
    const titleInput = document.getElementById('title'); const urlInput = document.getElementById('url');
    if (!winSelect.value || !groupSelect.value || !titleInput.value || !urlInput.value) return;

    const tx = db.transaction(['items'], 'readwrite');
    const store = tx.objectStore('items');
    store.getAll().onsuccess = (e) => {
        const currentGroupItems = e.target.result.filter(item => item.groupId === parseInt(groupSelect.value));
        const maxOrder = currentGroupItems.reduce((max, item) => (item.sortOrder > max ? item.sortOrder : max), 0);

        const data = {
            windowId: parseInt(winSelect.value),
            groupId: parseInt(groupSelect.value),
            title: titleInput.value,
            url: urlInput.value,
            image: imageDataBase64,
            sortOrder: maxOrder + 1,
            createdAt: new Date().getTime()
        };

        store.add(data).onsuccess = () => {
            titleInput.value = ''; urlInput.value = ''; imageDataBase64 = ''; preview.style.display = 'none'; pasteArea.classList.remove('has-image');
            renderList();
        };
    };
});

// --- ソートボタン ---
const SORT_OPTIONS = [
    { key: 'sortOrder', label: '手動順' },
    { key: 'title', label: 'タイトル順' },
    { key: 'createdAt', label: '登録順' },
];

function renderSortButtons() {
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
            renderSortButtons();
            renderList();
        };
        sortRow.appendChild(btn);
    });
}

// フィルター周りの描画
function renderFilters() {
    const winRow = document.getElementById('windowFilterRow'); winRow.innerHTML = '';
    const tx = db.transaction(['windows', 'groups'], 'readonly');
    tx.objectStore('windows').getAll().onsuccess = (e) => {
        const windows = e.target.result;
        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${currentSelectedWindowId === null ? 'active' : ''}`; allBtn.textContent = 'すべて';
        allBtn.onclick = () => { currentSelectedWindowId = null; currentSelectedGroupId = null; renderFilters(); renderList(); };
        winRow.appendChild(allBtn);

        windows.forEach(w => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${currentSelectedWindowId === w.id ? 'active' : ''}`; btn.textContent = w.name;
            btn.onclick = () => { currentSelectedWindowId = w.id; currentSelectedGroupId = null; renderFilters(); renderList(); };
            winRow.appendChild(btn);
        });
        renderGroupFilters(tx);
    };
}

function renderGroupFilters(tx) {
    const groupRow = document.getElementById('groupFilterRow'); groupRow.innerHTML = '';
    if (currentSelectedWindowId === null) {
        groupRow.innerHTML = '<span style="font-size:11px; color:#555;">ウィンドウを選択してください</span>'; return;
    }
    tx.objectStore('groups').getAll().onsuccess = (e) => {
        const groups = e.target.result.filter(g => g.windowId === currentSelectedWindowId);
        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${currentSelectedGroupId === null ? 'active' : ''}`; allBtn.textContent = 'すべて';
        allBtn.onclick = () => { currentSelectedGroupId = null; renderFilters(); renderList(); };
        groupRow.appendChild(allBtn);

        groups.forEach(g => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${currentSelectedGroupId === g.id ? 'active' : ''}`; btn.textContent = g.name;
            btn.onclick = () => { currentSelectedGroupId = g.id; renderFilters(); renderList(); };
            groupRow.appendChild(btn);
        });
    };
}

// メインカードリストの描画
function renderList() {
    const listSection = document.getElementById('listSection');
    listSection.innerHTML = '';

    const tx = db.transaction(['items'], 'readonly');
    tx.objectStore('items').getAll().onsuccess = (e) => {
        let items = e.target.result;

        if (currentSelectedWindowId !== null) items = items.filter(item => item.windowId === currentSelectedWindowId);
        if (currentSelectedGroupId !== null) items = items.filter(item => item.groupId === currentSelectedGroupId);

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
            card.draggable = isDragEnabled;
            card.dataset.id = item.id;

            card.onclick = (e) => {
                if (e.target.closest('.delete-icon-btn')) return;
                window.open(item.url, '_blank', 'noopener,noreferrer');
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-icon-btn';
            delBtn.textContent = '×';
            delBtn.onclick = () => {
                db.transaction(['items'], 'readwrite').objectStore('items').delete(item.id).onsuccess = () => renderList();
            };
            card.appendChild(delBtn);

            const imgBox = document.createElement('div');
            imgBox.className = 'card-img-box';
            if (item.image) {
                const img = document.createElement('img');
                img.className = 'card-img'; img.src = item.image;
                imgBox.appendChild(img);
            }
            card.appendChild(imgBox);

            const content = document.createElement('div');
            content.className = 'card-content';
            const title = document.createElement('p');
            title.className = 'card-title'; title.textContent = item.title;
            content.appendChild(title);
            card.appendChild(content);

            listSection.appendChild(card);
        });
    };
}

// --- ドラッグ＆ドロップ並び替えの処理 ---
function initDragAndDrop() {
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
}

function getDragAfterElement(container, x, y) {
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
}

function saveNewOrder() {
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
}

// --- インポート・エクスポートロジック ---
document.getElementById('exportBtn').addEventListener('click', () => {
    const backupData = { windows: [], groups: [], items: [] };
    const tx = db.transaction(['windows', 'groups', 'items'], 'readonly');

    tx.objectStore('windows').getAll().onsuccess = (e) => backupData.windows = e.target.result;
    tx.objectStore('groups').getAll().onsuccess = (e) => backupData.groups = e.target.result;
    tx.objectStore('items').getAll().onsuccess = (e) => backupData.items = e.target.result;

    tx.oncomplete = () => {
        const jsonString = JSON.stringify(backupData);
        const textarea = document.getElementById('ioTextarea');
        textarea.value = jsonString;

        navigator.clipboard.writeText(jsonString).then(() => {
            textarea.select();
        }).catch(err => {
            console.error('クリップボードへのコピーに失敗しました', err);
        });
    };
});

document.getElementById('importBtn').addEventListener('click', () => {
    const jsonString = document.getElementById('ioTextarea').value.trim();
    if (!jsonString) return;

    let parsedData;
    try { parsedData = JSON.parse(jsonString); } catch (e) { alert('JSONのパースに失敗しました。'); return; }

    if (!parsedData.windows || !parsedData.groups || !parsedData.items) { alert('データ構造が不正です'); return; }

    const tx = db.transaction(['windows', 'groups', 'items'], 'readwrite');
    tx.objectStore('windows').clear();
    tx.objectStore('groups').clear();
    tx.objectStore('items').clear();

    parsedData.windows.forEach(w => tx.objectStore('windows').put(w));
    parsedData.groups.forEach(g => tx.objectStore('groups').put(g));
    parsedData.items.forEach(i => tx.objectStore('items').put(i));

    tx.oncomplete = () => {
        document.getElementById('ioTextarea').value = '';
        currentSelectedWindowId = null;
        currentSelectedGroupId = null;
        initApp();
    };
});
