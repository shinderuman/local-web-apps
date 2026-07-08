// ============================================================
// 定数
// ============================================================

// ストレージ・セッションキー
const STORAGE_KEY = 'storage_smart_assets';
const FILTER_KEY = 'smart_vault_filter';

// タイムアウト（ミリ秒）
const TIMING = {
    TOAST_DURATION: 2500
};

// デバイスタイプの表示名（キー順 = フィルタ・編集の表示順）
const TYPE_LABELS = {
    'nvme': 'NVMe',
    'sata-ssd': 'SATA SSD',
    'sshd': 'SSHD',
    'hdd-25': 'HDD 2.5"',
    'hdd-35': 'HDD 3.5"',
    'emmc': 'eMMC',
    'unknown': '不明'
};

// 状態レベルの表示名（添字 = レベル）
const LEVEL_LABELS = ['L0 正常', 'L1 注意', 'L2 警告', 'L3 危険'];

// メーカー選択肢（プルダウン）
const CORE_VENDORS = [
    'Apple', 'Samsung', 'Crucial', 'Intel', 'Western Digital', 'Seagate',
    'Toshiba', 'HGST', 'Kioxia', 'SanDisk', 'Kingston', 'Silicon Power'
];

// フィルタ種別（個数カウント対象）= all + 全デバイスタイプ
const FILTER_TYPES = ['all', ...Object.keys(TYPE_LABELS)];

// ソート列とテーブルヘッダ位置の対応
const SORT_INDEX_MAP = {
    'vendor': 0,
    'size_bytes': 1,
    'model': 2,
    'customType': 3,
    'healthLevel': 4,
    'lifePercent': 5,
    'tbw_val': 6,
    'hours_val': 7
};

// データ取得コマンド・バックアップファイル名
const SMART_COMMAND = 'sudo smartctl -a --json /dev/diskX | pbcopy';
const BACKUP_FILENAME = 'smart_storage_backup.json';

// トーストメッセージ
const TOAST = {
    PARSE_OK: 'データを解析して登録・更新しました',
    PARSE_FAIL: 'エラー: パース失敗',
    NO_SERIAL: 'エラー: S/N不検出',
    REBUILT: 'データベースを再構築しました',
    DELETED: '記録を削除しました',
    IMPORTED: 'バックアップからデータを復元しました',
    IMPORT_FAIL: 'エラー: 不正なファイル構造です',
    SAVED: 'ファイルを保存しました',
    SAVE_FAIL: 'エラー: 保存に失敗しました',
    CMD_COPIED: 'コマンドをクリップボードにコピーしました'
};

// ============================================================
// 状態変数（ミュータブル）
// ============================================================

let db = (() => {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return Array.isArray(raw) ? raw : Object.values(raw);
})();

// 表示状態（フィルタ・ソート）
const viewState = {
    filter: sessionStorage.getItem(FILTER_KEY) || 'all',
    sortField: '',
    sortOrder: 'asc'
};

// UI状態
const uiState = {
    toastTimer: null
};

// ============================================================
// モジュール（純粋関数）のインポート
// ============================================================

const { detectVendor } = window.VENDOR_LOGIC;
const {
    pickNum, calcSize, calcTbw, calcLife, calcSectorCounts, detectCustomType
} = window.PARSE_LOGIC;
const { computeHealthLevel } = window.HEALTH_LOGIC;
const {
    formatHours, formatTemp, formatTbw, formatCount
} = window.FORMAT_LOGIC;

// ============================================================
// S.M.A.R.T. パース（モジュールを束ねてレコード生成）
// ============================================================

