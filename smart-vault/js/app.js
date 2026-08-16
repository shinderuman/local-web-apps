const STORAGE_KEY = 'storage_smart_assets';
const SESSION_KEYS = {
    filter: 'smart_vault_filter',
    viewMode: 'smart_vault_view_mode'
};

const TIMING = {
    TOAST_DURATION: 2500,
    HIGHLIGHT_DURATION: 3000
};

const TYPE_LABELS = {
    nvme: 'NVMe',
    'sata-ssd': 'SATA SSD',
    sshd: 'SSHD',
    'hdd-25': 'HDD 2.5"',
    'hdd-35': 'HDD 3.5"',
    emmc: 'eMMC',
    unknown: '不明'
};

const CORE_VENDORS = [
    'ADATA',
    'Apple',
    'Crucial',
    'HGST',
    'HITACHI',
    'Intel',
    'Kingston',
    'Kioxia',
    'LEVEN',
    'Samsung',
    'SanDisk',
    'Seagate',
    'Silicon Power',
    'Toshiba',
    'Western Digital'
];

const FILTER_TYPES = ['all', ...Object.keys(TYPE_LABELS)];

const VENDOR_OPTIONS = [
    { label: '不明', value: '不明' },
    ...CORE_VENDORS.map((v) => ({ label: v, value: v }))
];
const TYPE_OPTIONS = Object.keys(TYPE_LABELS).map((key) => ({
    label: TYPE_LABELS[key],
    value: key
}));

// S.M.A.R.T. からは判定不能なためユーザー手動設定
const USAGE_LABELS = {
    'in-use': '使用中',
    unused: '未使用',
    'near-dead': 'ほぼ故障品'
};
const USAGE_DEFAULT = 'unused';
// クリックトグルの循環順
const USAGE_CYCLE = ['unused', 'in-use', 'near-dead'];

const BACKUP_FILENAME = 'smart-storage.json';

// 理由文字列中のキーが出現したらツールチップ化
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

const TOAST = {
    PARSE_OK: 'データを解析して登録・更新しました',
    PARSE_UPDATED: '登録済みのデータを更新しました',
    PARSE_FAIL: 'エラー: パース失敗',
    NO_SERIAL: 'エラー: S/N不検出',
    REBUILT: 'データベースを再構築しました',
    DELETED: '記録を削除しました',
    IMPORTED: 'バックアップからデータを復元しました',
    IMPORT_FAIL: 'エラー: 不正なファイル構造です',
    SAVED: 'ファイルを保存しました',
    SAVE_FAIL: 'エラー: 保存に失敗しました',
    EXPORTED_FILE: '選択中のレコードを .json で出力しました',
    EXPORT_NO_SELECTION: 'レコードが選択されていません',
    BENCH_REGISTERED: 'ベンチ結果を登録しました',
    BENCH_INVALID: 'エラー: fio結果として認識できません',
    BENCH_DELETED: 'ベンチマーク結果を削除しました',
    SUMMARY_COPIED: 'クリップボードへコピーしました',
    SUMMARY_EMPTY: 'レコードがありません'
};

let sortableInstance = null;
let db = (() => {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return Array.isArray(raw) ? raw : Object.values(raw);
})();

const viewState = {
    filter: sessionStorage.getItem(SESSION_KEYS.filter) || 'all',
    viewMode: sessionStorage.getItem(SESSION_KEYS.viewMode) || 'smart',
    sortField: '',
    sortOrder: 'asc'
};

const uiState = {
    toastTimer: null,
    highlightTimer: null,
    selectedIds: new Set(),
    openDetailId: null
};

const { detectVendor } = window.VENDOR_LOGIC;
const {
    pickNum,
    calcSize,
    parseSizeToBytes,
    calcTbw,
    calcLife,
    calcSectorCounts,
    detectCustomType
} = window.PARSE_LOGIC;
const { computeHealthLevel } = window.HEALTH_LOGIC;
const {
    formatHours,
    formatTemp,
    formatTbw,
    formatCount,
    formatBw,
    formatIops,
    formatLatency
} = window.FORMAT_LOGIC;
const { compactRaw, prettifyRaw, buildSmartJsonArray } =
    window.JSON_NORMALIZE_LOGIC;
const {
    isFioJson,
    splitBench,
    parseBench,
    rateSeqBw,
    rateRandIops,
    rateLatency
} = window.BENCH_LOGIC;
const {
    countRecordsByType,
    getNextSortState,
    sortRecords,
    filterRecordsByType,
    reorderRecordsByVisiblePosition,
    isValidSmartRecordList
} = window.RECORD_LOGIC;
const { buildStorageSummaryMarkdown } = window.SUMMARY_LOGIC;

