const STORAGE_KEY = 'storage_smart_assets';
const rawDb = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let db = Array.isArray(rawDb) ? rawDb : Object.values(rawDb);

let currentFilter = 'all';
let currentSortField = '';
let currentSortOrder = 'asc';
let toastTimeout = null;

window.onload = () => {
    setupPasteEvents();
    renderTable();
};

const saveDb = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

// トースト通知を表示する汎用関数
const showToast = (message) => {
    const toast = document.getElementById('toastNotification');
    toast.innerText = message;
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
};

const setupPasteEvents = () => {
    const zone = document.getElementById('pasteZone');
    zone.addEventListener('click', () => zone.focus());

    zone.addEventListener('paste', (e) => {
        e.preventDefault();
        const rawText = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (!rawText) return;

        try {
            const parsedTmp = JSON.parse(rawText);
            const serial = parsedTmp.serial_number || (parsedTmp.device && parsedTmp.device.serial_number) || '';
            if (!serial) { showToast('エラー: S/N不検出'); return; }

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
            showToast('データを解析して登録・更新しました');
        } catch (err) {
            showToast('エラー: パース失敗');
        }
    });
};

const toggleAccordion = (id) => {
    const el = document.getElementById(id);
    const icon = document.getElementById('accordionIcon');
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        icon.innerText = '▲';
    } else {
        el.classList.add('hidden');
        icon.innerText = '▼';
    }
};

const copyCommandText = (codeElement) => {
    const text = codeElement.innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast('コマンドをクリップボードにコピーしました');
    });
};

const detectVendor = (data, modelName) => {
    const vId = data.nvme_pci_vendor?.id;
    if (vId === 4203 || modelName.toUpperCase().includes('APPLE')) return 'Apple';
    if (vId === 5197 || modelName.toUpperCase().includes('SAMSUNG')) return 'Samsung';
    if (vId === 4158 || modelName.toUpperCase().includes('CRUCIAL') || modelName.toUpperCase().includes('MICRON')) return 'Crucial';
    if (vId === 7474 || modelName.toUpperCase().includes('INTEL')) return 'Intel';
    if (modelName.toUpperCase().includes('WDC') || modelName.toUpperCase().includes('WESTERN DIGITAL') || modelName.toUpperCase().includes('WD')) return 'Western Digital';
    if (modelName.toUpperCase().includes('SEAGATE') || modelName.toUpperCase().includes('ST')) return 'Seagate';
    if (modelName.toUpperCase().includes('TOSHIBA')) return 'Toshiba';
    if (modelName.toUpperCase().includes('KIOXIA')) return 'Kioxia';
    if (modelName.toUpperCase().includes('SANDISK')) return 'SanDisk';
    if (modelName.toUpperCase().includes('KINGSTON')) return 'Kingston';

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

    if (health === 'FAILED') return { level: 3, reasons: ['S.M.A.R.T. 総合判定 = FAILED'] };

    const ataTable = data.ata_smart_attributes?.table || [];
    const nvmeLog = data.nvme_smart_health_information_log;
    const errSummary = data.ata_smart_error_log?.summary;
    const errCount = Number(errSummary?.count) || 0;
    const errDescs = (errSummary?.table || []).map(e => (e.error_description || '').toUpperCase()).join(' ');
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
            if (unit === 'G' || unit === 'Z') { sizeStr = num + ' GB'; sizeBytes = num * 1000 * 1000 * 1000; }
            if (unit === 'T') { sizeStr = num + ' TB'; sizeBytes = num * 1000 * 1000 * 1000 * 1000; }
        }
    }

    let health = 'UNKNOWN';
    if (data.smart_status?.passed !== undefined) {
        health = data.smart_status.passed ? 'PASSED' : 'FAILED';
    }

    let hoursVal = 0;
    if (data.power_on_time?.hours !== undefined) hoursVal = Number(data.power_on_time.hours);
    else if (data.nvme_smart_health_information_log?.power_on_hours !== undefined) hoursVal = Number(data.nvme_smart_health_information_log.power_on_hours);

    let powerCycleCount = '不明';
    if (data.power_cycle_count !== undefined) powerCycleCount = Number(data.power_cycle_count);
    else if (data.nvme_smart_health_information_log?.power_cycles !== undefined) powerCycleCount = Number(data.nvme_smart_health_information_log.power_cycles);

    let tempVal = 0;
    if (data.temperature?.current !== undefined) tempVal = Number(data.temperature.current);
    else if (data.nvme_smart_health_information_log?.temperature !== undefined) tempVal = Number(data.nvme_smart_health_information_log.temperature);

    let tbwVal = 0;
    if (data.nvme_smart_health_information_log?.data_units_written !== undefined) {
        tbwVal = (Number(data.nvme_smart_health_information_log.data_units_written) * 512000) / (1000 * 1000 * 1000 * 1000);
    } else if (data.ata_smart_attributes?.table) {
        const attr241 = data.ata_smart_attributes.table.find(a => a.id === 241);
        if (attr241 && attr241.raw?.value) tbwVal = (Number(attr241.raw.value) / 2) / 1000;
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
        id, serial, model, vendor, protocol, deviceType,
        size: sizeStr, size_bytes: sizeBytes, health, powerOnHours: hoursVal === 0 ? '不明' : hoursVal + ' H', hours_val: hoursVal,
        powerCycleCount, temperature: tempVal === 0 ? '不明' : tempVal + ' °C', temp_val: tempVal,
        tbw: tbwVal === 0 ? '--' : tbwVal.toFixed(1) + ' TBW', tbw_val: tbwVal, lifeOrSector, lifePercent,
        reallocSectors, pendingSectors, crcErrors, healthLevel, healthReasons,
        updatedAt: new Date().toLocaleString(), memo, customType, raw: rawText
    };
};

