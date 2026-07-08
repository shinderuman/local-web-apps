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
// 純粋関数（S.M.A.R.T. パース・判定）※次ステップでモジュール化予定
// ============================================================

const detectVendor = (data, modelName) => {
    const upper = modelName.toUpperCase();
    const vId = data.nvme_pci_vendor?.id;
    if (vId === 4203 || upper.includes('APPLE')) return 'Apple';
    if (vId === 5197 || upper.includes('SAMSUNG')) return 'Samsung';
    if (vId === 4158 || upper.includes('CRUCIAL') || upper.includes('MICRON')) return 'Crucial';
    if (vId === 7474 || upper.includes('INTEL')) return 'Intel';
    if (upper.includes('WDC') || upper.includes('WESTERN DIGITAL') || upper.includes('WD')) return 'Western Digital';
    if (upper.includes('SEAGATE') || upper.includes('ST')) return 'Seagate';
    if (upper.includes('TOSHIBA')) return 'Toshiba';
    if (upper.includes('KIOXIA')) return 'Kioxia';
    if (upper.includes('SANDISK')) return 'SanDisk';
    if (upper.includes('KINGSTON')) return 'Kingston';

    if (modelName) {
        const firstWord = modelName.split(/[\s_-]/)[0];
        if (firstWord && firstWord.length > 1) return firstWord;
    }
    return '不明';
};

// S.M.A.R.T.属性からストレージの劣化度を4段階（0:正常/1:軽度/2:中度/3:要交換）で判定
const computeHealthLevel = (data, record) => {
    const { customType, health, hours_val, lifePercent, reallocSectors, pendingSectors, crcErrors } = record;
    const reasons = [];
    let level = 0;

    if (health === 'FAILED') {
        return { level: 3, reasons: ['S.M.A.R.T. 総合判定 = FAILED'] };
    }

    const ataTable = data.ata_smart_attributes?.table || [];
    const nvmeLog = data.nvme_smart_health_information_log;
    const errSummary = data.ata_smart_error_log?.summary;
    const errCount = Number(errSummary?.count) || 0;
    const errDescs = (errSummary?.table || [])
        .map(e => (e.error_description || '').toUpperCase())
        .join(' ');
    const hasUNC = /\bUNC\b/.test(errDescs);
    const hasIDNF = /\bIDNF\b/.test(errDescs);
    const hasICRC = /\bICRC\b/.test(errDescs);
    const hasABRT = /\bABRT\b/.test(errDescs);

    const getAttrRaw = (id) => {
        const a = ataTable.find(x => x.id === id);
        return a ? Number(a.raw?.value || 0) : 0;
    };
    const offlineUncorrectable = getAttrRaw(198);
    const commandTimeout = getAttrRaw(188);

    // レベルを更新しつつ理由を蓄積
    const raise = (lv, reason) => {
        if (lv > level) level = lv;
        if (!reasons.includes(reason)) reasons.push(reason);
    };

    const isHdd = customType === 'hdd-25' || customType === 'hdd-35' || customType === 'sshd' || customType === 'unknown';
    const isSataSsd = customType === 'sata-ssd' || customType === 'emmc';
    const isNvme = customType === 'nvme';

    if (isHdd) {
        if (pendingSectors > 0) raise(3, `保留中セクタ(197)=${pendingSectors}`);
        if (offlineUncorrectable > 0) raise(3, `回復不能セクタ(198)=${offlineUncorrectable}`);
        if (reallocSectors >= 1) raise(3, `代替処理済セクタ(5)=${reallocSectors}`);
        if (hasUNC) raise(3, `エラーログにUNC検出 (${errCount}件)`);
        if (hasIDNF) raise(3, 'エラーログにIDNF検出');

        if (hours_val >= 30000) raise(2, `通電時間=${hours_val}H (>=30000)`);

        if (crcErrors > 0) raise(1, `UDMA_CRC(199)=${crcErrors}`);
        if (commandTimeout > 0) raise(1, `Command_Timeout(188)=${commandTimeout}`);
        if ((hasICRC || hasABRT) && !hasUNC && !hasIDNF) raise(1, `エラーログにICRC/ABRT (${errCount}件)`);
    }

    if (isSataSsd) {
        if (lifePercent >= 0 && lifePercent <= 10) raise(3, `残り寿命=${lifePercent}% (<=10)`);
        const reserved = ataTable.find(a => a.id === 232 || a.id === 233);
        if (reserved && reserved.thresh !== undefined && Number(reserved.value) < Number(reserved.thresh)) {
            raise(3, `予備ブロック(ID${reserved.id})がしきい値下回り`);
        }
        if (lifePercent > 10 && lifePercent <= 50) raise(2, `残り寿命=${lifePercent}% (11-50)`);
        if (hours_val >= 40000) raise(2, `通電時間=${hours_val}H (>=40000)`);
        if (crcErrors > 0) raise(1, `UDMA_CRC(199)=${crcErrors}`);
        if (hours_val > 200000) raise(1, `通電時間異常値=${hours_val}H`);
    }

    if (isNvme) {
        const pctUsed = Number(nvmeLog?.percentage_used);
        const availSpare = Number(nvmeLog?.available_spare);
        const criticalWarning = Number(nvmeLog?.critical_warning) || 0;
        const mediaErrors = Number(nvmeLog?.media_errors) || 0;

        if (pctUsed >= 90) raise(3, `percentage_used=${pctUsed}% (>=90)`);
        if (!Number.isNaN(availSpare) && availSpare <= 10) raise(3, `available_spare=${availSpare}% (<=10)`);
        if (criticalWarning !== 0) raise(3, `critical_warning=0x${criticalWarning.toString(16)}`);
        if (pctUsed >= 50 && pctUsed < 90) raise(2, `percentage_used=${pctUsed}% (50-89)`);
        if (!Number.isNaN(availSpare) && availSpare > 10 && availSpare <= 50) raise(2, `available_spare=${availSpare}% (11-50)`);
        if (mediaErrors > 0) raise(1, `media_errors=${mediaErrors}`);
    }

    if (level === 0) reasons.push('判定基準に該当なし');
    return { level, reasons };
};

