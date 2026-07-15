const { test } = require('node:test');
const assert = require('node:assert');
const {
    calcAge,
    isStallion,
    parseEditValue,
    getEditOriginalValue,
    STALLION_AGE_THRESHOLD,
    createHorse,
    removeHorse,
    updateHorseValue,
    toggleHorseRunner,
    getNextSortState,
    sortHorses,
    reorderHorses,
    listHistoricalHorseGroups,
    isValidHorseList,
    isManualSort
} = require('../js/horse-logic.js');

// ============================================================
// calcAge: 生年と現在年から年齢を計算
// ============================================================

test('calcAge: 正常系は現在年-生年', () => {
    assert.strictEqual(calcAge({ birthYear: 1990 }, 2000), 10);
});

test('calcAge: 生年が未設定(空文字)ならnull', () => {
    assert.strictEqual(calcAge({ birthYear: '' }, 2000), null);
});

test('calcAge: 現在年が0(未設定)ならnull', () => {
    assert.strictEqual(calcAge({ birthYear: 1990 }, 0), null);
});

test('calcAge: 生年も現在年も未設定ならnull', () => {
    assert.strictEqual(calcAge({ birthYear: '' }, 0), null);
});

// ============================================================
// isStallion: 種牡馬判定（閾値以上は強制種牡馬、それ以外はisRunner）
// ============================================================

test('isStallion: 閾値以上(10歳)は強制種牡馬', () => {
    assert.strictEqual(
        isStallion({ birthYear: 1990, isRunner: true }, 2000),
        true
    );
});

test('isStallion: 閾値未満かつ現役(isRunner=true)なら種牡馬でない', () => {
    assert.strictEqual(
        isStallion({ birthYear: 1995, isRunner: true }, 2000),
        false
    );
});

test('isStallion: 閾値未満かつ非現役(isRunner=false)なら種牡馬', () => {
    assert.strictEqual(
        isStallion({ birthYear: 1995, isRunner: false }, 2000),
        true
    );
});

test('isStallion: 年齢不明(null)の場合はisRunnerで判定', () => {
    assert.strictEqual(
        isStallion({ birthYear: '', isRunner: false }, 2000),
        true
    );
    assert.strictEqual(
        isStallion({ birthYear: '', isRunner: true }, 2000),
        false
    );
});

test('STALLION_AGE_THRESHOLD: 閾値は10', () => {
    assert.strictEqual(STALLION_AGE_THRESHOLD, 10);
});

// ============================================================
// parseEditValue: 編集入力値を保持値に変換
// ============================================================

test('parseEditValue: birthYearは数値に変換', () => {
    assert.strictEqual(parseEditValue('birthYear', '1990'), 1990);
});

test('parseEditValue: birthYearの空文字は空文字のまま', () => {
    assert.strictEqual(parseEditValue('birthYear', ''), '');
});

test('parseEditValue: otherHorseNamesは改行区切りで配列化', () => {
    assert.deepStrictEqual(parseEditValue('otherHorseNames', '馬A\n馬B'), [
        '馬A',
        '馬B'
    ]);
});

test('parseEditValue: otherHorseNamesの空文字は空配列', () => {
    assert.deepStrictEqual(parseEditValue('otherHorseNames', ''), []);
});

test('parseEditValue: otherHorseNamesは前後空白を除去', () => {
    assert.deepStrictEqual(parseEditValue('otherHorseNames', ' 馬A \n 馬B '), [
        '馬A',
        '馬B'
    ]);
});

test('parseEditValue: otherHorseNamesの空行は除外', () => {
    assert.deepStrictEqual(parseEditValue('otherHorseNames', '馬A\n\n馬B'), [
        '馬A',
        '馬B'
    ]);
});

test('parseEditValue: その他キー(horseName等)はそのまま文字列', () => {
    assert.strictEqual(parseEditValue('horseName', '新馬名'), '新馬名');
});

// ============================================================
// getEditOriginalValue: 編集セルの初期値を取得
// ============================================================

test('getEditOriginalValue: otherHorseNamesは改行区切り文字列に変換', () => {
    assert.strictEqual(
        getEditOriginalValue(
            { otherHorseNames: ['馬A', '馬B'] },
            'otherHorseNames'
        ),
        '馬A\n馬B'
    );
});

test('getEditOriginalValue: otherHorseNames未定義は空文字', () => {
    assert.strictEqual(getEditOriginalValue({}, 'otherHorseNames'), '');
});

test('getEditOriginalValue: その他キーはその値', () => {
    assert.strictEqual(
        getEditOriginalValue({ horseName: '馬X' }, 'horseName'),
        '馬X'
    );
});

// ============================================================
// 系統レコード操作: UI/保存処理から切り離した非破壊のデータ更新
// ============================================================

test('createHorse: 既存の最大orderの次に必要な初期値を持つレコードを作る', () => {
    const existing = [
        { id: 1, order: 2 },
        { id: 2, order: 5 }
    ];
    const result = createHorse(
        { name: '新系統', birthYear: '1990', horseName: '' },
        existing,
        99
    );

    assert.deepStrictEqual(result, {
        id: 99,
        order: 6,
        name: '新系統',
        birthYear: 1990,
        horseName: '種牡馬',
        otherHorseNames: [],
        isRunner: true
    });
});