const parseSmartJson = (rawText, existingRecord = null) => {
    const data = JSON.parse(rawText);
    const serial = data.serial_number || (data.device && data.device.serial_number) || '';
    if (!serial) throw new Error('S/N無し');

    const model = data.model_name || '';
    const protocol = data.device?.protocol || '';
    const deviceType = data.device?.type || '';

    const capacityBytes = Number(data.user_capacity?.bytes || 0);
    const { sizeStr, sizeBytes } = calcSize(model, capacityBytes);

    let health = 'UNKNOWN';
    if (data.smart_status?.passed !== undefined) {
        health = data.smart_status.passed ? 'PASSED' : 'FAILED';
    }

    const hoursVal = pickNum(data, 'power_on_time.hours', 'nvme_smart_health_information_log.power_on_hours', 0);
    const powerCycleCount = pickNum(data, 'power_cycle_count', 'nvme_smart_health_information_log.power_cycles', '不明');
    const tempVal = pickNum(data, 'temperature.current', 'nvme_smart_health_information_log.temperature', 0);

    const tbwVal = calcTbw(data);
    const { lifePercent, lifeOrSector } = calcLife(data);
    const { reallocSectors, pendingSectors, crcErrors } = calcSectorCounts(data);

    const memo = existingRecord ? existingRecord.memo : '';
    const existingType = existingRecord ? existingRecord.customType : '';
    let vendor = existingRecord ? existingRecord.vendor : '';
    const id = existingRecord ? existingRecord.id : Number(Date.now());

    if (!vendor) vendor = detectVendor(data, model);
    const customType = detectCustomType(protocol, model, deviceType, existingType);

    const { level: healthLevel, reasons: healthReasons } = computeHealthLevel(data, {
        customType, health, hours_val: hoursVal, lifePercent, reallocSectors, pendingSectors, crcErrors
    });

    return {
        id,
        serial,
        model,
        vendor,
        protocol,
        deviceType,
        size: sizeStr,
        size_bytes: sizeBytes,
        health,
        powerOnHours: formatHours(hoursVal),
        hours_val: hoursVal,
        powerCycleCount,
        temperature: formatTemp(tempVal),
        temp_val: tempVal,
        tbw: formatTbw(tbwVal),
        tbw_val: tbwVal,
        lifeOrSector,
        lifePercent,
        reallocSectors,
        pendingSectors,
        crcErrors,
        healthLevel,
        healthReasons,
        updatedAt: new Date().toLocaleString(),
        memo,
        customType,
        raw: rawText
    };
};

const saveDb = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

// ペーストされたJSONを新規追加または既存更新
const upsertRecord = (rawText) => {
    const parsedTmp = JSON.parse(rawText);
    const serial = parsedTmp.serial_number || (parsedTmp.device && parsedTmp.device.serial_number) || '';
    if (!serial) {
        showToast(TOAST.NO_SERIAL);
        return;
    }

    const existingIndex = db.findIndex(item => item.serial === serial);
    const existingRecord = existingIndex !== -1 ? db[existingIndex] : null;
    const newRecord = parseSmartJson(rawText, existingRecord);

    if (existingIndex !== -1) {
        db[existingIndex] = newRecord;
    } else {
        db.push(newRecord);
    }

    saveDb();
    renderTable();
    showToast(TOAST.PARSE_OK);
};

const rebuildDatabaseFromRaw = () => {
    if (db.length === 0) return;
    const ok = confirm('蓄積された生JSONデータから台帳を再構築します。\n手動入力した項目（分類・メーカー・メモ）はそのまま維持されます。実行しますか？');
    if (!ok) return;

    db = db.map(oldRecord => {
        if (!oldRecord.raw) return oldRecord;
        try {
            return parseSmartJson(oldRecord.raw, oldRecord);
        } catch (e) {
            return oldRecord;
        }
    });

    saveDb();
    renderTable();
    showToast(TOAST.REBUILT);
};

const deleteItem = (serial) => {
    const ok = confirm('このストレージの記録を完全に削除しますか？');
    if (!ok) return;
    db = db.filter(item => item.serial !== serial);
    saveDb();
    renderTable();
    showToast(TOAST.DELETED);
};

const importBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            const importedArr = Array.isArray(importedData) ? importedData : Object.values(importedData);
            importedArr.forEach(newRec => {
                const idx = db.findIndex(item => item.serial === newRec.serial);
                if (idx !== -1) db[idx] = newRec;
                else db.push(newRec);
            });
            saveDb();
            renderTable();
            showToast(TOAST.IMPORTED);
        } catch (err) {
            showToast(TOAST.IMPORT_FAIL);
        }
        document.getElementById('fileInput').value = '';
    };
    reader.readAsText(file);
};

const exportBackup = async () => {
    if (db.length === 0) return;
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: BACKUP_FILENAME,
            types: [{
                description: 'JSON File',
                accept: { 'application/json': ['.json'] }
            }]
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(db, null, 2));
        await writable.close();
        showToast(TOAST.SAVED);
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('ファイルの保存に失敗しました', e);
            showToast(TOAST.SAVE_FAIL);
        }
    }
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

const updateCounters = () => {
    const counts = {};
    FILTER_TYPES.forEach(t => { counts[t] = 0; });
    db.forEach(item => {
        counts['all']++;
        const type = item.customType || 'unknown';
        if (counts[type] !== undefined) counts[type]++;
    });
    FILTER_TYPES.forEach(key => {
        const el = document.getElementById(`count-${key}`);
        if (el) el.innerText = counts[key];
    });
};

