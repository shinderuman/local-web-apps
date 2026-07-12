// ============================================================
// 定数
// ============================================================

// localStorage の保存キー
const STORAGE_KEYS = {
    HORSES: 'horse_data_ordered_v7',
    GAME_YEAR: 'game_year_v3',
    SCHEDULE: 'schedule_checkbox_states_v1'
};

// section表示状態の保存キー接尾辞（{sectionId}_visible）
const VISIBLE_SUFFIX = '_visible';

// ソート状態
const sortState = {
    key: 'order',
    asc: true
};

// 年代別の史実馬マスターデータ（生年: [馬名...])
const masterHorseData = {
    1963: ['スピードシンボリ', 'ワカクモ'],
    1964: ['ヒカルタカイ', 'ニットエイト', 'リュウズキ', 'Damascus', 'Dr.Fager', 'In Reality'],
    1965: ['タケシバオー', 'マーチス', 'アサカオー', 'ダテホーライ', 'キタノダイオー', 'Sir Ivor', 'Dark Mirage', 'Vaguely Noble', 'Petingo', 'ゼダーン'],
    1966: ['メジロアサマ', 'トウメイ', 'Majestic Prince', 'Arts and Letters', 'Ack Ack', 'Ta Wee', 'Cougar', 'Habitat', 'Gallant Bloom'],
    1968: ['Mill Reef', 'My Swallow', 'Brigadier Gerard', 'Canonero', 'ヒカルイマイ', 'ナスノカオリ', 'カネヒムロ', 'ニホンピロムーテー', 'ベルワイド'],
    1969: ['Riverman', 'Riva Ridge', 'Key to the Mint', 'Lyphard', 'Susan\'s Girl', 'ロングエース', 'ランドプリンス', 'イシノヒカル', 'トクザクラ', 'アチーブスター', 'ハマノパレード', 'ストロングエイト', 'タニノチカラ', 'タイテエム', 'Halo', 'Roberto'],
    1970: ['ハイセイコー', 'タケホープ', 'ニットウチドリ', 'ナスノチグサ', 'Secretariat', 'Forego', 'Mr.Prospector', 'Allez France', 'Dahlia'],
    1971: ['イットー', 'キタノカチドキ', 'コーネルランサー', 'フジノパーシア', 'Northern Taste', 'Highclere', 'Sagaro'],
    1972: ['カブラヤオー', 'テスコガビー', 'Ruffian', 'Foolish Pleasure'],
    1973: ['トウショウボーイ', 'テンポイント', 'Exceller'],
    1974: ['マルゼンスキー', 'Seattle Slew', 'Alleged'],
    1975: ['John Henry', 'Affirmed', 'Alydar'],
    1980: ['ミスターシービー', 'ニホンピロウイナー'],
    1981: ['シンボリルドルフ'],
    1983: ['メジロラモーヌ', 'Dancing Brave'],
    1984: ['イナリワン', 'タマモクロス'],
    1985: ['オグリキャップ', 'バンブーメモリー', 'ヤエノムテキ', 'スーパークリーク'],
    1986: ['Sunday Silence', 'Easy Goer'],
    1987: ['イクノディクタス', 'アイネスフウジン', 'メジロパーマー'],
    1988: ['トウカイテイオー'],
    1989: ['ミホノブルボン', 'サクラバクシンオー', 'A.P.Indy'],
    1990: ['ビワハヤヒデ', 'ナリタタイシン', 'ノースフライト', 'ホクトベガ', 'Cigar'],
    1991: ['ナリタブライアン', 'ヒシアマゾン', 'サクラローレル'],
    1992: ['マヤノトップガン', 'フラワーパーク', 'フジキセキ', 'Lammtarra'],
    1993: ['エアグルーヴ'],
    1994: ['サイレンススズカ', 'タイキシャトル', 'メジロドーベル'],
    1995: ['スペシャルウィーク', 'グラスワンダー', 'エルコンドルパサー', 'セイウンスカイ'],
    1996: ['テイエムオペラオー', 'アドマイヤベガ', 'ナリタトップロード', 'メイショウドトウ', 'Montjeu', 'Dubai Millennium'],
    1997: ['アグネスデジタル'],
    1998: ['クロフネ', 'アグネスタキオン', 'Galileo'],
    1999: ['デュランダル', 'シンボリクリスエス'],
    2000: ['ゼンノロブロイ', 'Ghostzapper'],
    2001: ['メジロマックイーン', 'メジロライアン', 'メジロブライト', 'キングカメハメハ', 'ハーツクライ'],
    2002: ['ディープインパクト'],
    2004: ['ドリームジャーニー', 'ウオッカ', 'ダイワスカーレット'],
    2005: ['スマートファルコン'],
    2006: ['ナカヤマフェスタ', 'ブエナビスタ'],
    2007: ['カレンチャン', 'ルーラーシップ', 'アパパネ'],
    2008: ['ロードカナロア', 'オルフェーヴル', 'Frankel'],
    2009: ['ゴールドシップ', 'ホッコータルマエ', 'ジェンティルドンナ'],
    2010: ['コパノリッキー', 'エピファネイア'],
    2011: ['モーリス'],
    2012: ['キタサンブラック', 'サトノクラウン', 'ドゥラメンテ', 'American Pharoah'],
    2013: ['サトノダイヤモンド', 'Arrogate'],
    2014: ['ウインブライト', 'Enable', 'レイデオロ'],
    2015: ['アーモンドアイ', 'Justify', 'ゴールデンシックスティ'],
    2016: ['グランアレグリア', 'クロノジェネシス'],
    2017: ['デアリングタクト', 'コントレイル'],
    2018: ['エフフォーリア', 'Baaeed', 'Flightline', 'ロマンチックウォリアー'],
    2019: ['イクノックス'],
    2020: ['リバティアイランド', 'Auguste Rodin', 'Ka Ying Rising', 'カーインライジング']
};

