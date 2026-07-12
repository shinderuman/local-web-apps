// ============================================================
// 定数
// ============================================================

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
// 状態・モジュールのインポート
// ============================================================

const wpState = window.WP_STATE;
const {
    loadHorses, saveHorses, loadGameYear, saveGameYear,
    loadSectionVisible, saveSectionVisible
} = window.WP_DB;
const { render, renderFilteredHorseList, saveCheckboxes, loadCheckboxes } = window.WP_VIEW;
const {
    STALLION_AGE_THRESHOLD, calcAge, parseEditValue, getEditOriginalValue
} = window.HORSE_LOGIC;

// 描画に渡す固定ハンドラ群
const viewHandlers = {
    onStartEdit: null,
    onDeleteData: null,
    onToggleRunner: null
};

// ============================================================
// 描画のオーケストレーション
// ============================================================

// 現状の horses/年 でテーブルを再描画
const refreshTable = () => {
    render(wpState.horses, wpState.currentGameYear, viewHandlers);
};

// ============================================================
// セクション表示切替
// ============================================================

// 指定sectionの表示/非表示を切替し状態を保存
const toggleElement = (id) => {
    const el = document.getElementById(id);
    const isVisible = el.style.display === 'block';
    el.style.display = isVisible ? 'none' : 'block';
    saveSectionVisible(id, !isVisible);
};

// ============================================================
// データ操作
// ============================================================

// データを保存して再描画
const saveAndRender = () => {
    saveHorses(wpState.horses);
    refreshTable();
};

// 新規系統を追加
const addData = () => {
    const name = document.getElementById('newName').value.trim();
    const year = document.getElementById('newYear').value.trim();
    const horseName = document.getElementById('newHorseName').value.trim();
    if (!name) return;
    const horses = wpState.horses;
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
    wpState.horses = wpState.horses.filter(h => h.id !== id);
    saveAndRender();
};

// 指定キーでソート（同キー再クリックで昇降切替）
const sortData = (key) => {
    const sortState = wpState.sortState;
    if (sortState.key === key) {
        sortState.asc = !sortState.asc;
    } else {
        sortState.key = key;
        sortState.asc = true;
    }
    const horses = wpState.horses;
    horses.sort((a, b) => {
        const valA = (a[key] === '' || a[key] === null) ? (sortState.asc ? Infinity : -Infinity) : a[key];
        const valB = (b[key] === '' || b[key] === null) ? (sortState.asc ? Infinity : -Infinity) : b[key];
        if (typeof valA === 'string') {
            return sortState.asc ? valA.localeCompare(valB, 'ja') : valB.localeCompare(valA, 'ja');
        }
        return sortState.asc ? valA - valB : valB - valA;
    });
    updateDragEnabled();
    refreshTable();
};

// 現役/種牡馬のトグル（閾値以上は固定でトグル不可）
const toggleRunner = (id) => {
    const h = wpState.horses.find(h => h.id === id);
    if (!h) return;
    const age = calcAge(h, wpState.currentGameYear);
    if (age !== null && age >= STALLION_AGE_THRESHOLD) return;
    h.isRunner = !h.isRunner;
    saveAndRender();
};

// ゲーム内年を更新して関連表示を再描画
const updateGameYear = (val) => {
    wpState.currentGameYear = parseInt(val, 10) || 0;
    saveGameYear(wpState.currentGameYear);
    refreshTable();
    renderFilteredHorseList(wpState.currentGameYear, masterHorseData);
};

// ============================================================
// 編集
// ============================================================

// セルをクリックしてインライン編集を開始
const startEdit = (id, key, element) => {
    const horse = wpState.horses.find(h => h.id === id);
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
            refreshTable();
        }
    };
};

// ハンドラをviewHandlersに束ねる（render に渡すコールバック）
viewHandlers.onStartEdit = startEdit;
viewHandlers.onDeleteData = deleteData;
viewHandlers.onToggleRunner = toggleRunner;

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
        wpState.horses = parsed;
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
        const exportList = [...wpState.horses].sort((a, b) => a.order - b.order);
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
    const sortState = wpState.sortState;
    return sortState.key === 'order' && sortState.asc;
};

const updateDragEnabled = () => {
    const instance = wpState.sortableInstance;
    if (instance) {
        instance.option('disabled', !isManualOrder());
    }
};

// tbodyをSortable化。≡ハンドルでのみドラッグ開始
const initSortable = () => {
    const tbody = document.getElementById('horseTableBody');
    wpState.sortableInstance = Sortable.create(tbody, {
        handle: '.handle',
        animation: 150,
        disabled: !isManualOrder(),
        onEnd: (evt) => {
            const horses = wpState.horses;
            const [moved] = horses.splice(evt.oldIndex, 1);
            horses.splice(evt.newIndex, 0, moved);
            horses.forEach((h, i) => h.order = i + 1);
            saveAndRender();
        }
    });
};

// ============================================================
// 初期化・イベントバインド
// ============================================================

// 保存データ・ゲーム内年・section表示状態を復元し描画
const loadData = () => {
    wpState.horses = loadHorses();

    const savedYear = loadGameYear();
    if (savedYear !== null) {
        wpState.currentGameYear = savedYear;
        document.getElementById('currentGameYear').value = savedYear;
    }

    ['memoArea', 'horseListSection', 'scheduleSection'].forEach(id => {
        const visible = loadSectionVisible(id);
        document.getElementById(id).style.display = visible ? 'block' : 'none';
    });

    refreshTable();
    renderFilteredHorseList(wpState.currentGameYear, masterHorseData);
    loadCheckboxes();
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

const initEvents = () => {
    registerToggleButtons();
    registerGameYearInput();
    registerScheduleCheckboxes();
    registerIoButtons();
    registerAddButton();
    registerSortHeader();
};

// エントリポイント: データ読込とイベント登録を行う
const init = () => {
    initSortable();
    loadData();
    initEvents();
};

init();
