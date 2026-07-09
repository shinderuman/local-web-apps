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

// 状態レベルの表示名（添字 = レベル、末尾 = 手動登録）
const LEVEL_LABELS = ['L0 正常', 'L1 注意', 'L2 警告', 'L3 危険', '手動'];

// メーカー選択肢（プルダウン）
const CORE_VENDORS = [
    'ADATA', 'Apple', 'Crucial', 'HGST', 'HITACHI', 'Intel', 'Kingston',
    'Kioxia', 'LEVEN', 'Samsung', 'SanDisk', 'Seagate', 'Silicon Power',
    'Toshiba', 'Western Digital'
];

// フィルタ種別（個数カウント対象）= all + 全デバイスタイプ
const FILTER_TYPES = ['all', ...Object.keys(TYPE_LABELS)];

// メーカー・分類の編集プルダウン選択肢（CORE_VENDORS / TYPE_LABELS から派生）
const VENDOR_OPTIONS = [
    { label: '不明', value: '不明' },
    ...CORE_VENDORS.map(v => ({ label: v, value: v }))
];
const TYPE_OPTIONS = Object.keys(TYPE_LABELS).map(key => ({ label: TYPE_LABELS[key], value: key }));

// ソート列とテーブルヘッダ位置の対応（メモ列はソート不可）
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
const BACKUP_FILENAME = 'smart-storage.json';

// 判定理由キーワードの平易な解説（初心者向け）。理由文字列中のキーが出現したらツールチップ化
const REASON_GLOSSARY = [
    {
        key: '保留中セクタ(197)',
        desc: '読み書きに失敗して代替処理待ちの不良セクタ。数が増えるとデータ消失の危険がある。'
    },
    {
        key: '代替処理済セクタ(5)',
        desc: 'すでに予備領域へ交換済みのセクタ。多いほど経年劣化が進んでいる。'
    },
    {
        key: '回復不能セクタ(198)',
        desc: '読み書きできず回復も不能な不良セクタ。データ消失の原因になる。'
    },
    {
        key: '予備ブロック',
        desc: '不良セクタと交換するために確保された予備領域。しきい値を下回ると寿命が近い。'
    },
    {
        key: 'UDMA_CRC(199)',
        desc: 'SATAケーブル・接続の通信エラーの累積。値が大きいと接触不良やケーブル不良の兆候で、ドライブ自体の故障とは限らない。'
    },
    {
        key: 'Command_Timeout(188)',
        desc: 'コマンドがタイムアウトして中断された回数。接触不良やドライブの応答遅延が主な原因で、必ずしも故障ではない。'
    },
    {
        key: 'UNC',
        desc: '読み出せなかった読み取り不能エラー。放置するとデータ破損に繋がる。'
    },
    {
        key: 'IDNF',
        desc: '存在しないアドレスへのアクセス要求。論理的な故障の兆候。'
    },
    {
        key: 'ICRC/ABRT',
        desc: 'ケーブル・接続不良による通信エラーで処理が中断した状態。ドライブ自体の故障とは限らない。'
    },
    {
        key: 'ICRC',
        desc: 'インタフェースの通信エラー。主にケーブル・接続不良が原因。'
    },
    {
        key: 'critical_warning',
        desc: 'NVMeドライブの重大警告フラグ。メディアエラーや寿命切れなどを示す。'
    },
    {
        key: 'percentage_used',
        desc: 'NVMeドライブの書き換え消費量（%）。高いほど寿命に近い。'
    },
    {
        key: 'available_spare',
        desc: 'NVMeドライブの予備領域の残り（%）。低いほど寿命が近い。'
    },
    {
        key: 'media_errors',
        desc: 'NVMeドライブで発生したメディア（記憶素子）エラーの件数。データ信頼性への影響がある。'
    },
    {
        key: '残り寿命',
        desc: 'SSDの書き換え可能量の残り（%）。低いほど寿命に近い。'
    },
    {
        key: '通電時間',
        desc: 'ドライブの累計稼働時間。長いほど経年劣化が進む。'
    },
    {
        key: 'S.M.A.R.T. 総合判定 = FAILED',
        desc: 'ドライブ自身が故障と判定している状態。速やかな交換を推奨。'
    }
];

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
    pickNum, calcSize, parseSizeToBytes, calcTbw, calcLife, calcSectorCounts, detectCustomType
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