// ============================================================
// 状態変数（ミュータブル）
// ============================================================

let horses = [];               // 系統データ本体
let currentGameYear = 1968;    // ゲーム内現在年
let sortableInstance = null;

// ============================================================
// モジュール関数のインポート
// ============================================================

const {
    STALLION_AGE_THRESHOLD,
    isStallion,
    calcAge,
    parseEditValue,
    getEditOriginalValue
} = window.HORSE_LOGIC;
const { createDragHandleCell, createOrderCell, createNameCell, createAgeCell, createEditableCell, createDeleteCell, attachRowEvents } = window.DOM_HELPERS;

// ============================================================
// 初期化
// ============================================================

// エントリポイント: データ読込とイベント登録を行う
const init = () => {
    initSortable();
    loadData();
    initEvents();
};

// 保存データ・ゲーム内年・section表示状態を復元し描画
const loadData = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.HORSES);
    if (saved) horses = JSON.parse(saved);

    const savedYear = localStorage.getItem(STORAGE_KEYS.GAME_YEAR);
    if (savedYear) {
        currentGameYear = parseInt(savedYear, 10);
        document.getElementById('currentGameYear').value = currentGameYear;
    }

    ['memoArea', 'horseListSection', 'scheduleSection'].forEach(id => {
        const visible = localStorage.getItem(id + VISIBLE_SUFFIX) === 'true';
        document.getElementById(id).style.display = visible ? 'block' : 'none';
    });

    render();
    renderFilteredHorseList();
    loadCheckboxes();
};

// 静的HTML要素のイベントを登録（インラインonclick廃止に伴う集約登録）
const initEvents = () => {
    registerToggleButtons();
    registerGameYearInput();
    registerScheduleCheckboxes();
    registerIoButtons();
    registerAddButton();
    registerSortHeader();
};

// トグルボタン: data-target のsection表示を切替
const registerToggleButtons = () => {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleElement(btn.dataset.target));
    });
};

// ゲーム内年入力: 変更でリスト再描画
const registerGameYearInput = () => {
    document.getElementById('currentGameYear').addEventListener('input', (e) => updateGameYear(e.target.value));
};

// スケジュールのcheckbox: 変更を委譲で一括保存
const registerScheduleCheckboxes = () => {
    document.getElementById('scheduleSection').addEventListener('change', saveCheckboxes);
};

// ファイル読込/保存の2ボタン
const registerIoButtons = () => {
    document.getElementById('loadFileBtn').addEventListener('click', loadFile);
    document.getElementById('saveFileBtn').addEventListener('click', saveFile);
};

// 追加ボタン
const registerAddButton = () => {
    document.getElementById('addBtn').addEventListener('click', addData);
};