const applyFilter = (type, btn) => {
    viewState.filter = type;
    sessionStorage.setItem(FILTER_KEY, type);
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTable();
};

const sortTable = (field) => {
    if (viewState.sortField === field) {
        // 昇順 → 降順 → 解除（手動順）の3状態トグル
        if (viewState.sortOrder === 'asc') {
            viewState.sortOrder = 'desc';
        } else {
            viewState.sortField = '';
            viewState.sortOrder = 'asc';
        }
    } else {
        viewState.sortField = field;
        viewState.sortOrder = 'asc';
    }
    renderTable();
};

const toggleDetails = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
};

const toggleAccordion = () => {
    const el = document.getElementById('cmdAccordion');
    const icon = document.getElementById('accordionIcon');
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        icon.innerText = '▲';
    } else {
        el.classList.add('hidden');
        icon.innerText = '▼';
    }
};

const copyCommandText = () => {
    navigator.clipboard.writeText(SMART_COMMAND).then(() => {
        showToast(TOAST.CMD_COPIED);
    });
};

// ============================================================
// インライン編集
// ============================================================

const enableVendorEdit = (serial, container) => {
    const idx = db.findIndex(item => item.serial === serial);
    if (idx === -1) return;

    const currentVendor = db[idx].vendor || '不明';
    const isCustom = !CORE_VENDORS.includes(currentVendor) && currentVendor !== '不明';

    const select = document.createElement('select');
    select.className = 'select-inline-input';
    select.add(new Option('不明', '不明', false, currentVendor === '不明'));
    CORE_VENDORS.forEach(v => {
        select.add(new Option(v, v, false, currentVendor === v));
    });
    if (isCustom) {
        select.add(new Option(currentVendor, currentVendor, true, true));
    }
    select.add(new Option('+ 新規直接自由入力...', 'custom_input'));

    container.innerHTML = '';
    container.appendChild(select);
    select.focus();

    let committed = false;
    const commit = (val) => {
        if (committed) return;
        committed = true;
        let next = val;
        if (val === 'custom_input') {
            const userInput = prompt('メーカー名を手動自由入力してください:', isCustom ? currentVendor : '');
            next = (userInput && userInput.trim()) ? userInput.trim() : currentVendor;
        }
        db[idx].vendor = next;
        saveDb();
        renderTable();
    };

    select.addEventListener('change', () => commit(select.value));
    select.addEventListener('blur', () => commit(select.value));
};

const enableTypeEdit = (serial, container) => {
    const idx = db.findIndex(item => item.serial === serial);
    if (idx === -1) return;

    const currentType = db[idx].customType || 'unknown';

    const select = document.createElement('select');
    select.className = 'select-inline-input';
    Object.keys(TYPE_LABELS).forEach(key => {
        select.add(new Option(TYPE_LABELS[key], key, false, currentType === key));
    });

    container.innerHTML = '';
    container.appendChild(select);
    select.focus();

    let committed = false;
    const commit = (val) => {
        if (committed) return;
        committed = true;
        db[idx].customType = val;
        saveDb();
        renderTable();
    };

    select.addEventListener('change', () => commit(select.value));
    select.addEventListener('blur', () => commit(select.value));
};

const enableMemoEdit = (serial, container) => {
    const idx = db.findIndex(item => item.serial === serial);
    if (idx === -1) return;

    const currentText = db[idx].memo || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'memo-edit-input select-inline-input';
    input.value = currentText;

    container.innerHTML = '';
    container.appendChild(input);
    input.focus();

    const commit = () => {
        const newText = input.value.trim();
        db[idx].memo = newText;
        saveDb();
        renderTable();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
    });
};

// ============================================================
// レンダリング
// ============================================================

// ソート済み表示対象配列を返す
const getDisplayItems = () => {
    const items = [...db];
    if (!viewState.sortField) return items;

    items.sort((a, b) => {
        const vA = a[viewState.sortField];
        const vB = b[viewState.sortField];
        if (typeof vA === 'number' && typeof vB === 'number') {
            return viewState.sortOrder === 'asc' ? vA - vB : vB - vA;
        }
        const strA = String(vA || '');
        const strB = String(vB || '');
        return viewState.sortOrder === 'asc' ? strA.localeCompare(strB, 'ja') : strB.localeCompare(strA, 'ja');
    });
    return items;
};

const updateSortIndicators = () => {
    const ths = document.querySelectorAll('th');
    ths.forEach(th => th.className = '');
    if (!viewState.sortField) return;
    const thIdx = SORT_INDEX_MAP[viewState.sortField];
    if (thIdx === undefined) return;
    ths[thIdx].className = viewState.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc';
};