const parseSmartJson = (rawText, existingRecord = null) => {
    const data = JSON.parse(rawText);
    const serial = data.serial_number || (data.device && data.device.serial_number) || '';
    if (!serial) throw new Error('S/N無し');

    const model = data.model_name || '';
    const protocol = data.device?.protocol || '';
    const deviceType = data.device?.type || '';

    let sizeBytes = Number(data.user_capacity?.bytes || 0);
    let sizeStr = '不明';
    if (sizeBytes > 0) {
        const gb = sizeBytes / (1000 * 1000 * 1000);
        sizeStr = gb >= 1000 ? (gb / 1000).toFixed(1) + ' TB' : Math.round(gb) + ' GB';
    } else {
        const match = model.match(/(\d+)(Z|G|T)/i);
        if (match) {
            const unit = match[2].toUpperCase();
            const num = parseInt(match[1]);
            if (unit === 'G' || unit === 'Z') {
                sizeStr = num + ' GB';
                sizeBytes = num * 1000 * 1000 * 1000;
            }
            if (unit === 'T') {
                sizeStr = num + ' TB';
                sizeBytes = num * 1000 * 1000 * 1000 * 1000;
            }
        }
    }

    let health = 'UNKNOWN';
    if (data.smart_status?.passed !== undefined) {
        health = data.smart_status.passed ? 'PASSED' : 'FAILED';
    }

    let hoursVal = 0;
    if (data.power_on_time?.hours !== undefined) {
        hoursVal = Number(data.power_on_time.hours);
    } else if (data.nvme_smart_health_information_log?.power_on_hours !== undefined) {
        hoursVal = Number(data.nvme_smart_health_information_log.power_on_hours);
    }

    let powerCycleCount = '不明';
    if (data.power_cycle_count !== undefined) {
        powerCycleCount = Number(data.power_cycle_count);
    } else if (data.nvme_smart_health_information_log?.power_cycles !== undefined) {
        powerCycleCount = Number(data.nvme_smart_health_information_log.power_cycles);
    }

    let tempVal = 0;
    if (data.temperature?.current !== undefined) {
        tempVal = Number(data.temperature.current);
    } else if (data.nvme_smart_health_information_log?.temperature !== undefined) {
        tempVal = Number(data.nvme_smart_health_information_log.temperature);
    }

    let tbwVal = 0;
    if (data.nvme_smart_health_information_log?.data_units_written !== undefined) {
        tbwVal = (Number(data.nvme_smart_health_information_log.data_units_written) * 512000) / (1000 * 1000 * 1000 * 1000);
    } else if (data.ata_smart_attributes?.table) {
        const attr241 = data.ata_smart_attributes.table.find(a => a.id === 241);
        if (attr241 && attr241.raw?.value) {
            tbwVal = (Number(attr241.raw.value) / 2) / 1000;
        }
    }

    let lifeOrSector = '不明';
    let lifePercent = -1;
    if (data.endurance_used?.current_percent !== undefined) {
        lifePercent = 100 - Number(data.endurance_used.current_percent);
        lifeOrSector = '寿命: ' + lifePercent + '%';
    } else if (data.nvme_smart_health_information_log?.percentage_used !== undefined) {
        lifePercent = 100 - Number(data.nvme_smart_health_information_log.percentage_used);
        lifeOrSector = '寿命: ' + lifePercent + '%';
    } else if (data.ata_smart_attributes?.table) {
        const attr5 = data.ata_smart_attributes.table.find(a => a.id === 5);
        const attrLife = data.ata_smart_attributes.table.find(a => a.id === 232 || a.id === 233 || a.id === 202);
        if (attrLife) {
            lifePercent = Number(attrLife.value);
            lifeOrSector = '寿命: ' + lifePercent + '%';
        } else if (attr5) {
            const count = attr5.raw?.value || 0;
            lifeOrSector = count > 0 ? `<span class="bad-count">代替: ${count}</span>` : '代替: 0';
        }
    }

    // ATA属性: 代替処理済みセクタ(5), 保留中セクタ(197), CRCエラー(199)
    let reallocSectors = -1;
    let pendingSectors = -1;
    let crcErrors = -1;
    if (data.ata_smart_attributes?.table) {
        const attr5 = data.ata_smart_attributes.table.find(a => a.id === 5);
        const attr197 = data.ata_smart_attributes.table.find(a => a.id === 197);
        const attr199 = data.ata_smart_attributes.table.find(a => a.id === 199);
        if (attr5) reallocSectors = Number(attr5.raw?.value || 0);
        if (attr197) pendingSectors = Number(attr197.raw?.value || 0);
        if (attr199) crcErrors = Number(attr199.raw?.value || 0);
    }
    // NVMe: media_errors を代替処理済みセクタ相当として使用
    if (data.nvme_smart_health_information_log?.media_errors !== undefined) {
        reallocSectors = Number(data.nvme_smart_health_information_log.media_errors);
    }

    const memo = existingRecord ? existingRecord.memo : '';
    let customType = existingRecord ? existingRecord.customType : '';
    let vendor = existingRecord ? existingRecord.vendor : '';
    const id = existingRecord ? existingRecord.id : Number(Date.now());

    if (!vendor) vendor = detectVendor(data, model);
    if (!customType) {
        const p = (protocol || '').toLowerCase();
        const m = (model || '').toLowerCase();
        const t = (deviceType || '').toLowerCase();
        if (p.includes('nvme')) customType = 'nvme';
        else if (m.includes('emmc')) customType = 'emmc';
        else if (m.includes('sshd') || t.includes('sshd')) customType = 'sshd';
        else if (m.includes('ssd')) customType = 'sata-ssd';
        else customType = 'unknown';
    }

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
        powerOnHours: hoursVal === 0 ? '不明' : hoursVal + ' H',
        hours_val: hoursVal,
        powerCycleCount,
        temperature: tempVal === 0 ? '不明' : tempVal + ' °C',
        temp_val: tempVal,
        tbw: tbwVal === 0 ? '--' : tbwVal.toFixed(1) + ' TBW',
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

// ============================================================
// データ操作
// ============================================================

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

// 数値または未取得(-1)の表示用textNodeを生成
const countText = (val) => val >= 0 ? String(val) : '-';

const createRow = (item, index) => {
    const currentType = item.customType || 'unknown';
    const isUnknown = currentType === 'unknown';
    const hl = item.healthLevel ?? 0;

    const tr = document.createElement('tr');
    tr.className = isUnknown ? 'item-row unknown-type-row' : 'item-row';
    tr.setAttribute('draggable', 'true');
    tr.setAttribute('data-serial', item.serial);

    // メーカー（編集可能）
    const tdVendor = document.createElement('td');
    const vendorCell = document.createElement('div');
    vendorCell.className = 'clickable-cell';
    vendorCell.innerText = item.vendor || '不明';
    vendorCell.addEventListener('click', () => enableVendorEdit(item.serial, vendorCell));
    tdVendor.appendChild(vendorCell);
    tr.appendChild(tdVendor);

    // 容量
    const tdSize = document.createElement('td');
    tdSize.style.cssText = 'font-weight:bold; color:#2b6cb0; font-size:16px;';
    tdSize.innerText = item.size;
    tr.appendChild(tdSize);

    // モデル名
    const tdModel = document.createElement('td');
    tdModel.style.fontWeight = '500';
    tdModel.innerText = item.model;
    tr.appendChild(tdModel);

    // 分類（編集可能）
    const tdType = document.createElement('td');
    const typeCell = document.createElement('div');
    typeCell.className = 'clickable-cell';
    typeCell.innerText = TYPE_LABELS[currentType] || '不明';
    typeCell.addEventListener('click', () => enableTypeEdit(item.serial, typeCell));
    tdType.appendChild(typeCell);
    tr.appendChild(tdType);

    // 状態レベル
    const tdLevel = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `level-badge level-${hl}`;
    badge.title = item.healthReasons.join('\n');
    badge.innerText = LEVEL_LABELS[hl];
    tdLevel.appendChild(badge);
    tr.appendChild(tdLevel);

    // 残り寿命
    const tdLife = document.createElement('td');
    tdLife.innerText = item.lifePercent >= 0 ? item.lifePercent + '%' : item.lifeOrSector;
    tr.appendChild(tdLife);

    // 総書込量
    const tdTbw = document.createElement('td');
    tdTbw.innerText = item.tbw;
    tr.appendChild(tdTbw);

    // 通電時間 / 電源回数
    const tdHours = document.createElement('td');
    tdHours.innerText = `${item.powerOnHours} / ${item.powerCycleCount}回`;
    tr.appendChild(tdHours);

    // メモ + 消去
    const tdMemo = document.createElement('td');
    tdMemo.style.cssText = 'display:flex; align-items:center; gap:4px;';
    const memoCell = document.createElement('div');
    memoCell.className = 'clickable-cell';
    memoCell.style.flex = '1';
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
    delBtn.className = 'btn-danger';
    delBtn.style.cssText = 'padding:2px 6px; font-size:13px; height:28px; flex-shrink:0;';
    delBtn.innerText = '消去';
    delBtn.addEventListener('click', () => deleteItem(item.serial));
    tdMemo.appendChild(memoCell);
    tdMemo.appendChild(delBtn);
    tr.appendChild(tdMemo);

    // 行クリックで詳細トグル（編集可能セル・ボタンは除外）
    const detailsId = `details-${index}`;
    tr.addEventListener('click', (e) => {
        if (e.target.closest('.clickable-cell, button')) return;
        toggleDetails(detailsId);
    });

    return tr;
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
        ['代替処理', countText(item.reallocSectors)],
        ['保留中', countText(item.pendingSectors)],
        ['CRC', countText(item.crcErrors)],
        ['温度', item.temperature],
        ['最終更新日', item.updatedAt],
        ['プロトコル', item.protocol || '不明'],
        ['デバイスタイプ', item.deviceType || '不明']
    ];
    fields.forEach(([label, value]) => {
        const div = document.createElement('div');
        const strong = document.createElement('strong');
        strong.innerText = label + ': ';
        div.appendChild(strong);
        div.append(value);
        grid.appendChild(div);
    });

    // 判定理由ブロック
    const reasonDiv = document.createElement('div');
    reasonDiv.style.flexBasis = '100%';
    const reasonStrong = document.createElement('strong');
    reasonStrong.innerText = '判定理由:';
    reasonDiv.appendChild(reasonStrong);
    reasonDiv.appendChild(document.createElement('br'));
    const reasonText = item.healthReasons.map(r => '・' + r).join('\n');
    const reasonBody = document.createElement('span');
    reasonBody.style.whiteSpace = 'pre-wrap';
    reasonBody.innerText = reasonText;
    reasonDiv.appendChild(reasonBody);
    grid.appendChild(reasonDiv);

    container.appendChild(grid);

    // 生JSON
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