const parseSmartJson = (rawText, existingRecord = null) => {
    const data = JSON.parse(rawText);
    const serial =
        data.serial_number || (data.device && data.device.serial_number) || '';
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

    const hoursVal = pickNum(
        data,
        'power_on_time.hours',
        'nvme_smart_health_information_log.power_on_hours',
        0
    );
    const powerCycleCount = pickNum(
        data,
        'power_cycle_count',
        'nvme_smart_health_information_log.power_cycles',
        '不明'
    );
    const tempVal = pickNum(
        data,
        'temperature.current',
        'nvme_smart_health_information_log.temperature',
        0
    );

    const tbwVal = calcTbw(data);
    const { lifePercent, lifeOrSector } = calcLife(data);
    const { reallocSectors, pendingSectors, crcErrors } =
        calcSectorCounts(data);

    const memo = existingRecord ? existingRecord.memo : '';
    const usage = existingRecord ? existingRecord.usage : USAGE_DEFAULT;
    const existingType = existingRecord ? existingRecord.customType : '';
    let vendor = existingRecord ? existingRecord.vendor : '';
    const id = existingRecord ? existingRecord.id : Number(Date.now());
    const benchSeq = existingRecord ? existingRecord.benchSeq : undefined;
    const benchRand = existingRecord ? existingRecord.benchRand : undefined;
    const benchLatency = existingRecord
        ? existingRecord.benchLatency
        : undefined;

    if (!vendor) vendor = detectVendor(data, model);
    const detected = detectCustomType(
        protocol,
        model,
        deviceType,
        existingType
    );
    const customType =
        detected === 'unknown' ? manualTypeFromFilter() : detected;

    const {
        level: healthLevel,
        reasons: healthReasons,
        score: severityScore
    } = computeHealthLevel(data, {
        customType,
        health,
        hours_val: hoursVal,
        lifePercent,
        reallocSectors,
        pendingSectors,
        crcErrors,
        tbw_val: tbwVal
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
        severityScore,
        healthReasons,
        updatedAt: new Date().toLocaleString(),
        memo,
        usage,
        customType,
        raw: compactRaw(rawText),
        ...(benchSeq !== undefined ? { benchSeq } : {}),
        ...(benchRand !== undefined ? { benchRand } : {}),
        ...(benchLatency !== undefined ? { benchLatency } : {})
    };
};

const saveDb = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

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
    severityScore: null,
    healthReasons: [],
    updatedAt: new Date().toLocaleString(),
    memo: '',
    usage: USAGE_DEFAULT,
    customType,
    raw: ''
});

const upsertRecord = (rawText) => {
    const parsedTmp = JSON.parse(rawText);
    const serial =
        parsedTmp.serial_number ||
        (parsedTmp.device && parsedTmp.device.serial_number) ||
        '';
    if (!serial) {
        showToast(TOAST.NO_SERIAL);
        return;
    }

    const existingIndex = db.findIndex((item) => item.serial === serial);
    const existingRecord = existingIndex !== -1 ? db[existingIndex] : null;
    const newRecord = parseSmartJson(rawText, existingRecord);

    const isUpdate = existingIndex !== -1;
    if (isUpdate) {
        db[existingIndex] = newRecord;
    } else {
        db.push(newRecord);
    }

    saveDb();
    renderTable();
    highlightRow(newRecord.id);
    showToast(isUpdate ? TOAST.PARSE_UPDATED : TOAST.PARSE_OK);
};

const registerBench = (rawText) => {
    if (!isFioJson(rawText)) {
        showToast(TOAST.BENCH_INVALID);
        return;
    }
    const id = [...uiState.selectedIds][0];
    const idx = db.findIndex((item) => item.id === id);
    if (idx === -1) return;
    const { seq, rand, latency } = splitBench(rawText);
    db[idx].benchSeq = seq;
    db[idx].benchRand = rand;
    if (latency) {
        db[idx].benchLatency = latency;
    } else {
        delete db[idx].benchLatency;
    }
    db[idx].updatedAt = new Date().toLocaleString();
    saveDb();
    renderTable();
    highlightRow(id);
    clearSelection();
    showToast(TOAST.BENCH_REGISTERED);
};

const manualTypeFromFilter = () => {
    const f = viewState.filter;
    return f && f !== 'all' ? f : 'unknown';
};

const addManualRecordToEnd = () => {
    const newRecord = createManualRecord(manualTypeFromFilter());
    db.push(newRecord);
    saveDb();
    renderTable();
    focusSizeCell(newRecord.id);
};