// テキストtdを生成してtrに追加
const appendTextTd = (tr, text, className) => {
    const td = document.createElement('td');
    if (className) td.className = className;
    if (text !== undefined) td.innerText = text;
    tr.appendChild(td);
    return td;
};

// 編集可能セル（clickable-cell）を生成
const createEditableCell = (text, onEdit) => {
    const cell = document.createElement('div');
    cell.className = 'clickable-cell';
    cell.innerText = text;
    cell.addEventListener('click', onEdit);
    return cell;
};

// 状態レベルバッジを生成
const createLevelBadge = (item) => {
    const hl = item.healthLevel ?? 0;
    const badge = document.createElement('span');
    badge.className = `level-badge level-${hl}`;
    badge.title = item.healthReasons.join('\n');
    badge.innerText = LEVEL_LABELS[hl];
    return badge;
};

// メモ+消去セルを生成
const createMemoCell = (item) => {
    const td = document.createElement('td');
    td.className = 'memo-cell';
    const memoCell = document.createElement('div');
    memoCell.className = 'clickable-cell';
    if (item.memo) {
        memoCell.innerText = item.memo;
    } else {
        const ph = document.createElement('span');
        ph.className = 'memo-placeholder';
        ph.innerText = 'クリックして入力';
        memoCell.appendChild(ph);
    }
    memoCell.addEventListener('click', () => enableMemoEdit(item.serial, memoCell));
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger btn-mini';
    delBtn.innerText = '消去';
    delBtn.addEventListener('click', () => deleteItem(item.serial));
    td.appendChild(memoCell);
    td.appendChild(delBtn);
    return td;
};

const createRow = (item, index) => {
    const currentType = item.customType || 'unknown';
    const isUnknown = currentType === 'unknown';

    const tr = document.createElement('tr');
    tr.className = isUnknown ? 'item-row unknown-type-row' : 'item-row';
    tr.setAttribute('draggable', 'true');
    tr.setAttribute('data-serial', item.serial);

    // メーカー（編集可能）
    const tdVendor = document.createElement('td');
    tdVendor.appendChild(createEditableCell(
        item.vendor || '不明',
        (e) => enableVendorEdit(item.serial, e.currentTarget)
    ));
    tr.appendChild(tdVendor);

    appendTextTd(tr, item.size, 'size-cell');
    appendTextTd(tr, item.model, 'model-cell');

    // 分類（編集可能）
    const tdType = document.createElement('td');
    tdType.appendChild(createEditableCell(
        TYPE_LABELS[currentType] || '不明',
        (e) => enableTypeEdit(item.serial, e.currentTarget)
    ));
    tr.appendChild(tdType);

    // 状態レベル
    const tdLevel = document.createElement('td');
    tdLevel.appendChild(createLevelBadge(item));
    tr.appendChild(tdLevel);

    // 残り寿命
    appendTextTd(tr, item.lifePercent >= 0 ? item.lifePercent + '%' : item.lifeOrSector);
    // 総書込量
    appendTextTd(tr, item.tbw);
    // 通電時間 / 電源回数
    appendTextTd(tr, `${item.powerOnHours} / ${item.powerCycleCount}回`);

    // メモ + 消去
    tr.appendChild(createMemoCell(item));

    // 行クリックで詳細トグル（編集可能セル・ボタンは除外）
    const detailsId = `details-${index}`;
    tr.addEventListener('click', (e) => {
        if (e.target.closest('.clickable-cell, button')) return;
        toggleDetails(detailsId);
    });

    return tr;
};

// 詳細グリッドに「ラベル: 値」のフィールドを追加
const appendDetailField = (grid, label, value) => {
    const div = document.createElement('div');
    const strong = document.createElement('strong');
    strong.innerText = label + ': ';
    div.appendChild(strong);
    div.append(value);
    grid.appendChild(div);
};

// 詳細グリッドに判定理由ブロックを追加
const appendReasonsBlock = (grid, reasons) => {
    const div = document.createElement('div');
    div.className = 'reason-block';
    const strong = document.createElement('strong');
    strong.innerText = '判定理由:';
    div.appendChild(strong);
    div.appendChild(document.createElement('br'));
    const body = document.createElement('span');
    body.innerText = reasons.map(r => '・' + r).join('\n');
    div.appendChild(body);
    grid.appendChild(div);
};

