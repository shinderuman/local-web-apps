let horses = [];
let currentGameYear = 1973;
let sortState = { key: 'order', asc: true };

const masterHorseData = {
    1963: ["スピードシンボリ", "ワカクモ"],
    1964: ["ヒカルタカイ", "ニットエイト", "リュウズキ", "Damascus", "Dr.Fager", "In Reality"],
    1965: ["タケシバオー", "マーチス", "アサカオー", "ダテホーライ", "キタノダイオー", "Sir Ivor", "Dark Mirage", "Vaguely Noble", "Petingo", "ゼダーン"],
    1966: ["メジロアサマ", "トウメイ", "Majestic Prince", "Arts and Letters", "Ack Ack", "Ta Wee", "Cougar", "Habitat", "Gallant Bloom"],
    1968: ["Mill Reef", "My Swallow", "Brigadier Gerard", "Canonero", "ヒカルイマイ", "ナスノカオリ", "カネヒムロ", "ニホンピロムーテー", "ベルワイド"],
    1969: ["Riverman", "Riva Ridge", "Key to the Mint", "Lyphard", "Susan's Girl", "ロングエース", "ランドプリンス", "イシノヒカル", "トクザクラ", "アチーブスター", "ハマノパレード", "ストロングエイト", "タニノチカラ", "タイテエム", "Halo", "Roberto"],
    1970: ["ハイセイコー", "タケホープ", "ニットウチドリ", "ナスノチグサ", "Secretariat", "Forego", "Mr.Prospector", "Allez France", "Dahlia"],
    1971: ["イットー", "キタノカチドキ", "コーネルランサー", "フジノパーシア", "Northern Taste", "Highclere", "Sagaro"],
    1972: ["カブラヤオー", "テスコガビー", "Ruffian", "Foolish Pleasure"],
    1973: ["トウショウボーイ", "テンポイント", "Exceller"],
    1974: ["マルゼンスキー", "Seattle Slew", "Alleged"],
    1975: ["John Henry", "Affirmed", "Alydar"],
    1980: ["ミスターシービー", "ニホンピロウイナー"],
    1981: ["シンボリルドルフ"],
    1983: ["メジロラモーヌ", "Dancing Brave"],
    1984: ["イナリワン", "タマモクロス"],
    1985: ["オグリキャップ", "バンブーメモリー", "ヤエノムテキ", "スーパークリーク"],
    1986: ["Sunday Silence", "Easy Goer"],
    1987: ["イクノディクタス", "アイネスフウジン", "メジロパーマー"],
    1988: ["トウカイテイオー"],
    1989: ["ミホノブルボン", "サクラバクシンオー", "A.P.Indy"],
    1990: ["ビワハヤヒデ", "ナリタタイシン", "ノースフライト", "ホクトベガ", "Cigar"],
    1991: ["ナリタブライアン", "ヒシアマゾン", "サクラローレル"],
    1992: ["マヤノトップガン", "フラワーパーク", "フジキセキ", "Lammtarra"],
    1993: ["エアグルーヴ"],
    1994: ["サイレンススズカ", "タイキシャトル", "メジロドーベル"],
    1995: ["スペシャルウィーク", "グラスワンダー", "エルコンドルパサー", "セイウンスカイ"],
    1996: ["テイエムオペラオー", "アドマイヤベガ", "ナリタトップロード", "メイショウドトウ", "Montjeu", "Dubai Millennium"],
    1997: ["アグネスデジタル"],
    1998: ["クロフネ", "アグネスタキオン", "Galileo"],
    1999: ["デュランダル", "シンボリクリスエス"],
    2000: ["ゼンノロブロイ", "Ghostzapper"],
    2001: ["メジロマックイーン", "メジロライアン", "メジロブライト", "キングカメハメハ", "ハーツクライ"],
    2002: ["ディープインパクト"],
    2004: ["ドリームジャーニー", "ウオッカ", "ダイワスカーレット"],
    2005: ["スマートファルコン"],
    2006: ["ナカヤマフェスタ", "ブエナビスタ"],
    2007: ["カレンチャン", "ルーラーシップ", "アパパネ"],
    2008: ["ロードカナロア", "オルフェーヴル", "Frankel"],
    2009: ["ゴールドシップ", "ホッコータルマエ", "ジェンティルドンナ"],
    2010: ["コパノリッキー", "エピファネイア"],
    2011: ["モーリス"],
    2012: ["キタサンブラック", "サトノクラウン", "ドゥラメンテ", "American Pharoah"],
    2013: ["サトノダイヤモンド", "Arrogate"],
    2014: ["ウインブライト", "Enable", "レイデオロ"],
    2015: ["アーモンドアイ", "Justify", "ゴールデンシックスティ"],
    2016: ["グランアレグリア", "クロノジェネシス"],
    2017: ["デアリングタクト", "コントレイル"],
    2018: ["エフフォーリア", "Baaeed", "Flightline", "ロマンチックウォリアー"],
    2019: ["イクノックス"],
    2020: ["リバティアイランド", "Auguste Rodin", "Ka Ying Rising", "カーインライジング"]
};

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toggleElement(id) {
    const el = document.getElementById(id);
    const isVisible = el.style.display === 'block';
    el.style.display = isVisible ? 'none' : 'block';
    localStorage.setItem(id + '_visible', !isVisible);
}