// テーブルヘッダ: data-sort の列でソート
const registerSortHeader = () => {
    document.querySelector('#horseTable thead').addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort]');
        if (!th) return;
        sortData(th.dataset.sort);
    });
};

// ============================================================
// セクション表示切替
// ============================================================

// 指定sectionの表示/非表示を切替し状態を保存
const toggleElement = (id) => {
    const el = document.getElementById(id);
    const isVisible = el.style.display === 'block';
    el.style.display = isVisible ? 'none' : 'block';
    localStorage.setItem(id + VISIBLE_SUFFIX, !isVisible);
};

// ============================================================
// データ操作
// ============================================================

// データを保存して再描画
const saveAndRender = () => {
    localStorage.setItem(STORAGE_KEYS.HORSES, JSON.stringify(horses));
    render();
};

// 新規系統を追加
const addData = () => {
    const name = document.getElementById('newName').value.trim();
    const year = document.getElementById('newYear').value.trim();
    const horseName = document.getElementById('newHorseName').value.trim();
    if (!name) return;
    const maxOrder = horses.length > 0 ? Math.max(...horses.map(h => h.order)) : 0;
    horses.push({
        id: Date.now(),
        order: maxOrder + 1,
        name: name,
        birthYear: year ? parseInt(year, 10) : '',
        horseName: horseName === '' ? '種牡馬' : horseName,
        otherHorseNames: [],
        isRunner: true
    });
    document.getElementById('newName').value = '';
    document.getElementById('newYear').value = '';
    document.getElementById('newHorseName').value = '';
    saveAndRender();
};

// 指定IDの系統を削除
const deleteData = (id) => {
    horses = horses.filter(h => h.id !== id);
    saveAndRender();
};

// 指定キーでソート（同キー再クリックで昇降切替）
const sortData = (key) => {
    if (sortState.key === key) {
        sortState.asc = !sortState.asc;
    } else {
        sortState.key = key;
        sortState.asc = true;
    }
    horses.sort((a, b) => {
        const valA = (a[key] === '' || a[key] === null) ? (sortState.asc ? Infinity : -Infinity) : a[key];
        const valB = (b[key] === '' || b[key] === null) ? (sortState.asc ? Infinity : -Infinity) : b[key];
        if (typeof valA === 'string') {
            return sortState.asc ? valA.localeCompare(valB, 'ja') : valB.localeCompare(valA, 'ja');
        }
        return sortState.asc ? valA - valB : valB - valA;
    });
    updateDragEnabled();
    render();
};

// 現役/種牡馬のトグル（閾値以上は固定でトグル不可）
const toggleRunner = (id) => {
    const h = horses.find(h => h.id === id);
    if (!h) return;
    const age = calcAge(h, currentGameYear);
    if (age !== null && age >= STALLION_AGE_THRESHOLD) return;
    h.isRunner = !h.isRunner;
    saveAndRender();
};

// ゲーム内年を更新して関連表示を再描画
const updateGameYear = (val) => {
    currentGameYear = parseInt(val, 10) || 0;
    localStorage.setItem(STORAGE_KEYS.GAME_YEAR, currentGameYear);
    render();
    renderFilteredHorseList();
};

// ============================================================
// 編集
// ============================================================

// セルをクリックしてインライン編集を開始
const startEdit = (id, key, element) => {
    const horse = horses.find(h => h.id === id);
    if (!horse) return;
    if (element.querySelector('input, textarea')) return;
    const input = document.createElement(key === 'otherHorseNames' ? 'textarea' : 'input');
    if (key !== 'otherHorseNames') {
        input.type = (key === 'birthYear') ? 'number' : 'text';
    }
    input.value = getEditOriginalValue(horse, key);
    input.className = 'edit-input';
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    const finishEdit = () => {
        horse[key] = parseEditValue(key, input.value.trim());
        saveAndRender();
    };
    input.onblur = finishEdit;
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && key !== 'otherHorseNames') finishEdit();
        if (e.key === 'Escape') {
            input.onblur = null;
            render();
        }
    };
};

// ============================================================
// レンダリング
// ============================================================