const rebuildDatabaseFromRaw = () => {
    if (db.length === 0) return;
    const ok = confirm(
        '蓄積された生JSONデータから台帳を再構築します。\nSMARTレコードは分類・メーカー・メモのみ維持し、それ以外（容量・モデル名・寿命・TBW・通電時間等の手動編集を含む）は生JSONで上書きされます。\n手動登録レコードはそのまま維持されます。実行しますか？'
    );
    if (!ok) return;

    db = db.map((oldRecord) => {
        if (!oldRecord.raw) return oldRecord;
        try {
            // 再構築は再パースが目的なので最終更新日時は維持
            const rebuilt = parseSmartJson(oldRecord.raw, oldRecord);
            return { ...rebuilt, updatedAt: oldRecord.updatedAt };
        } catch {
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
    db = db.filter((item) => item.id !== id);
    saveDb();
    renderTable();
    showToast(TOAST.DELETED);
};

const deleteBench = (id) => {
    const ok = confirm(
        'このストレージのベンチマーク結果を削除しますか？（S.M.A.R.T. 情報は維持されます）'
    );
    if (!ok) return;
    const idx = db.findIndex((item) => item.id === id);
    if (idx === -1) return;
    delete db[idx].benchSeq;
    delete db[idx].benchRand;
    delete db[idx].benchLatency;
    saveDb();
    renderTable();
    showToast(TOAST.BENCH_DELETED);
};

const importBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            const importedArr = Array.isArray(importedData)
                ? importedData
                : Object.values(importedData);
            if (!isValidSmartRecordList(importedArr)) {
                showToast(TOAST.IMPORT_FAIL);
                document.getElementById('fileInput').value = '';
                return;
            }
            if (
                !confirm(
                    '復元を実行しますか？\n既存のデータはすべて置き換えられます。'
                )
            ) {
                document.getElementById('fileInput').value = '';
                return;
            }
            db = importedArr;
            saveDb();
            renderTable();
            showToast(TOAST.IMPORTED);
        } catch (err) {
            console.error('importBackup失敗:', err);
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
            types: [
                {
                    description: 'JSON File',
                    accept: { 'application/json': ['.json'] }
                }
            ]
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
    const counts = countRecordsByType(db, FILTER_TYPES);
    FILTER_TYPES.forEach((key) => {
        const el = document.getElementById(`count-${key}`);
        if (el) el.innerText = counts[key];
    });
};

const applyFilter = (type, btn) => {
    viewState.filter = type;
    sessionStorage.setItem(SESSION_KEYS.filter, type);
    document
        .querySelectorAll('.filter-btn')
        .forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateDragEnabled();
    renderTable();
};

const SMART_HEADERS = [
    { text: '残り寿命', sort: 'lifePercent' },
    { text: '総書込量', sort: 'tbw_val' },
    { text: '通電時間 / 電源回数', sort: 'hours_val' }
];
const BENCH_HEADERS = [
    { text: 'Seq読込', sort: 'seqBw' },
    { text: 'Rand読込', sort: 'randIops' },
    { text: 'レイテンシ', sort: 'randClat' }
];

const updateHeaderView = () => {
    const swapKeys = new Set(
        [...SMART_HEADERS, ...BENCH_HEADERS].map((h) => h.sort)
    );
    const ths = [...document.querySelectorAll('.storage-list thead th')].filter(
        (th) => swapKeys.has(th.dataset.sort)
    );
    const headers =
        viewState.viewMode === 'bench' ? BENCH_HEADERS : SMART_HEADERS;
    headers.forEach((header, i) => {
        const th = ths[i];
        if (!th) return;
        th.innerText = header.text;
        th.setAttribute('data-sort', header.sort);
    });
};

const applyViewMode = (mode, btn) => {
    viewState.viewMode = mode;
    sessionStorage.setItem(SESSION_KEYS.viewMode, mode);
    document
        .querySelectorAll('.view-toggle')
        .forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    viewState.sortField = '';
    viewState.sortOrder = 'asc';
    updateDragEnabled();
    renderTable();
};

const sortTable = (field) => {
    Object.assign(viewState, getNextSortState(viewState, field));
    updateDragEnabled();
    renderTable();
};

const toggleDetails = (id) => {
    uiState.openDetailId = uiState.openDetailId === id ? null : id;
    const el = document.getElementById(`details-${id}`);
    if (el) el.classList.toggle('hidden');
};

const downloadJsonFile = (content, filename) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
        new Blob([content], { type: 'application/json' })
    );
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
};

const exportSelectedToJson = () => {
    const selected = db.filter((item) => uiState.selectedIds.has(item.id));
    const content = buildSmartJsonArray(selected);
    if (!content) {
        showToast(TOAST.EXPORT_NO_SELECTION);
        return;
    }
    downloadJsonFile(content, 'smart-selected.json');
    showToast(TOAST.EXPORTED_FILE);
};