function saveCheckboxes() {
    const checkboxes = document.querySelectorAll('#scheduleSection input[type="checkbox"]');
    const state = {};
    checkboxes.forEach(cb => {
        state[cb.id] = cb.checked;
    });
    localStorage.setItem('schedule_checkbox_states_v1', JSON.stringify(state));
}

function loadCheckboxes() {
    const saved = localStorage.getItem('schedule_checkbox_states_v1');
    if (!saved) return;
    const state = JSON.parse(saved);
    Object.keys(state).forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = state[id];
    });
}

function updateGameYear(val) {
    currentGameYear = parseInt(val, 10) || 0;
    localStorage.setItem('game_year_v3', currentGameYear);
    render();
    renderFilteredHorseList();
}

function renderFilteredHorseList() {
    const targetContainer = document.getElementById('filteredHorseList');
    targetContainer.innerHTML = "";

    const filterYear = currentGameYear - 1;
    const years = Object.keys(masterHorseData).map(Number).filter(y => y >= filterYear).sort((a, b) => a - b);

    if (years.length === 0) {
        targetContainer.innerHTML = `<div style="color:#666; font-size:14px; padding:10px;">${filterYear}年以降の該当データはありません。</div>`;
        return;
    }

    years.forEach(year => {
        const card = document.createElement('div');
        card.className = 'year-card';

        const title = document.createElement('h4');
        title.textContent = `${year}年`;
        card.appendChild(title);

        const ul = document.createElement('ul');
        masterHorseData[year].forEach(horse => {
            const li = document.createElement('li');
            li.textContent = horse;
            ul.appendChild(li);
        });
        card.appendChild(ul);
        targetContainer.appendChild(card);
    });
}

// JSON形式のインポート（テキストエリア）
function importJSON() {
    const text = document.getElementById('ioTextarea').value.trim();
    if (!text) return;
    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) { alert('データ構造が不正です'); return; }
        horses = parsed;
        saveAndRender();
    } catch (e) {
        alert('JSONのパースに失敗しました');
    }
}

// JSON形式のエクスポート（テキストエリア）
function exportJSON() {
    const exportList = [...horses].sort((a, b) => a.order - b.order);
    document.getElementById('ioTextarea').value = JSON.stringify(exportList, null, 2);
}

async function loadFile() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const file = await handle.getFile();
        const text = await file.text();
        horses = JSON.parse(text);
        saveAndRender();
    } catch (e) {
        if (e.name !== 'AbortError') console.error('ファイルの読み込みに失敗しました', e);
    }
}

async function saveFile() {
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: 'horse-data.json',
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const exportList = [...horses].sort((a, b) => a.order - b.order);
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(exportList, null, 2));
        await writable.close();
    } catch (e) {
        if (e.name !== 'AbortError') console.error('ファイルの保存に失敗しました', e);
    }
}

function loadData() {
    const saved = localStorage.getItem('horse_data_ordered_v7');
    if (saved) horses = JSON.parse(saved);

    const savedYear = localStorage.getItem('game_year_v3');
    if (savedYear) {
        currentGameYear = parseInt(savedYear, 10);
        document.getElementById('currentGameYear').value = currentGameYear;
    }

    ['memoArea', 'csvSection', 'horseListSection', 'scheduleSection'].forEach(id => {
        const visible = localStorage.getItem(id + '_visible') === 'true';
        document.getElementById(id).style.display = visible ? 'block' : 'none';
    });

    render();
    renderFilteredHorseList();
    loadCheckboxes();
}

function saveAndRender() {
    localStorage.setItem('horse_data_ordered_v7', JSON.stringify(horses));
    render();
}

function addData() {
    const name = document.getElementById('newName').value.trim();
    const year = document.getElementById('newYear').value.trim();
    const horseName = document.getElementById('newHorseName').value.trim();
    if (!name) return;
    const maxOrder = horses.length > 0 ? Math.max(...horses.map(h => h.order)) : 0;
    horses.push({
        id: Date.now(),
        order: maxOrder + 1,
        name: name,
        birthYear: year ? parseInt(year, 10) : "",
        horseName: horseName === "" ? "種牡馬" : horseName,
        otherHorseNames: [],
        isRunner: true
    });
    document.getElementById('newName').value = "";
    document.getElementById('newYear').value = "";
    document.getElementById('newHorseName').value = "";
    saveAndRender();
}

function deleteData(id) {
    horses = horses.filter(h => h.id !== id);
    saveAndRender();
}

