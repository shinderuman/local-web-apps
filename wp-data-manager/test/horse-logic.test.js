const { test } = require('node:test');
const assert = require('node:assert');
const {
    calcAge,
    isStallion,
    parseEditValue,
    getEditOriginalValue,
    STALLION_AGE_THRESHOLD
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
    assert.strictEqual(isStallion({ birthYear: 1990, isRunner: true }, 2000), true);
});

test('isStallion: 閾値未満かつ現役(isRunner=true)なら種牡馬でない', () => {
    assert.strictEqual(isStallion({ birthYear: 1995, isRunner: true }, 2000), false);
});

test('isStallion: 閾値未満かつ非現役(isRunner=false)なら種牡馬', () => {
    assert.strictEqual(isStallion({ birthYear: 1995, isRunner: false }, 2000), true);
});

test('isStallion: 年齢不明(null)の場合はisRunnerで判定', () => {
    assert.strictEqual(isStallion({ birthYear: '', isRunner: false }, 2000), true);
    assert.strictEqual(isStallion({ birthYear: '', isRunner: true }, 2000), false);
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
    assert.deepStrictEqual(parseEditValue('otherHorseNames', '馬A\n馬B'), ['馬A', '馬B']);
});

test('parseEditValue: otherHorseNamesの空文字は空配列', () => {
    assert.deepStrictEqual(parseEditValue('otherHorseNames', ''), []);
});

test('parseEditValue: otherHorseNamesは前後空白を除去', () => {
    assert.deepStrictEqual(parseEditValue('otherHorseNames', ' 馬A \n 馬B '), ['馬A', '馬B']);
});

test('parseEditValue: otherHorseNamesの空行は除外', () => {
    assert.deepStrictEqual(parseEditValue('otherHorseNames', '馬A\n\n馬B'), ['馬A', '馬B']);
});

test('parseEditValue: その他キー(horseName等)はそのまま文字列', () => {
    assert.strictEqual(parseEditValue('horseName', '新馬名'), '新馬名');
});

// ============================================================
// getEditOriginalValue: 編集セルの初期値を取得
// ============================================================

test('getEditOriginalValue: otherHorseNamesは改行区切り文字列に変換', () => {
    assert.strictEqual(getEditOriginalValue({ otherHorseNames: ['馬A', '馬B'] }, 'otherHorseNames'), '馬A\n馬B');
});

test('getEditOriginalValue: otherHorseNames未定義は空文字', () => {
    assert.strictEqual(getEditOriginalValue({}, 'otherHorseNames'), '');
});

test('getEditOriginalValue: その他キーはその値', () => {
    assert.strictEqual(getEditOriginalValue({ horseName: '馬X' }, 'horseName'), '馬X');
});