const copySummaryToClipboard = () => {
    if (db.length === 0) {
        showToast(TOAST.SUMMARY_EMPTY);
        return;
    }
    const markdown = buildStorageSummaryMarkdown(db, TYPE_LABELS);
    navigator.clipboard
        .writeText(markdown)
        .then(() => showToast(TOAST.SUMMARY_COPIED))
        .catch((e) => {
            console.error('クリップボードへのコピーに失敗しました', e);
            showToast(TOAST.SAVE_FAIL);
        });
};

const findRecord = (id) => {
    const idx = db.findIndex((item) => item.id === id);
    return idx === -1 ? null : { idx, record: db[idx] };
};

const commitEdit = (idx, patch) => {
    Object.assign(db[idx], patch);
    saveDb();
    renderTable();
};

const enableSelectEdit = (
    id,
    container,
    field,
    options,
    allowFreeInput = false
) => {
    const found = findRecord(id);
    if (!found || container.querySelector('select')) return;
    const { idx, record } = found;
    const current = record[field] || options[0].value;

    const select = document.createElement('select');
    select.className = 'select-inline-input';
    options.forEach((opt) => {
        select.add(
            new Option(opt.label, opt.value, false, opt.value === current)
        );
    });
    const isCustom =
        allowFreeInput && !options.some((o) => o.value === current) && current;
    if (isCustom) select.add(new Option(current, current, true, true));
    if (allowFreeInput)
        select.add(new Option('+ 新規直接自由入力...', '__free_input__'));

    container.innerHTML = '';
    container.appendChild(select);
    select.focus();

    let committed = false;
    const commit = (val) => {
        if (committed) return;
        committed = true;
        let next = val;
        if (val === '__free_input__') {
            const userInput = prompt(
                '手動自由入力してください:',
                isCustom ? current : ''
            );
            next = userInput && userInput.trim() ? userInput.trim() : current;
        }
        commitEdit(idx, { [field]: next });
    };

    select.addEventListener('change', () => commit(select.value));
    select.addEventListener('blur', () => commit(select.value));
};