function startEdit(id, key, element) {
    const horse = horses.find(h => h.id === id);
    if (!horse) return;
    const originalValue = (key === 'otherHorseNames') ? (horse.otherHorseNames || []).join('\n') : horse[key];
    const input = document.createElement(key === 'otherHorseNames' ? 'textarea' : 'input');
    if (key !== 'otherHorseNames') input.type = (key === 'birthYear') ? 'number' : 'text';
    input.value = originalValue;
    input.className = 'edit-input';
    element.onclick = null;
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    const finishEdit = () => {
        const newValue = input.value.trim();
        if (key === 'birthYear') {
            horse[key] = newValue !== "" ? parseInt(newValue, 10) : "";
        } else if (key === 'otherHorseNames') {
            horse.otherHorseNames = newValue ? newValue.split(/\n/).map(s => s.trim()).filter(s => s !== "") : [];
        } else {
            horse[key] = newValue;
        }
        saveAndRender();
    };
    input.onblur = finishEdit;
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && key !== 'otherHorseNames') finishEdit();
        if (e.key === 'Escape') { input.onblur = null; render(); }
    };
}

// 種牡馬かどうかの判定: 10歳以上は強制種牡馬、それ以外は isRunner フラグ
function isStallion(h) {
    const age = (h.birthYear && currentGameYear) ? (currentGameYear - h.birthYear) : null;
    if (age !== null && age >= 10) return true;
    return !h.isRunner;
}

// 現役/種牡馬のトグル（10歳以上は固定でトグル不可）
function toggleRunner(id) {
    const h = horses.find(h => h.id === id);
    if (!h) return;
    const age = (h.birthYear && currentGameYear) ? (currentGameYear - h.birthYear) : null;
    if (age !== null && age >= 10) return;
    h.isRunner = !h.isRunner;
    saveAndRender();
}

function sortData(key) {
    if (sortState.key === key) { sortState.asc = !sortState.asc; } else { sortState.key = key; sortState.asc = true; }
    horses.sort((a, b) => {
        let valA = (a[key] === "" || a[key] === null) ? (sortState.asc ? Infinity : -Infinity) : a[key];
        let valB = (b[key] === "" || b[key] === null) ? (sortState.asc ? Infinity : -Infinity) : b[key];
        if (typeof valA === 'string') return sortState.asc ? valA.localeCompare(valB, 'ja') : valB.localeCompare(valA, 'ja');
        return sortState.asc ? valA - valB : valB - valA;
    });
    render();
}

function render() {
    const tbody = document.getElementById('horseTableBody');
    tbody.innerHTML = "";
    horses.forEach((h) => {
        const age = (h.birthYear && currentGameYear) ? (currentGameYear - h.birthYear) : "-";
        const stallion = isStallion(h);
        const otherText = (h.otherHorseNames || []).join('\n');
        const tr = document.createElement('tr');
        tr.dataset.id = h.id;
        if (!stallion) tr.classList.add('runner-row');
        tr.innerHTML = `
            <td class="handle" draggable="true">≡</td>
            <td style="color: #666; font-weight: bold; text-align: center;">${h.order}</td>
            <td class="name-cell">${escapeHtml(h.name)}</td>
            <td class="age-cell">${age}</td>
            <td class="editable" onclick="startEdit(${h.id}, 'birthYear', this)">${h.birthYear}</td>
            <td class="editable" onclick="startEdit(${h.id}, 'horseName', this)">${escapeHtml(h.horseName)}</td>
            <td class="editable other-cell" onclick="startEdit(${h.id}, 'otherHorseNames', this)">${escapeHtml(otherText).replace(/\n/g, '<br>')}</td>
            <td><button class="delete-btn" onclick="deleteData(${h.id})">削除</button></td>
        `;
        const handle = tr.querySelector('.handle');
        handle.addEventListener('dragstart', handleDragStart);
        tr.addEventListener('dragover', handleDragOver);
        tr.addEventListener('drop', handleDrop);
        handle.addEventListener('dragend', handleDragEnd);
        // 編集セル以外のクリックで現役/種牡馬トグル
        tr.querySelectorAll('td:not(.editable)').forEach(td => {
            if (td.querySelector('button')) return;
            td.style.cursor = 'pointer';
            td.addEventListener('click', () => toggleRunner(h.id));
        });
        tbody.appendChild(tr);
    });
}

let dragSrcRow = null;
function handleDragStart(e) {
    dragSrcRow = this.parentElement;
    dragSrcRow.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(dragSrcRow, 0, 0);
}
function handleDragOver(e) { if (e.preventDefault) e.preventDefault(); return false; }
function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    const targetRow = this;
    if (dragSrcRow !== targetRow) {
        const allRows = [...document.querySelectorAll('#horseTableBody tr')];
        const fromIndex = allRows.indexOf(dragSrcRow);
        const toIndex = allRows.indexOf(targetRow);
        const [movedItem] = horses.splice(fromIndex, 1);
        horses.splice(toIndex, 0, movedItem);
        horses.forEach((h, i) => h.order = i + 1);
        saveAndRender();
    }
    return false;
}
function handleDragEnd() { if (dragSrcRow) dragSrcRow.classList.remove('dragging'); }

window.onload = loadData;
