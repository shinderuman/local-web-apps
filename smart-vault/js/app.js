const STORAGE_KEY = 'storage_smart_assets';
const rawDb = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let db = Array.isArray(rawDb) ? rawDb : Object.values(rawDb);

let currentFilter = 'all';
let currentSortField = '';
let currentSortOrder = 'asc';
let toastTimeout = null;

window.onload = function() {
    setupPasteEvents();
    renderTable();
};

function saveDb() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// トースト通知を表示する汎用関数
function showToast(message) {
    const toast = document.getElementById('toastNotification');
    toast.innerText = message;
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function setupPasteEvents() {
    const zone = document.getElementById('pasteZone');
    zone.addEventListener('click', () => zone.focus());

    zone.addEventListener('paste', function(e) {
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
}

function toggleAccordion(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('accordionIcon');
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        icon.innerText = '▲';
    } else {
        el.classList.add('hidden');
        icon.innerText = '▼';
    }
}

function copyCommandText(codeElement) {
    const text = codeElement.innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast('コマンドをクリップボードにコピーしました');
    });
}

function detectVendor(data, modelName) {
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
}

function parseSmartJson(rawText, existingRecord = null) {
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
    } else if (data.sata_smart_attributes?.table) {
        const attr241 = data.sata_smart_attributes.table.find(a => a.id === 241);
        if (attr241 && attr241.raw?.value) tbwVal = (Number(attr241.raw.value) / 2) / 1000;
    }

    let lifeOrSector = '不明';
    if (data.endurance_used?.current_percent !== undefined) {
        lifeOrSector = '寿命: ' + (100 - Number(data.endurance_used.current_percent)) + '%';
    } else if (data.nvme_smart_health_information_log?.percentage_used !== undefined) {
        lifeOrSector = '寿命: ' + (100 - Number(data.nvme_smart_health_information_log.percentage_used)) + '%';
    } else if (data.sata_smart_attributes?.table) {
        const attr5 = data.sata_smart_attributes.table.find(a => a.id === 5);
        const attrLife = data.sata_smart_attributes.table.find(a => a.id === 233 || a.id === 202);
        if (attrLife) {
            lifeOrSector = '寿命: ' + attrLife.value + '%';
        } else if (attr5) {
            const count = attr5.raw?.value || 0;
            lifeOrSector = count > 0 ? `<span class="bad-count">代替: ${count}</span>` : '代替: 0';
        }
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

    return {
        id, serial, model, vendor, protocol, deviceType,
        size: sizeStr, size_bytes: sizeBytes, health, powerOnHours: hoursVal === 0 ? '不明' : hoursVal + ' H', hours_val: hoursVal,
        powerCycleCount, temperature: tempVal === 0 ? '不明' : tempVal + ' °C', temp_val: tempVal,
        tbw: tbwVal === 0 ? '--' : tbwVal.toFixed(1) + ' TBW', tbw_val: tbwVal, lifeOrSector,
        updatedAt: new Date().toLocaleString(), memo, customType, raw: rawText
    };
}

function rebuildDatabaseFromRaw() {
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
}

function deleteItem(serial) {
    if (!confirm('このストレージの記録を完全に削除しますか？')) return;
    db = db.filter(item => item.serial !== serial);
    saveDb();
    renderTable();
    showToast('記録を削除しました');
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
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
}

function enableVendorEdit(serial, containerId) {
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
}

function enableTypeEdit(serial, containerId) {
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
}

function enableMemoEdit(serial, containerId) {
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
}

function sortTable(field) {
    if (currentSortField === field) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'asc';
    }
    renderTable();
}