const rebuildDatabaseFromRaw = () => {
    if (db.length === 0) return;
    if (!confirm('蓄積された生JSONデータから台帳を再構築します。\n手動入力した項目（分類・メーカー・メモ）はそのまま維持されます。実行しますか？')) return;

    db = db.map(oldRecord => {
        if (oldRecord.raw) {
            try {
                return parseSmartJson(oldRecord.raw, oldRecord);
            } catch (e) {
                return oldRecord;
            }
        }
        return oldRecord;
    });

    saveDb();
    renderTable();
    showToast('データベースを再構築しました');
};

const deleteItem = (serial) => {
    if (!confirm('このストレージの記録を完全に削除しますか？')) return;
    db = db.filter(item => item.serial !== serial);
    saveDb();
    renderTable();
    showToast('記録を削除しました');
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
            showToast('バックアップからデータを復元しました');
        } catch (err) {
            showToast('エラー: 不正なファイル構造です');
        }
        document.getElementById('fileInput').value = '';
    };
    reader.readAsText(file);
};

const enableVendorEdit = (serial, containerId) => {
    const container = document.getElementById(containerId);
    const idx = db.findIndex(item => item.serial === serial);
    if (idx === -1) return;

    const currentVendor = db[idx].vendor || '不明';
    const coreVendors = ['Apple', 'Samsung', 'Crucial', 'Intel', 'Western Digital', 'Seagate', 'Toshiba', 'Kioxia', 'SanDisk', 'Kingston'];
    const isCustom = !coreVendors.includes(currentVendor) && currentVendor !== '不明';

    let html = `<select class="select-inline-input" id="select-${containerId}">`;
    html += `<option value="不明" ${currentVendor === '不明' ? 'selected' : ''}>不明</option>`;
    coreVendors.forEach(v => {
        html += `<option value="${v}" ${currentVendor === v ? 'selected' : ''}>${v}</option>`;
    });
    if (isCustom) {
        html += `<option value="${escapeHtml(currentVendor)}" selected>${escapeHtml(currentVendor)}</option>`;
    }
    html += '<option value="custom_input">+ 新規直接自由入力...</option></select>';

    container.removeAttribute('onclick');
    container.innerHTML = html;
    const select = document.getElementById(`select-${containerId}`);
    select.focus();

    const commitVendor = (val) => {
        if (val === 'custom_input') {
            const userInput = prompt('メーカー名を手動自由入力してください:', isCustom ? currentVendor : '');
            val = (userInput && userInput.trim()) ? userInput.trim() : currentVendor;
        }
        db[idx].vendor = val;
        saveDb();
        container.setAttribute('onclick', `enableVendorEdit('${serial}', '${containerId}')`);
        container.innerHTML = escapeHtml(val);
    };

    select.onchange = () => commitVendor(select.value);
    select.onblur = () => commitVendor(select.value);
};

const enableTypeEdit = (serial, containerId) => {
    const container = document.getElementById(containerId);
    const idx = db.findIndex(item => item.serial === serial);
    if (idx === -1) return;

    const currentType = db[idx].customType || 'unknown';
    const typeMap = { 'unknown': '不明', 'nvme': 'NVMe', 'sata-ssd': 'SATA SSD', 'sshd': 'SSHD', 'hdd-25': 'HDD 2.5"', 'hdd-35': 'HDD 3.5"', 'emmc': 'eMMC' };

    let html = `<select class="select-inline-input" id="select-${containerId}">`;
    for (const key in typeMap) {
        html += `<option value="${key}" ${currentType === key ? 'selected' : ''}>${typeMap[key]}</option>`;
    }
    html += '</select>';

    container.removeAttribute('onclick');
    container.innerHTML = html;
    const select = document.getElementById(`select-${containerId}`);
    select.focus();

    const commitType = (val) => {
        db[idx].customType = val;
        saveDb();
        container.setAttribute('onclick', `enableTypeEdit('${serial}', '${containerId}')`);
        renderTable();
    };

    select.onchange = () => commitType(select.value);
    select.onblur = () => commitType(select.value);
};