const createDetailsRow = (item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'details-row hidden';
    tr.id = `details-${index}`;

    const td = document.createElement('td');
    td.colSpan = 9;

    const container = document.createElement('div');
    container.className = 'details-container';

    const grid = document.createElement('div');
    grid.className = 'details-grid';
    const fields = [
        ['モデル名', item.model],
        ['シリアルナンバー (S/N)', item.serial],
        ['残り寿命', item.lifeOrSector],
        ['代替処理', formatCount(item.reallocSectors)],
        ['保留中', formatCount(item.pendingSectors)],
        ['CRC', formatCount(item.crcErrors)],
        ['温度', item.temperature],
        ['最終更新日', item.updatedAt],
        ['プロトコル', item.protocol || '不明'],
        ['デバイスタイプ', item.deviceType || '不明']
    ];
    fields.forEach(([label, value]) => appendDetailField(grid, label, value));
    appendReasonsBlock(grid, item.healthReasons);
    container.appendChild(grid);

    const raw = document.createElement('div');
    raw.className = 'raw-json';
    raw.innerText = item.raw;
    container.appendChild(raw);

    td.appendChild(container);
    tr.appendChild(td);
    return tr;
};

const renderTable = () => {
    const tbody = document.getElementById('storageTbody');
    tbody.innerHTML = '';
    updateCounters();
    updateSortIndicators();

    let visibleCount = 0;
    getDisplayItems().forEach((item, index) => {
        const currentType = item.customType || 'unknown';
        if (viewState.filter !== 'all' && viewState.filter !== currentType) return;
        visibleCount++;
        tbody.appendChild(createRow(item, index));
        tbody.appendChild(createDetailsRow(item, index));
    });

    if (visibleCount === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 9;
        td.style.cssText = 'text-align:center; color:#a0aec0; padding:30px;';
        td.innerText = '該当するディスクがありません。';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        setupDragAndDrop();
    }
};

const setupDragAndDrop = () => {
    const tbody = document.getElementById('storageTbody');
    let dragSrcEl = null;

    tbody.querySelectorAll('.item-row').forEach(row => {
        row.addEventListener('dragstart', (e) => {
            dragSrcEl = e.currentTarget;
            e.currentTarget.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        row.addEventListener('dragenter', (e) => {
            if (e.currentTarget !== dragSrcEl) {
                e.currentTarget.style.borderTop = '2px solid #3182ce';
            }
        });

        row.addEventListener('dragleave', (e) => {
            e.currentTarget.style.borderTop = '';
        });

        row.addEventListener('drop', (e) => {
            e.stopPropagation();
            e.currentTarget.style.borderTop = '';

            if (dragSrcEl === e.currentTarget) return;
            const srcSerial = dragSrcEl.getAttribute('data-serial');
            const targetSerial = e.currentTarget.getAttribute('data-serial');
            const srcIdx = db.findIndex(item => item.serial === srcSerial);
            const targetIdx = db.findIndex(item => item.serial === targetSerial);
            if (srcIdx === -1 || targetIdx === -1) return;

            const [removed] = db.splice(srcIdx, 1);
            db.splice(targetIdx, 0, removed);
            saveDb();
            viewState.sortField = '';
            renderTable();
        });

        row.addEventListener('dragend', (e) => {
            e.currentTarget.classList.remove('dragging');
            tbody.querySelectorAll('.item-row').forEach(r => r.style.borderTop = '');
        });
    });
};

// ============================================================
// 初期化・イベントバインド
// ============================================================

const bindStaticEvents = () => {
    // ペーストエリア
    const pasteZone = document.getElementById('pasteZone');
    pasteZone.addEventListener('click', () => pasteZone.focus());
    pasteZone.addEventListener('paste', (e) => {
        e.preventDefault();
        const rawText = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (!rawText) return;
        try {
            upsertRecord(rawText);
        } catch (err) {
            showToast(TOAST.PARSE_FAIL);
        }
    });

    // 操作ボタン
    document.getElementById('rebuildBtn').addEventListener('click', rebuildDatabaseFromRaw);
    document.getElementById('exportBtn').addEventListener('click', exportBackup);
    document.getElementById('fileInput').addEventListener('change', importBackup);

    // アコーディオン・コマンドコピー
    document.getElementById('accordionToggle').addEventListener('click', toggleAccordion);
    document.getElementById('commandCode').addEventListener('click', copyCommandText);

    // フィルタボタン
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => applyFilter(btn.dataset.filter, btn));
    });

    // ソートヘッダ
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => sortTable(th.dataset.sort));
    });
};

const restoreFilterButton = () => {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.filter-btn[data-filter="${viewState.filter}"]`);
    if (activeBtn) activeBtn.classList.add('active');
};

const init = () => {
    bindStaticEvents();
    restoreFilterButton();
    renderTable();
};

init();