// S.M.A.R.T.未取得の手動登録レコードを生成（customType は選択中フィルタから決定）
const createManualRecord = (customType = 'unknown') => ({
    id: Number(Date.now()),
    serial: '',
    isManual: true,
    model: '',
    vendor: '',
    protocol: '',
    deviceType: '',
    size: '',
    size_bytes: 0,
    manualSize: '',
    health: '',
    powerOnHours: '',
    hours_val: 0,
    powerCycleCount: '不明',
    temperature: '',
    temp_val: 0,
    tbw: '',
    tbw_val: 0,
    lifeOrSector: '不明',
    lifePercent: -1,
    reallocSectors: 0,
    pendingSectors: 0,
    crcErrors: 0,
    healthLevel: LEVEL_LABELS.length - 1,
    healthReasons: [],
    updatedAt: new Date().toLocaleString(),
    memo: '',
    customType,
    raw: ''
});

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

// 選択中フィルタから手動レコードの分類を決定（「すべて」なら不明）
const manualTypeFromFilter = () => {
    const f = viewState.filter;
    return (f && f !== 'all') ? f : 'unknown';
};

// 指定IDの直後に手動レコードを挿入（分類は選択中フィルタから決定）
const addManualRecordAfter = (id) => {
    const idx = db.findIndex(item => item.id === id);
    const newRecord = createManualRecord(manualTypeFromFilter());
    if (idx === -1) {
        db.push(newRecord);
    } else {
        db.splice(idx + 1, 0, newRecord);
    }
    saveDb();
    renderTable();
    focusSizeCell(newRecord.id);
};

// 一覧末尾に手動レコードを追加（0件時の「新規追加」ボタン用、分類は選択中フィルタから決定）
const addManualRecordToEnd = () => {
    const newRecord = createManualRecord(manualTypeFromFilter());
    db.push(newRecord);
    saveDb();
    renderTable();
    focusSizeCell(newRecord.id);
};