const enableMemoEdit = (serial, containerId) => {
    const container = document.getElementById(containerId);
    const idx = db.findIndex(item => item.serial === serial);
    if (idx === -1) return;

    const currentText = db[idx].memo || '';
    container.removeAttribute('onclick');
    container.innerHTML = `<input type="text" class="memo-edit-input select-inline-input" id="input-${containerId}" value="${escapeHtml(currentText)}">`;

    const input = document.getElementById(`input-${containerId}`);
    input.focus();

    const saveBlur = () => {
        const newText = input.value.trim();
        db[idx].memo = newText;
        saveDb();
        container.setAttribute('onclick', `enableMemoEdit('${serial}', '${containerId}')`);
        container.innerHTML = newText ? escapeHtml(newText) : '<span class="memo-placeholder">クリックして入力</span>';
    };

    input.onblur = saveBlur;
    input.onkeydown = (e) => { if (e.key === 'Enter') saveBlur(); };
};

const sortTable = (field) => {
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'asc';
    }
    renderTable();
};

const filterType = (type, event) => {
    currentFilter = type;
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    renderTable();
};

const escapeHtml = (str) => {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

const updateCounters = () => {
    const counts = { 'all': 0, 'nvme': 0, 'sata-ssd': 0, 'sshd': 0, 'hdd-25': 0, 'hdd-35': 0, 'emmc': 0, 'unknown': 0 };
    db.forEach(item => {
        counts['all']++;
        const type = item.customType || 'unknown';
        if (counts[type] !== undefined) counts[type]++;
    });
    for (const key in counts) {
        const el = document.getElementById(`count-${key}`);
        if (el) el.innerText = counts[key];
    }
};

const toggleDetails = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
};