test('createHorse: 生年未入力は空文字のまま保持する', () => {
    const result = createHorse(
        { name: '新系統', birthYear: '', horseName: '所有馬' },
        [],
        99
    );

    assert.strictEqual(result.birthYear, '');
    assert.strictEqual(result.horseName, '所有馬');
});

test('removeHorse: 指定IDだけを除外し、元配列を変更しない', () => {
    const horses = [{ id: 1 }, { id: 2 }];
    const result = removeHorse(horses, 1);

    assert.deepStrictEqual(result, [{ id: 2 }]);
    assert.deepStrictEqual(horses, [{ id: 1 }, { id: 2 }]);
});

test('updateHorseValue: 指定レコードだけを更新し、元レコードを変更しない', () => {
    const horses = [
        { id: 1, horseName: '旧名' },
        { id: 2, horseName: '維持' }
    ];
    const result = updateHorseValue(horses, 1, 'horseName', '新名');

    assert.deepStrictEqual(result, [
        { id: 1, horseName: '新名' },
        { id: 2, horseName: '維持' }
    ]);
    assert.deepStrictEqual(horses, [
        { id: 1, horseName: '旧名' },
        { id: 2, horseName: '維持' }
    ]);
});

test('toggleHorseRunner: 閾値未満なら指定レコードの現役状態だけを反転する', () => {
    const horses = [
        { id: 1, birthYear: 1995, isRunner: true },
        { id: 2, birthYear: 1995, isRunner: true }
    ];
    const result = toggleHorseRunner(horses, 1, 2000);

    assert.deepStrictEqual(result, [
        { id: 1, birthYear: 1995, isRunner: false },
        { id: 2, birthYear: 1995, isRunner: true }
    ]);
    assert.strictEqual(horses[0].isRunner, true);
});

test('toggleHorseRunner: 強制種牡馬の年齢なら配列を更新しない', () => {
    const horses = [{ id: 1, birthYear: 1990, isRunner: true }];

    assert.deepStrictEqual(toggleHorseRunner(horses, 1, 2000), horses);
});

test('getNextSortState: 同じ列は昇降順を反転し、別列は昇順で開始する', () => {
    assert.deepStrictEqual(
        getNextSortState({ key: 'name', asc: true }, 'name'),
        { key: 'name', asc: false }
    );
    assert.deepStrictEqual(
        getNextSortState({ key: 'name', asc: false }, 'birthYear'),
        { key: 'birthYear', asc: true }
    );
});

test('sortHorses: 未入力値を末尾にして日本語名を昇順に並べ、元配列を変更しない', () => {
    const horses = [{ name: '馬B' }, { name: '' }, { name: '馬A' }];
    const result = sortHorses(horses, 'name', true);

    assert.deepStrictEqual(
        result.map((horse) => horse.name),
        ['馬A', '馬B', '']
    );
    assert.deepStrictEqual(
        horses.map((horse) => horse.name),
        ['馬B', '', '馬A']
    );
});

test('reorderHorses: 移動後の表示順に連番orderを振り直し、元配列を変更しない', () => {
    const horses = [
        { id: 1, order: 1 },
        { id: 2, order: 2 },
        { id: 3, order: 3 }
    ];
    const result = reorderHorses(horses, 0, 2);

    assert.deepStrictEqual(result, [
        { id: 2, order: 1 },
        { id: 3, order: 2 },
        { id: 1, order: 3 }
    ]);
    assert.deepStrictEqual(horses, [
        { id: 1, order: 1 },
        { id: 2, order: 2 },
        { id: 3, order: 3 }
    ]);
});

test('listHistoricalHorseGroups: ゲーム内年の前年以降を年順で返し、元データを変更しない', () => {
    const master = { 1968: ['馬A'], 1970: ['馬B'], 1967: ['馬C'] };
    const result = listHistoricalHorseGroups(master, 1969);

    assert.deepStrictEqual(result, [
        { year: 1968, horses: ['馬A'] },
        { year: 1970, horses: ['馬B'] }
    ]);
    assert.deepStrictEqual(master, {
        1968: ['馬A'],
        1970: ['馬B'],
        1967: ['馬C']
    });
});

test('isValidHorseList: idとnameを持つ配列だけを復元データとして受け入れる', () => {
    assert.strictEqual(isValidHorseList([{ id: 1, name: '系統A' }]), true);
    assert.strictEqual(isValidHorseList([{ id: 1 }]), false);
    assert.strictEqual(isValidHorseList({ id: 1, name: '系統A' }), false);
});

test('isManualSort: orderの昇順だけを手動並び替え可能と判定する', () => {
    assert.strictEqual(isManualSort({ key: 'order', asc: true }), true);
    assert.strictEqual(isManualSort({ key: 'order', asc: false }), false);
    assert.strictEqual(isManualSort({ key: 'name', asc: true }), false);
});