const rebuildDatabaseFromRaw = () => {
    if (db.length === 0) return;
    const ok = confirm('蓄積された生JSONデータから台帳を再構築します。\nSMARTレコードは分類・メーカー・メモのみ維持し、それ以外（容量・モデル名・寿命・TBW・通電時間等の手動編集を含む）は生JSONで上書きされます。\n手動登録レコードはそのまま維持されます。実行しますか？');
    if (!ok) return;

    db = db.map(oldRecord => {
        // 手動レコード・raw未保持レコードは再構築対象外（そのまま維持）
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

const deleteItem = (id) => {
    const ok = confirm('このストレージの記録を完全に削除しますか？');
    if (!ok) return;
    db = db.filter(item => item.id !== id);
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
        await writable.write(JSON.stringify(db));
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
// インライン編集（共通ヘルパ）
// ============================================================

// レコードを検索（存在しなければnull）
const findRecord = (id) => {
    const idx = db.findIndex(item => item.id === id);
    return idx === -1 ? null : { idx, record: db[idx] };
};

// 編集確定の共通処理: 検証→保存→再描画
const commitEdit = (idx, patch) => {
    Object.assign(db[idx], patch);
    saveDb();
    renderTable();
};

// プルダウン編集（field に選択値を保存）。allowFreeInput で自由入力プロンプトを許可
const enableSelectEdit = (id, container, field, options, allowFreeInput = false) => {
    const found = findRecord(id);
    if (!found || container.querySelector('select')) return;
    const { idx, record } = found;
    const current = record[field] || options[0].value;

    const select = document.createElement('select');
    select.className = 'select-inline-input';
    options.forEach(opt => {
        select.add(new Option(opt.label, opt.value, false, opt.value === current));
    });
    const isCustom = allowFreeInput && !options.some(o => o.value === current) && current;
    if (isCustom) select.add(new Option(current, current, true, true));
    if (allowFreeInput) select.add(new Option('+ 新規直接自由入力...', '__free_input__'));

    container.innerHTML = '';
    container.appendChild(select);
    select.focus();

    let committed = false;
    const commit = (val) => {
        if (committed) return;
        committed = true;
        let next = val;
        if (val === '__free_input__') {
            const userInput = prompt('手動自由入力してください:', isCustom ? current : '');
            next = (userInput && userInput.trim()) ? userInput.trim() : current;
        }
        commitEdit(idx, { [field]: next });
    };

    select.addEventListener('change', () => commit(select.value));
    select.addEventListener('blur', () => commit(select.value));
};

// テキスト編集（field に文字列を保存）。onCommit で追加の派生更新を行える
const enableTextEdit = (id, container, field, placeholder = '', onCommit = null, fallback = '') => {
    const found = findRecord(id);
    if (!found || container.querySelector('input')) return;
    const { idx, record } = found;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'memo-edit-input select-inline-input';
    if (placeholder) input.placeholder = placeholder;
    input.value = record[field] || fallback || '';

    container.innerHTML = '';
    container.appendChild(input);
    input.focus();

    let committed = false;
    const commit = () => {
        if (committed) return;
        committed = true;
        const patch = { [field]: input.value.trim() };
        if (onCommit) Object.assign(patch, onCommit(input.value.trim()));
        commitEdit(idx, patch);
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
    });
};

// 追加レコードの容量セルを編集モードにしてフォーカス（行追加後の自動入力誘導）
const focusSizeCell = (id) => {
    const row = document.querySelector(`tr.item-row[data-id="${id}"]`);
    if (!row) return;
    // 容量セルは2列目（.size-cell 配下の .clickable-cell）
    const sizeCell = row.querySelector('.size-cell .clickable-cell');
    if (sizeCell) enableTextEdit(id, sizeCell, 'manualSize', '例: 500GB',
        (text) => ({ size: text, size_bytes: parseSizeToBytes(text) }), record.size || '');
};

// 通電時間と電源回数を1セル内で並べて編集（両方の数値を更新）
const enableHoursCycleEdit = (id, container) => {
    const found = findRecord(id);
    if (!found || container.querySelector('input')) return;
    const { idx, record } = found;

    const make = (field, placeholder, width) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.className = 'memo-edit-input select-inline-input';
        input.placeholder = placeholder;
        input.style.width = width;
        const cur = record[field];
        input.value = (typeof cur === 'number' && cur > 0) ? String(cur) : '';
        return input;
    };
    const hoursInput = make('hours_val', '時間', '52px');
    const cycleInput = make('powerCycleCount', '回数', '52px');

    container.innerHTML = '';
    container.appendChild(hoursInput);
    const sep = document.createElement('span');
    sep.innerText = ' / ';
    sep.style.color = '#a0aec0';
    container.appendChild(sep);
    container.appendChild(cycleInput);
    hoursInput.focus();

    let committed = false;
    const commit = () => {
        if (committed) return;
        committed = true;
        // 入力が空なら既存値を維持（0で上書きしない）、入力があれば数値化
        const parseOrKeep = (raw, keep) => {
            const trimmed = raw.trim();
            if (trimmed === '') return keep;
            const n = parseInt(trimmed, 10);
            return isNaN(n) ? keep : n;
        };
        commitEdit(idx, {
            hours_val: parseOrKeep(hoursInput.value, record.hours_val),
            powerCycleCount: parseOrKeep(cycleInput.value, record.powerCycleCount)
        });
    };

    [hoursInput, cycleInput].forEach(input => {
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
        });
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

// 通電時間 / 電源回数の表示文字列（未入力項目は省略、両方未入力なら空）
const formatHoursCycle = (powerOnHours, powerCycleCount) => {
    const hasHours = powerOnHours && powerOnHours !== '不明';
    const cycleNum = typeof powerCycleCount === 'number' ? powerCycleCount : 0;
    const hasCycle = typeof powerCycleCount === 'number' && cycleNum > 0;
    if (hasHours && hasCycle) return `${powerOnHours} / ${cycleNum}回`;
    if (hasHours) return powerOnHours;
    if (hasCycle) return `${cycleNum}回`;
    return '';
};

// 状態レベルバッジを生成（手動登録は青バッジ・判定理由なし）
const createLevelBadge = (item) => {
    const hl = item.isManual ? LEVEL_LABELS.length - 1 : (item.healthLevel ?? 0);
    const badge = document.createElement('span');
    badge.className = item.isManual ? 'level-badge level-manual' : `level-badge level-${hl}`;
    if (!item.isManual) badge.title = item.healthReasons.join('\n');
    badge.innerText = LEVEL_LABELS[hl];
    return badge;
};

// メモセルを生成
const createMemoCell = (item) => {
    const td = document.createElement('td');
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
    memoCell.addEventListener('click', () => enableTextEdit(item.id, memoCell, 'memo'));
    td.appendChild(memoCell);
    return td;
};

const createRow = (item, index) => {
    const currentType = item.customType || 'unknown';
    const isUnknown = currentType === 'unknown';

    const tr = document.createElement('tr');
    tr.className = isUnknown ? 'item-row unknown-type-row' : 'item-row';
    tr.setAttribute('draggable', 'true');
    tr.setAttribute('data-id', item.id);

    // メーカー（編集可能・自由入力可）
    const tdVendor = document.createElement('td');
    tdVendor.appendChild(createEditableCell(
        item.vendor || '不明',
        (e) => enableSelectEdit(item.id, e.currentTarget, 'vendor', VENDOR_OPTIONS, true)
    ));
    tr.appendChild(tdVendor);

    // 容量（編集可能・size_bytesも再計算）
    const tdSize = document.createElement('td');
    tdSize.className = 'size-cell';
    tdSize.appendChild(createEditableCell(
        item.size || '—',
        (e) => enableTextEdit(item.id, e.currentTarget, 'manualSize', '例: 500GB',
            (text) => ({ size: text, size_bytes: parseSizeToBytes(text) }), item.size || '')
    ));
    tr.appendChild(tdSize);

    // モデル名（編集可能）
    const tdModel = document.createElement('td');
    tdModel.className = 'model-cell';
    tdModel.appendChild(createEditableCell(
        item.model || '—',
        (e) => enableTextEdit(item.id, e.currentTarget, 'model')
    ));
    tr.appendChild(tdModel);

    // 分類（編集可能）
    const tdType = document.createElement('td');
    tdType.appendChild(createEditableCell(
        TYPE_LABELS[currentType] || '不明',
        (e) => enableSelectEdit(item.id, e.currentTarget, 'customType', TYPE_OPTIONS)
    ));
    tr.appendChild(tdType);

    // 状態レベル（編集不可）
    const tdLevel = document.createElement('td');
    tdLevel.appendChild(createLevelBadge(item));
    tr.appendChild(tdLevel);

    // 残り寿命（編集可能・表示文字列 lifeOrSector を直接編集）
    const tdLife = document.createElement('td');
    tdLife.appendChild(createEditableCell(
        item.lifePercent >= 0 ? item.lifePercent + '%' : (item.lifeOrSector || '—'),
        (e) => enableTextEdit(item.id, e.currentTarget, 'lifeOrSector', '例: 寿命: 99%')
    ));
    tr.appendChild(tdLife);

    // 総書込量（編集可能・表示文字列 tbw を直接編集）
    const tdTbw = document.createElement('td');
    tdTbw.appendChild(createEditableCell(
        item.tbw || '—',
        (e) => enableTextEdit(item.id, e.currentTarget, 'tbw', '例: 1.6 TBW')
    ));
    tr.appendChild(tdTbw);

    // 通電時間 / 電源回数（1セル内で2つの数値を編集）
    const tdHours = document.createElement('td');
    const hoursCell = document.createElement('div');
    hoursCell.className = 'clickable-cell';
    hoursCell.style.gap = '0';
    hoursCell.innerText = formatHoursCycle(item.powerOnHours, item.powerCycleCount);
    hoursCell.addEventListener('click', (e) => enableHoursCycleEdit(item.id, e.currentTarget));
    tdHours.appendChild(hoursCell);
    tr.appendChild(tdHours);

    // メモ（編集可能）
    tr.appendChild(createMemoCell(item));

    // 行挿入ボタン（右端の「＋」、クリックでこの行の直後に手動レコード挿入）
    const tdInsert = document.createElement('td');
    tdInsert.className = 'insert-cell';
    const insertBtn = document.createElement('button');
    insertBtn.className = 'btn-insert';
    insertBtn.title = 'この下に行を追加';
    insertBtn.innerText = '＋';
    insertBtn.addEventListener('click', () => addManualRecordAfter(item.id));
    tdInsert.appendChild(insertBtn);
    tr.appendChild(tdInsert);

    // 行クリックで詳細トグル（編集可能セル・ボタン・入力要素は除外）
    const detailsId = `details-${index}`;
    tr.addEventListener('click', (e) => {
        if (e.target.closest('.clickable-cell, button, select, input, option')) return;
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

// 詳細グリッドに判定理由ブロックを追加（右端に消去ボタンを配置）
// 判定理由1行をノード配列に変換: 既知キーワードはツールチップ付きspanに、それ以外はテキストに
const createReasonNodes = (reason) => {
    const nodes = [];
    let rest = reason;
    while (rest.length > 0) {
        // 出現位置が最も早いキーワードを探す
        const match = REASON_GLOSSARY
            .map(g => ({ g, idx: rest.indexOf(g.key) }))
            .filter(m => m.idx !== -1)
            .sort((a, b) => a.idx - b.idx)[0];
        if (!match) {
            nodes.push(document.createTextNode(rest));
            break;
        }
        if (match.idx > 0) {
            nodes.push(document.createTextNode(rest.slice(0, match.idx)));
        }
        const span = document.createElement('span');
        span.className = 'reason-keyword';
        span.tabIndex = 0;
        span.title = match.g.desc;
        span.innerText = match.g.key;
        nodes.push(span);
        rest = rest.slice(match.idx + match.g.key.length);
    }
    return nodes;
};

const appendReasonsBlock = (grid, reasons, actionBtn) => {
    const div = document.createElement('div');
    div.className = 'reason-block';
    // ラベル行（ラベル左詰め、ボタン右詰め）
    const header = document.createElement('div');
    header.className = 'reason-header';
    const strong = document.createElement('strong');
    strong.innerText = '判定理由:';
    header.appendChild(strong);
    if (actionBtn) header.appendChild(actionBtn);
    div.appendChild(header);
    // 理由本文（各理由を1行に、キーワードはツールチップ付きspanに）
    const body = document.createElement('span');
    reasons.forEach((reason, i) => {
        if (i > 0) body.appendChild(document.createElement('br'));
        body.append(document.createTextNode('・'));
        createReasonNodes(reason).forEach(node => body.appendChild(node));
    });
    div.appendChild(body);
    grid.appendChild(div);
};

const createDetailsRow = (item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'details-row hidden';
    tr.id = `details-${index}`;

    const td = document.createElement('td');
    td.colSpan = 10;

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

    // 消去ボタン（判定理由ブロックの右端に配置）
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger btn-mini';
    delBtn.innerText = 'このストレージを消去';
    delBtn.addEventListener('click', () => deleteItem(item.id));
    appendReasonsBlock(grid, item.healthReasons, delBtn);
    container.appendChild(grid);

    const raw = document.createElement('div');
    raw.className = 'raw-json';
    raw.innerText = item.raw;
    container.appendChild(raw);

    td.appendChild(container);
    tr.appendChild(td);
    return tr;
};

// 0件時の行: メッセージ＋新規追加ボタン（分類は選択中フィルタで登録）
const createEmptyRow = () => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 10;
    td.style.cssText = 'text-align:center; color:#a0aec0; padding:30px;';

    const msg = document.createElement('span');
    msg.innerText = '該当するディスクがありません。';
    td.appendChild(msg);

    const btn = document.createElement('button');
    btn.className = 'btn-add-empty';
    btn.innerText = '＋ 新規追加';
    btn.addEventListener('click', () => addManualRecordToEnd());
    td.appendChild(btn);

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
        tbody.appendChild(createEmptyRow());
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
            const srcId = Number(dragSrcEl.getAttribute('data-id'));
            const targetId = Number(e.currentTarget.getAttribute('data-id'));
            const srcIdx = db.findIndex(item => item.id === srcId);
            const targetIdx = db.findIndex(item => item.id === targetId);
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