const renderTable = () => {
    const tbody = document.getElementById('storageTbody');
    tbody.innerHTML = '';
    updateCounters();

    const displayItems = [...db];
    if (currentSortField) {
        displayItems.sort((a, b) => {
            const vA = a[currentSortField];
            const vB = b[currentSortField];

            if (typeof vA === 'number' && typeof vB === 'number') {
                return currentSortOrder === 'asc' ? vA - vB : vB - vA;
            } else {
                const strA = String(vA || '');
                const strB = String(vB || '');
                return currentSortOrder === 'asc' ? strA.localeCompare(strB, 'ja') : strB.localeCompare(strA, 'ja');
            }
        });
    }

    const ths = document.querySelectorAll('th');
    ths.forEach(th => th.className = '');
    if (currentSortField) {
        const indexMap = { 'vendor':0, 'size_bytes':1, 'model':2, 'customType':3, 'healthLevel':4, 'lifePercent':5, 'tbw_val':6, 'hours_val':7 };
        const thIdx = indexMap[currentSortField];
        if (thIdx !== undefined) ths[thIdx].className = currentSortOrder === 'asc' ? 'sort-asc' : 'sort-desc';
    }

    const typeMap = { 'unknown': '不明', 'nvme': 'NVMe', 'sata-ssd': 'SATA SSD', 'sshd': 'SSHD', 'hdd-25': 'HDD 2.5"', 'hdd-35': 'HDD 3.5"', 'emmc': 'eMMC' };

    let visibleCount = 0;
    displayItems.forEach((item, index) => {
        const currentType = item.customType || 'unknown';
        if (currentFilter !== 'all' && currentFilter !== currentType) return;
        visibleCount++;

        const detailsId = `details-${index}`;
        const vendorContainerId = `vendor-container-${index}`;
        const typeContainerId = `type-container-${index}`;
        const memoContainerId = `memo-container-${index}`;
        const isUnknown = (currentType === 'unknown');

        const levelLabels = ['L0 正常', 'L1 注意', 'L2 警告', 'L3 危険'];
        const hl = item.healthLevel ?? 0;

        const tr = document.createElement('tr');
        tr.className = isUnknown ? 'item-row unknown-type-row' : 'item-row';
        tr.setAttribute('draggable', 'true');
        tr.setAttribute('data-serial', item.serial);
        tr.innerHTML = `
            <td>
                <div class="clickable-cell" id="${vendorContainerId}" onclick="enableVendorEdit('${item.serial}', '${vendorContainerId}')">
                    ${escapeHtml(item.vendor || '不明')}
                </div>
            </td>
            <td style="font-weight:bold; color:#2b6cb0; font-size:16px;">${item.size}</td>
            <td style="font-weight:500;">${item.model}</td>
            <td>
                <div class="clickable-cell" id="${typeContainerId}" onclick="enableTypeEdit('${item.serial}', '${typeContainerId}')">
                    ${typeMap[currentType] || '不明'}
                </div>
            </td>
            <td><span class="level-badge level-${hl}" title="${escapeHtml(item.healthReasons.join('&#10;'))}">${levelLabels[hl]}</span></td>
            <td>${item.lifePercent >= 0 ? item.lifePercent + '%' : item.lifeOrSector}</td>
            <td>${item.tbw}</td>
            <td>${item.powerOnHours} / ${item.powerCycleCount}回</td>
            <td style="display:flex; align-items:center; gap:4px;">
                <div class="clickable-cell" id="${memoContainerId}" onclick="enableMemoEdit('${item.serial}', '${memoContainerId}')" style="flex:1;">
                    ${item.memo ? escapeHtml(item.memo) : '<span class="memo-placeholder">クリックして入力</span>'}
                </div>
                <button class="btn-danger" style="padding:2px 6px; font-size:13px; height:28px; flex-shrink:0;" onclick="deleteItem('${item.serial}')">消去</button>
            </td>
        `;
        tr.addEventListener('click', (e) => {
            if (e.target.closest('.clickable-cell, button')) return;
            toggleDetails(detailsId);
        });
        tbody.appendChild(tr);

        const trDetail = document.createElement('tr');
        trDetail.className = 'details-row hidden';
        trDetail.id = detailsId;
        trDetail.innerHTML = `
            <td colspan="9">
                <div class="details-container">
                    <div class="details-grid">
                        <div><strong>モデル名:</strong> ${item.model}</div>
                        <div><strong>シリアルナンバー (S/N):</strong> <span style="font-family:monospace; font-weight:bold; background-color:#edf2f7; padding:2px 6px; border-radius:4px;">${item.serial}</span></div>
                        <div><strong>残り寿命:</strong> ${item.lifeOrSector}</div>
                        <div><strong>代替処理:</strong> ${item.reallocSectors >= 0 ? item.reallocSectors : '-'}</div>
                        <div><strong>保留中:</strong> ${item.pendingSectors >= 0 ? item.pendingSectors : '-'}</div>
                        <div><strong>CRC:</strong> ${item.crcErrors >= 0 ? item.crcErrors : '-'}</div>
                        <div><strong>温度:</strong> ${item.temperature}</div>
                        <div><strong>最終更新日:</strong> ${item.updatedAt}</div>
                        <div><strong>プロトコル:</strong> ${item.protocol || '不明'}</div>
                        <div><strong>デバイスタイプ:</strong> ${item.deviceType || '不明'}</div>
                        <div style="flex-basis:100%;"><strong>判定理由:</strong><br>${item.healthReasons.map(r => '・' + escapeHtml(r)).join('<br>')}</div>
                    </div>
                    <div class="raw-json">${item.raw}</div>
                </div>
            </td>
        `;
        tbody.appendChild(trDetail);
    });

    if (visibleCount === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#a0aec0; padding:30px;">該当するディスクがありません。</td></tr>';
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
            return false;
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

            if (dragSrcEl !== e.currentTarget) {
                const srcSerial = dragSrcEl.getAttribute('data-serial');
                const targetSerial = e.currentTarget.getAttribute('data-serial');

                const srcIdx = db.findIndex(item => item.serial === srcSerial);
                const targetIdx = db.findIndex(item => item.serial === targetSerial);

                if (srcIdx !== -1 && targetIdx !== -1) {
                    const [removed] = db.splice(srcIdx, 1);
                    db.splice(targetIdx, 0, removed);
                    saveDb();
                    currentSortField = '';
                    renderTable();
                }
            }
            return false;
        });

        row.addEventListener('dragend', (e) => {
            e.currentTarget.classList.remove('dragging');
            tbody.querySelectorAll('.item-row').forEach(r => r.style.borderTop = '');
        });
    });
};

const exportBackup = async () => {
    if (db.length === 0) return;
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: 'smart_storage_backup.json',
            types: [{
                description: 'JSON File',
                accept: { 'application/json': ['.json'] }
            }]
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(db, null, 2));
        await writable.close();
        showToast('ファイルを保存しました');
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('ファイルの保存に失敗しました', e);
            showToast('エラー: 保存に失敗しました');
        }
    }
};

// onclick属性・innerHTML文字列からグローバル参照される関数をwindowに公開
window.toggleAccordion = toggleAccordion;
window.copyCommandText = copyCommandText;
window.rebuildDatabaseFromRaw = rebuildDatabaseFromRaw;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.sortTable = sortTable;
window.filterType = filterType;
window.toggleDetails = toggleDetails;
window.deleteItem = deleteItem;
window.enableVendorEdit = enableVendorEdit;
window.enableTypeEdit = enableTypeEdit;
window.enableMemoEdit = enableMemoEdit;