function filterType(type, event) {
    currentFilter = type;
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    renderTable();
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateCounters() {
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
}

function toggleDetails(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function renderTable() {
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
        const indexMap = { 'id':0, 'vendor':1, 'size_bytes':2, 'model':3, 'customType':4, 'health':5, 'tbw_val':7, 'hours_val':8, 'temp_val':9 };
        const thIdx = indexMap[currentSortField];
        if (thIdx !== undefined) ths[thIdx].className = currentSortOrder === 'asc' ? 'sort-asc' : 'sort-desc';
    }

    const typeMap = { 'unknown': '不明', 'nvme': 'NVMe', 'sata-ssd': 'SATA SSD', 'sshd': 'SSHD', 'hdd-25': 'HDD 2.5"', 'hdd-35': 'HDD 3.5"', 'emmc': 'eMMC' };

    let visibleCount = 0;
    displayItems.forEach((item, index) => {
        const currentType = item.customType || 'unknown';
        if (currentFilter !== 'all' && currentFilter !== currentType) return;
        visibleCount++;

        let hClass = 'status-unknown';
        if (item.health === 'PASSED') hClass = 'status-passed';
        if (item.health === 'FAILED') hClass = 'status-failed';

        const detailsId = `details-${index}`;
        const vendorContainerId = `vendor-container-${index}`;
        const typeContainerId = `type-container-${index}`;
        const memoContainerId = `memo-container-${index}`;
        const isUnknown = (currentType === 'unknown');

        const tr = document.createElement('tr');
        tr.className = isUnknown ? 'item-row unknown-type-row' : 'item-row';
        tr.setAttribute('draggable', 'true');
        tr.setAttribute('data-serial', item.serial);
        tr.innerHTML = `
            <td>
                <button class="btn-secondary" style="padding:2px 6px; font-size:13px; height:28px;" onclick="toggleDetails('${detailsId}')">詳細</button>
                <button class="btn-danger" style="padding:2px 6px; font-size:13px; margin-left:2px; height:28px;" onclick="deleteItem('${item.serial}')">消去</button>
            </td>
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
            <td><span class="status-badge ${hClass}">${item.health}</span></td>
            <td>${item.lifeOrSector}</td>
            <td>${item.tbw}</td>
            <td>${item.powerOnHours} / ${item.powerCycleCount}回</td>
            <td>${item.temperature}</td>
            <td>
                <div class="clickable-cell" id="${memoContainerId}" onclick="enableMemoEdit('${item.serial}', '${memoContainerId}')">
                    ${item.memo ? escapeHtml(item.memo) : '<span class="memo-placeholder">クリックして入力</span>'}
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        const trDetail = document.createElement('tr');
        trDetail.className = 'details-row hidden';
        trDetail.id = detailsId;
        trDetail.innerHTML = `
            <td colspan="11">
                <div class="details-container">
                    <div class="details-grid">
                        <div><strong>シリアルナンバー (S/N):</strong> <span style="font-family:monospace; font-weight:bold; background-color:#edf2f7; padding:2px 6px; border-radius:4px;">${item.serial}</span></div>
                        <div><strong>最終更新日:</strong> ${item.updatedAt}</div>
                        <div><strong>プロトコル:</strong> ${item.protocol || '不明'}</div>
                        <div><strong>デバイスタイプ:</strong> ${item.deviceType || '不明'}</div>
                    </div>
                    <div class="raw-json">${item.raw}</div>
                </div>
            </td>
        `;
        tbody.appendChild(trDetail);
    });

    if (visibleCount === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#a0aec0; padding:30px;">該当するディスクがありません。</td></tr>';
    } else {
        setupDragAndDrop();
    }
}

function setupDragAndDrop() {
    const tbody = document.getElementById('storageTbody');
    let dragSrcEl = null;

    tbody.querySelectorAll('.item-row').forEach(row => {
        row.addEventListener('dragstart', function(e) {
            dragSrcEl = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        row.addEventListener('dragover', function(e) {
            e.preventDefault();
            return false;
        });

        row.addEventListener('dragenter', function(e) {
            if (this !== dragSrcEl) {
                this.style.borderTop = '2px solid #3182ce';
            }
        });

        row.addEventListener('dragleave', function(e) {
            this.style.borderTop = '';
        });

        row.addEventListener('drop', function(e) {
            e.stopPropagation();
            this.style.borderTop = '';

            if (dragSrcEl !== this) {
                const srcSerial = dragSrcEl.getAttribute('data-serial');
                const targetSerial = this.getAttribute('data-serial');

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

        row.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            tbody.querySelectorAll('.item-row').forEach(r => r.style.borderTop = '');
        });
    });
}

async function exportBackup() {
    if (db.length === 0) return;
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: `smart_storage_backup_${new Date().toISOString().slice(0,10)}.json`,
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
}