// テーブル本体を描画
const render = () => {
    const tbody = document.getElementById('horseTableBody');
    tbody.innerHTML = '';
    horses.forEach((h) => {
        const age = calcAge(h, currentGameYear) ?? '-';
        const stallion = isStallion(h, currentGameYear);
        const otherText = (h.otherHorseNames || []).join('\n');
        const tr = document.createElement('tr');
        tr.dataset.id = h.id;
        if (!stallion) tr.classList.add('runner-row');
        tr.appendChild(createDragHandleCell());
        tr.appendChild(createOrderCell(h.order));
        tr.appendChild(createNameCell(h.name));
        tr.appendChild(createAgeCell(age));
        tr.appendChild(createEditableCell(h.id, 'birthYear', h.birthYear, startEdit));
        tr.appendChild(createEditableCell(h.id, 'horseName', h.horseName, startEdit));
        tr.appendChild(createEditableCell(h.id, 'otherHorseNames', otherText, startEdit));
        tr.appendChild(createDeleteCell(h.id, deleteData));
        attachRowEvents(tr, h.id, toggleRunner);
        tbody.appendChild(tr);
    });
};

// 年代別馬リストを描画（ゲーム内年-1以降の史実馬）
const renderFilteredHorseList = () => {
    const targetContainer = document.getElementById('filteredHorseList');
    targetContainer.innerHTML = '';

    const filterYear = currentGameYear - 1;
    const years = Object.keys(masterHorseData).map(Number).filter(y => y >= filterYear).sort((a, b) => a - b);

    if (years.length === 0) {
        const msg = document.createElement('div');
        msg.style.color = '#666';
        msg.style.fontSize = '14px';
        msg.style.padding = '10px';
        msg.textContent = `${filterYear}年以降の該当データはありません。`;
        targetContainer.appendChild(msg);
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
};

// ============================================================
// チェックボックス状態の保存・復元
// ============================================================

// スケジュールの全checkbox状態を保存
const saveCheckboxes = () => {
    const checkboxes = document.querySelectorAll('#scheduleSection input[type="checkbox"]');
    const state = {};
    checkboxes.forEach(cb => {
        state[cb.id] = cb.checked;
    });
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(state));
};

// 保存済みのcheckbox状態を復元
const loadCheckboxes = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
    if (!saved) return;
    const state = JSON.parse(saved);
    Object.keys(state).forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = state[id];
    });
};

// ============================================================
// ファイル入出力
// ============================================================

// ファイルからJSONを読込
const loadFile = async () => {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            alert('JSONのパースに失敗しました');
            return;
        }
        if (!Array.isArray(parsed) || !parsed.every(h => h && typeof h.id !== 'undefined' && typeof h.name !== 'undefined')) {
            alert('データ構造が不正です（id, name が必須です）');
            return;
        }
        if (!confirm('復元を実行しますか？\n既存のデータはすべて置き換えられます。')) return;
        horses = parsed;
        saveAndRender();
    } catch (e) {
        if (e.name !== 'AbortError') console.error('ファイルの読み込みに失敗しました', e);
    }
};

// ファイルにJSONを保存
const saveFile = async () => {
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: 'horse-data.json',
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const exportList = [...horses].sort((a, b) => a.order - b.order);
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(exportList, null, 2));
        await writable.close();
    } catch (e) {
        if (e.name !== 'AbortError') console.error('ファイルの保存に失敗しました', e);
    }
};

// ============================================================
// ドラッグ＆ドロップ並び替え（SortableJS）
// ============================================================

// ソート中はD&Dを無効化（order昇順＝手動順のときのみ許可）
const isManualOrder = () => {
    return sortState.key === 'order' && sortState.asc;
};

const updateDragEnabled = () => {
    if (sortableInstance) {
        sortableInstance.option('disabled', !isManualOrder());
    }
};

// tbodyをSortable化。≡ハンドルでのみドラッグ開始
const initSortable = () => {
    const tbody = document.getElementById('horseTableBody');
    sortableInstance = Sortable.create(tbody, {
        handle: '.handle',
        animation: 150,
        disabled: !isManualOrder(),
        onEnd: (evt) => {
            const [moved] = horses.splice(evt.oldIndex, 1);
            horses.splice(evt.newIndex, 0, moved);
            horses.forEach((h, i) => h.order = i + 1);
            saveAndRender();
        }
    });
};

// ============================================================
// エントリポイント
// ============================================================

init();