const enableTextEdit = (
    id,
    container,
    field,
    placeholder = '',
    onCommit = null,
    fallback = ''
) => {
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

const focusSizeCell = (id) => {
    const row = document.querySelector(`tr.item-row[data-id="${id}"]`);
    if (!row) return;
    const sizeCell = row.querySelector('.size-cell .clickable-cell');
    if (!sizeCell) return;
    const found = findRecord(id);
    const fallback = found ? found.record.size || '' : '';
    enableTextEdit(
        id,
        sizeCell,
        'manualSize',
        '例: 500GB',
        (text) => ({ size: text, size_bytes: parseSizeToBytes(text) }),
        fallback
    );
};

const highlightRow = (id) => {
    const row = document.querySelector(`tr.item-row[data-id="${id}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('row-updated');
    if (uiState.highlightTimer) clearTimeout(uiState.highlightTimer);
    uiState.highlightTimer = setTimeout(() => {
        row.classList.remove('row-updated');
    }, TIMING.HIGHLIGHT_DURATION);
};

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
        input.value = typeof cur === 'number' && cur > 0 ? String(cur) : '';
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
        // 入力が空なら既存値を維持（0で上書きしない）
        const parseOrKeep = (raw, keep) => {
            const trimmed = raw.trim();
            if (trimmed === '') return keep;
            const n = parseInt(trimmed, 10);
            return isNaN(n) ? keep : n;
        };
        commitEdit(idx, {
            hours_val: parseOrKeep(hoursInput.value, record.hours_val),
            powerCycleCount: parseOrKeep(
                cycleInput.value,
                record.powerCycleCount
            )
        });
    };

    [hoursInput, cycleInput].forEach((input) => {
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
        });
    });
};

const getDisplayItems = () => {
    if (viewState.viewMode === 'bench' && viewState.sortField) {
        const BENCH_SORT_KEYS = {
            seqBw: 'seqBwBytes',
            randIops: 'randIops',
            randClat: 'latencyClatP99Ns'
        };
        const benchKey = BENCH_SORT_KEYS[viewState.sortField];
        if (benchKey) {
            const enriched = db.map((item) => {
                const bench =
                    item.benchSeq || item.benchRand || item.benchLatency
                        ? parseBench(
                              item.benchSeq,
                              item.benchRand,
                              item.benchLatency
                          )
                        : null;
                return {
                    ...item,
                    [viewState.sortField]: bench ? bench[benchKey] : undefined
                };
            });
            return sortRecords(
                enriched,
                viewState.sortField,
                viewState.sortOrder
            );
        }
    }
    return sortRecords(db, viewState.sortField, viewState.sortOrder);
};

const updateSortIndicators = () => {
    document
        .querySelectorAll('.storage-list thead th')
        .forEach((th) => (th.className = ''));
    if (!viewState.sortField) return;
    const th = document.querySelector(`th[data-sort="${viewState.sortField}"]`);
    if (!th) return;
    th.className = viewState.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc';
};

const createEditableCell = (text, onEdit) => {
    const cell = document.createElement('div');
    cell.className = 'clickable-cell';
    cell.innerText = text;
    cell.addEventListener('click', onEdit);
    return cell;
};

const formatHoursCycle = (powerOnHours, powerCycleCount) => {
    const hasHours = powerOnHours && powerOnHours !== '不明';
    const cycleNum = typeof powerCycleCount === 'number' ? powerCycleCount : 0;
    const hasCycle = typeof powerCycleCount === 'number' && cycleNum > 0;
    if (hasHours && hasCycle) return `${powerOnHours} / ${cycleNum}回`;
    if (hasHours) return powerOnHours;
    if (hasCycle) return `${cycleNum}回`;
    return '';
};

const createBenchMetricCell = (bwBytes, iops, rate) => {
    const td = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'bench-cell';
    if (rate) wrap.classList.add(`bench-rate-${rate}`);
    const bw = document.createElement('div');
    bw.className = 'bench-bw';
    bw.innerText = formatBw(bwBytes);
    const ip = document.createElement('div');
    ip.className = 'bench-iops';
    ip.innerText = formatIops(iops);
    wrap.appendChild(bw);
    wrap.appendChild(ip);
    td.appendChild(wrap);
    return td;
};

const createBenchSeqCell = (item) => {
    const bench =
        item.benchSeq || item.benchRand || item.benchLatency
            ? parseBench(item.benchSeq, item.benchRand, item.benchLatency)
            : null;
    if (!bench) {
        const td = document.createElement('td');
        td.innerText = '—';
        return td;
    }
    return createBenchMetricCell(
        bench.seqBwBytes,
        bench.seqIops,
        rateSeqBw(bench.seqBwBytes, item.customType)
    );
};

const createBenchRandCell = (item) => {
    const bench =
        item.benchSeq || item.benchRand || item.benchLatency
            ? parseBench(item.benchSeq, item.benchRand, item.benchLatency)
            : null;
    if (!bench) {
        const td = document.createElement('td');
        td.innerText = '—';
        return td;
    }
    return createBenchMetricCell(
        bench.randBwBytes,
        bench.randIops,
        rateRandIops(bench.randIops, item.customType)
    );
};

const createBenchLatencyCell = (item) => {
    const td = document.createElement('td');
    const bench =
        item.benchSeq || item.benchRand || item.benchLatency
            ? parseBench(item.benchSeq, item.benchRand, item.benchLatency)
            : null;
    if (!bench) {
        td.innerText = '—';
        return td;
    }
    if (!bench.latencyClatP99Ns) {
        td.innerText = '—';
        return td;
    }
    const wrap = document.createElement('div');
    wrap.className = 'bench-latency';
    const latencyRate = rateLatency(bench.latencyClatP99Ns, item.customType);
    if (latencyRate) wrap.classList.add(`bench-rate-${latencyRate}`);
    wrap.innerText = `Rand 4KiB p99 ${formatLatency(bench.latencyClatP99Ns)}`;
    td.appendChild(wrap);
    return td;
};

const createLevelBadge = (item) => {
    const badge = document.createElement('span');
    if (item.isManual) {
        badge.className = 'level-badge level-manual';
        badge.innerText = '手動';
        return badge;
    }
    const hl = item.healthLevel ?? 0;
    badge.className = `level-badge level-${hl}`;
    badge.title = item.healthReasons.join('\n');
    badge.innerText = `L${hl} ${item.severityScore ?? 0}`;
    return badge;
};

const nextUsage = (current) => {
    const idx = USAGE_CYCLE.indexOf(current);
    return USAGE_CYCLE[(idx + 1) % USAGE_CYCLE.length];
};

// stopPropagation で親trへの伝播を止め、詳細行展開との衝突を防ぐ
const createUsageCell = (item) => {
    const cell = document.createElement('div');
    cell.className = 'clickable-cell no-hover';
    const tag = document.createElement('span');
    tag.className = `usage-tag usage-${item.usage}`;
    tag.innerText = USAGE_LABELS[item.usage];
    cell.appendChild(tag);
    cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const found = findRecord(item.id);
        if (found) commitEdit(found.idx, { usage: nextUsage(item.usage) });
    });
    return cell;
};

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
    memoCell.addEventListener('click', () =>
        enableTextEdit(item.id, memoCell, 'memo')
    );
    td.appendChild(memoCell);
    return td;
};

const getVisibleItems = () => {
    return filterRecordsByType(getDisplayItems(), viewState.filter);
};

const toggleRowSelection = (id) => {
    if (uiState.selectedIds.has(id)) {
        uiState.selectedIds.delete(id);
    } else {
        uiState.selectedIds.add(id);
    }
    renderTable();
};

const clearSelection = () => {
    if (uiState.selectedIds.size === 0) return;
    uiState.selectedIds.clear();
    renderTable();
};

const updateExportButtonState = () => {
    const btn = document.getElementById('exportSelectedBtn');
    if (!btn) return;
    btn.classList.toggle('btn-dimmed', uiState.selectedIds.size === 0);
};

const createRow = (item) => {
    const currentType = item.customType || 'unknown';
    const isUnknown = currentType === 'unknown';

    const tr = document.createElement('tr');
    tr.className = isUnknown ? 'item-row unknown-type-row' : 'item-row';
    tr.setAttribute('data-id', item.id);
    if (uiState.selectedIds.has(item.id)) tr.classList.add('row-selected');

    const tdVendor = document.createElement('td');
    tdVendor.appendChild(
        createEditableCell(item.vendor || '不明', (e) =>
            enableSelectEdit(
                item.id,
                e.currentTarget,
                'vendor',
                VENDOR_OPTIONS,
                true
            )
        )
    );
    tr.appendChild(tdVendor);

    const tdSize = document.createElement('td');
    tdSize.className = 'size-cell';
    tdSize.appendChild(
        createEditableCell(item.size || '—', (e) =>
            enableTextEdit(
                item.id,
                e.currentTarget,
                'manualSize',
                '例: 500GB',
                (text) => ({ size: text, size_bytes: parseSizeToBytes(text) }),
                item.size || ''
            )
        )
    );
    tr.appendChild(tdSize);

    const tdModel = document.createElement('td');
    tdModel.className = 'model-cell';
    tdModel.appendChild(
        createEditableCell(item.model || '—', (e) =>
            enableTextEdit(item.id, e.currentTarget, 'model')
        )
    );
    tr.appendChild(tdModel);

    const tdSerial = document.createElement('td');
    tdSerial.className = 'serial-cell';
    tdSerial.appendChild(
        createEditableCell(item.serial || '—', (e) =>
            enableTextEdit(item.id, e.currentTarget, 'serial')
        )
    );
    if (item.serial) tdSerial.title = item.serial;
    tr.appendChild(tdSerial);

    const tdType = document.createElement('td');
    tdType.appendChild(
        createEditableCell(TYPE_LABELS[currentType] || '不明', (e) =>
            enableSelectEdit(
                item.id,
                e.currentTarget,
                'customType',
                TYPE_OPTIONS
            )
        )
    );
    tr.appendChild(tdType);

    const tdLevel = document.createElement('td');
    tdLevel.appendChild(createLevelBadge(item));
    tr.appendChild(tdLevel);

    if (viewState.viewMode === 'bench') {
        tr.appendChild(createBenchSeqCell(item));
    } else {
        const tdLife = document.createElement('td');
        tdLife.appendChild(
            createEditableCell(
                item.lifePercent >= 0
                    ? item.lifePercent + '%'
                    : item.lifeOrSector || '—',
                (e) =>
                    enableTextEdit(
                        item.id,
                        e.currentTarget,
                        'lifeOrSector',
                        '例: 寿命: 99%'
                    )
            )
        );
        tr.appendChild(tdLife);
    }

    if (viewState.viewMode === 'bench') {
        tr.appendChild(createBenchRandCell(item));
    } else {
        const tdTbw = document.createElement('td');
        tdTbw.appendChild(
            createEditableCell(item.tbw || '—', (e) =>
                enableTextEdit(item.id, e.currentTarget, 'tbw', '例: 1.6 TBW')
            )
        );
        tr.appendChild(tdTbw);
    }

    if (viewState.viewMode === 'bench') {
        tr.appendChild(createBenchLatencyCell(item));
    } else {
        const tdHours = document.createElement('td');
        const hoursCell = document.createElement('div');
        hoursCell.className = 'clickable-cell';
        hoursCell.style.gap = '0';
        hoursCell.innerText = formatHoursCycle(
            item.powerOnHours,
            item.powerCycleCount
        );
        hoursCell.addEventListener('click', (e) =>
            enableHoursCycleEdit(item.id, e.currentTarget)
        );
        tdHours.appendChild(hoursCell);
        tr.appendChild(tdHours);
    }

    const tdUsage = document.createElement('td');
    tdUsage.appendChild(createUsageCell(item));
    tr.appendChild(tdUsage);

    tr.appendChild(createMemoCell(item));

    // 行クリックで詳細トグル、Cmd/Ctrl+クリックで選択トグル
    // 通常クリック時の選択解除は document のクリックハンドラで一元処理
    tr.addEventListener('click', (e) => {
        if (e.target.closest('.clickable-cell, button, select, input, option'))
            return;
        if (e.metaKey || e.ctrlKey) {
            toggleRowSelection(item.id);
            return;
        }
        toggleDetails(item.id);
    });

    return tr;
};

const appendDetailField = (grid, label, value) => {
    const div = document.createElement('div');
    const strong = document.createElement('strong');
    strong.innerText = label + ': ';
    div.appendChild(strong);
    div.append(value);
    grid.appendChild(div);
};

const createReasonNodes = (reason) => {
    const nodes = [];
    let rest = reason;
    while (rest.length > 0) {
        // 出現位置が最も早いキーワードを探す
        const match = REASON_GLOSSARY.map((g) => ({
            g,
            idx: rest.indexOf(g.key)
        }))
            .filter((m) => m.idx !== -1)
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
    const header = document.createElement('div');
    header.className = 'reason-header';
    const strong = document.createElement('strong');
    strong.innerText = '判定理由:';
    header.appendChild(strong);
    if (actionBtn) header.appendChild(actionBtn);
    div.appendChild(header);
    const body = document.createElement('span');
    reasons.forEach((reason, i) => {
        if (i > 0) body.appendChild(document.createElement('br'));
        body.append(document.createTextNode('・'));
        createReasonNodes(reason).forEach((node) => body.appendChild(node));
    });
    div.appendChild(body);
    grid.appendChild(div);
};

const createCopyJsonButton = (rawText, label) => {
    const btn = document.createElement('button');
    btn.className = 'btn-copy-json';
    btn.innerText = label;
    btn.addEventListener('click', () => {
        navigator.clipboard.writeText(prettifyRaw(rawText)).then(() => {
            const original = label;
            btn.innerText = '✓ Copied';
            setTimeout(() => {
                btn.innerText = original;
            }, 1500);
        });
    });
    return btn;
};

const appendBenchBlock = (container, item) => {
    if (!item.benchSeq && !item.benchRand && !item.benchLatency) return;
    const bench = parseBench(item.benchSeq, item.benchRand, item.benchLatency);
    if (!bench) return;

    const block = document.createElement('div');
    block.className = 'bench-details';

    const title = document.createElement('div');
    title.className = 'bench-title';
    title.innerText = 'ベンチマーク結果 (fio)';
    block.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'details-grid';
    const fields = [
        ['Seq 帯域', formatBw(bench.seqBwBytes)],
        ['Seq IOPS', formatIops(bench.seqIops)],
        ['Seq負荷時 p99レイテンシ', formatLatency(bench.seqClatP99Ns)],
        ['Rand 帯域', formatBw(bench.randBwBytes)],
        ['Rand IOPS', formatIops(bench.randIops)],
        ['Rand負荷時 p99レイテンシ', formatLatency(bench.randClatP99Ns)],
        ['Rand 4KiB p99レイテンシ', formatLatency(bench.latencyClatP99Ns)]
    ];
    fields.forEach(([label, value]) => appendDetailField(grid, label, value));
    block.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'bench-actions';
    if (item.benchSeq)
        actions.appendChild(createCopyJsonButton(item.benchSeq, '📋 Seq Copy'));
    if (item.benchRand)
        actions.appendChild(
            createCopyJsonButton(item.benchRand, '📋 Rand Copy')
        );
    if (item.benchLatency)
        actions.appendChild(
            createCopyJsonButton(item.benchLatency, '📋 Latency Copy')
        );
    const benchDelBtn = document.createElement('button');
    benchDelBtn.className = 'btn-danger btn-mini';
    benchDelBtn.innerText = 'ベンチ削除';
    benchDelBtn.addEventListener('click', () => deleteBench(item.id));
    actions.appendChild(benchDelBtn);
    block.appendChild(actions);

    container.appendChild(block);
};

const createDetailsRow = (item) => {
    const tr = document.createElement('tr');
    tr.className =
        uiState.openDetailId === item.id ? 'details-row' : 'details-row hidden';
    tr.id = `details-${item.id}`;

    const td = document.createElement('td');
    td.colSpan = document.querySelectorAll('.storage-list thead th').length;

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

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger btn-mini';
    delBtn.innerText = 'このストレージを消去';
    delBtn.addEventListener('click', () => deleteItem(item.id));
    appendReasonsBlock(grid, item.healthReasons, delBtn);
    container.appendChild(grid);

    appendBenchBlock(container, item);

    if (item.raw) {
        const smartActions = document.createElement('div');
        smartActions.className = 'bench-actions';
        smartActions.appendChild(
            createCopyJsonButton(item.raw, '📋 Smart Copy')
        );
        container.appendChild(smartActions);
    }

    td.appendChild(container);
    tr.appendChild(td);
    return tr;
};

const createEmptyRow = () => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = document.querySelectorAll('.storage-list thead th').length;
    td.style.cssText = 'text-align:center; color:#a0aec0; padding:30px;';

    const msg = document.createElement('span');
    msg.innerText = '該当するディスクがありません。';
    td.appendChild(msg);

    tr.appendChild(td);
    return tr;
};

const renderTable = () => {
    const tbody = document.getElementById('storageTbody');
    tbody.innerHTML = '';
    updateHeaderView();
    updateCounters();
    updateSortIndicators();
    updateExportButtonState();

    const visibleItems = getVisibleItems();
    visibleItems.forEach((item) => {
        tbody.appendChild(createRow(item));
        tbody.appendChild(createDetailsRow(item));
    });

    if (visibleItems.length === 0) {
        tbody.appendChild(createEmptyRow());
    }
};

// ソート中はD&D無効化（フィルタ中は許可: 全体順序の完全保証は不要なため）
const isSortableDisabled = () => {
    return viewState.sortField !== '';
};

const updateDragEnabled = () => {
    if (sortableInstance) {
        sortableInstance.option('disabled', isSortableDisabled());
    }
};

const initSortable = () => {
    const tbody = document.getElementById('storageTbody');
    sortableInstance = Sortable.create(tbody, {
        animation: 150,
        draggable: '.item-row',
        filter: '.details-row, .clickable-cell, button, select, input',
        preventOnFilter: false,
        disabled: isSortableDisabled(),
        onEnd: handleSortEnd
    });
};

// 非表示アイテムの相対順序は維持
const handleSortEnd = (evt) => {
    if (evt.oldDraggableIndex === evt.newDraggableIndex) return;
    const visibleItems = getVisibleItems();
    const movedId = Number(evt.item.dataset.id);
    db = reorderRecordsByVisiblePosition(
        db,
        visibleItems,
        movedId,
        evt.oldDraggableIndex,
        evt.newDraggableIndex
    );
    saveDb();
    renderTable();
};

const bindStaticEvents = () => {
    const pasteZone = document.getElementById('pasteZone');
    pasteZone.addEventListener('click', () => pasteZone.focus());
    pasteZone.addEventListener('paste', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const rawText = (e.clipboardData || window.clipboardData)
            .getData('text')
            .trim();
        if (!rawText) return;
        try {
            upsertRecord(rawText);
        } catch {
            showToast(TOAST.PARSE_FAIL);
        }
    });

    // レコード1件選択時のみ有効（pasteZone 以外で発火）
    document.addEventListener('paste', (e) => {
        if (uiState.selectedIds.size !== 1) return;
        const rawText = (e.clipboardData || window.clipboardData)
            .getData('text')
            .trim();
        if (!rawText) return;
        e.preventDefault();
        try {
            registerBench(rawText);
        } catch {
            showToast(TOAST.BENCH_INVALID);
        }
    });

    document
        .getElementById('addManualBtn')
        .addEventListener('click', addManualRecordToEnd);
    document
        .getElementById('rebuildBtn')
        .addEventListener('click', rebuildDatabaseFromRaw);
    document
        .getElementById('exportBtn')
        .addEventListener('click', exportBackup);
    document
        .getElementById('fileInput')
        .addEventListener('change', importBackup);

    document
        .getElementById('exportSelectedBtn')
        .addEventListener('click', exportSelectedToJson);
    document
        .getElementById('exportSummaryBtn')
        .addEventListener('click', copySummaryToClipboard);

    document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.addEventListener('click', () =>
            applyFilter(btn.dataset.filter, btn)
        );
    });

    document.querySelectorAll('.view-toggle').forEach((btn) => {
        btn.addEventListener('click', () =>
            applyViewMode(btn.dataset.view, btn)
        );
    });

    document.querySelectorAll('th[data-sort]').forEach((th) => {
        th.addEventListener('click', () => sortTable(th.dataset.sort));
    });

    // JSON出力ボタンとCmd/Ctrl+クリック以外の全クリックで選択を解除
    document.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey) return;
        if (e.target.closest('#exportSelectedBtn')) return;
        clearSelection();
    });
};

const restoreFilterButton = () => {
    document
        .querySelectorAll('.filter-btn')
        .forEach((btn) => btn.classList.remove('active'));
    const activeBtn = document.querySelector(
        `.filter-btn[data-filter="${viewState.filter}"]`
    );
    if (activeBtn) activeBtn.classList.add('active');
};

const restoreViewToggleButton = () => {
    document
        .querySelectorAll('.view-toggle')
        .forEach((btn) => btn.classList.remove('active'));
    const activeBtn = document.querySelector(
        `.view-toggle[data-view="${viewState.viewMode}"]`
    );
    if (activeBtn) activeBtn.classList.add('active');
};

const init = () => {
    bindStaticEvents();
    restoreFilterButton();
    restoreViewToggleButton();
    initSortable();
    renderTable();
};

init();
