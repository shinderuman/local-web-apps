const { test } = require('node:test');
const assert = require('node:assert');
const {
    normalizeDigits,
    parseVolume,
    parseBaseTitle,
} = require('../js/title-parser.js');

// ============================================================
// normalizeDigits
// ============================================================
test('normalizeDigits: 全角数字を半角に変換', () => {
    assert.strictEqual(normalizeDigits('１２３'), '123');
    // 全角括弧は変換されず、数字のみ半角になる
    assert.strictEqual(normalizeDigits('巻（１）'), '巻（1）');
});

test('normalizeDigits: 半角数字はそのまま', () => {
    assert.strictEqual(normalizeDigits('123'), '123');
});

// ============================================================
// parseVolume: 末尾の括弧書き（N）
// ============================================================
test('parseVolume: 末尾全角括弧の巻数を取得', () => {
    assert.strictEqual(parseVolume('あと6日で滅びる崖っぷち国家のハーレムに召喚されてしまった（1）'), 1);
    assert.strictEqual(parseVolume('あと6日で滅びる崖っぷち国家のハーレムに召喚されてしまった（3）'), 3);
    assert.strictEqual(parseVolume('作品名（10）'), 10);
});

test('parseVolume: 末尾半角括弧の巻数を取得', () => {
    assert.strictEqual(parseVolume('作品名(5)'), 5);
});

test('parseVolume: 本文中の数字を巻数と誤判定しない（「6日」の6は無視）', () => {
    // 末尾が括弧なので3が取れるべき。「6」ではない
    assert.strictEqual(parseVolume('あと6日で滅びる崖っぷち国家のハーレムに召喚されてしまった（3）'), 3);
});

// ============================================================
// parseVolume: 末尾の数字
// ============================================================
test('parseVolume: 末尾の単独数字を巻数として取得', () => {
    assert.strictEqual(parseVolume('レアモンスター？それ、ただの害虫ですよ 2'), 2);
});

// ============================================================
// parseVolume: サブタイトル（〜以降）を除外した本編の末尾数字
// ============================================================
test('parseVolume: 末尾が〜で終わる場合、本編の巻数を取得', () => {
    assert.strictEqual(parseVolume('レベル0の無能探索者と蔑まれても実は世界最強です5 〜探索ランキング1位は謎の人〜'), 5);
    assert.strictEqual(parseVolume('レベル0の無能探索者と蔑まれても実は世界最強です 2 〜探索ランキング1位は謎の人〜'), 2);
    assert.strictEqual(parseVolume('レベル0の無能探索者と蔑まれても実は世界最強です 〜探索ランキング1位は謎の人〜'), 1);
});

test('parseVolume: 巻数表記がない場合は1', () => {
    assert.strictEqual(parseVolume('単巻の作品'), 1);
});

// ============================================================
// parseBaseTitle: 末尾の巻数表記を除去
// ============================================================
test('parseBaseTitle: 末尾の括弧書きを除去', () => {
    assert.strictEqual(parseBaseTitle('あと6日で滅びる崖っぷち国家のハーレムに召喚されてしまった（1）'), 'あと6日で滅びる崖っぷち国家のハーレムに召喚されてしまった');
});

test('parseBaseTitle: 末尾の雑誌名括弧→巻数括弧の順に除去', () => {
    // (ヤンマガＷｅｂ) を除去後、（1）が末尾になり巻数として除去される
    assert.strictEqual(parseBaseTitle('作品名（1） (ヤンマガＷｅｂ)'), '作品名');
});

test('parseBaseTitle: 末尾に数字付加後でも除去（合成タイトル対応）', () => {
    // 右ペインで タイトル+巻数 を合成した入力: 「作品名（1） (雑誌) 1」
    assert.strictEqual(parseBaseTitle('作品名（1） (ヤンマガＷｅｂ) 1'), '作品名');
});

test('parseBaseTitle: 末尾の単独数字を除去', () => {
    assert.strictEqual(parseBaseTitle('レアモンスター？それ、ただの害虫ですよ 2'), 'レアモンスター？それ、ただの害虫ですよ');
});

test('parseBaseTitle: 先頭・途中の数字は保持（「100万」等）', () => {
    assert.strictEqual(parseBaseTitle('100万のほげ（1）'), '100万のほげ');
});

test('parseBaseTitle: 全角数字の巻数も除去', () => {
    assert.strictEqual(parseBaseTitle('底辺冒険者だけど魔法を極めてみることにした（１）'), '底辺冒険者だけど魔法を極めてみることにした');
});

// ============================================================
// 実データ（エクスポートJSON）のKindleアイテムタイトル
// ============================================================

// クラス≪無職≫の英雄譚 4巻（全角数字＋末尾巻数＋雑誌名）
test('実データ: クラス無職の英雄譚 4巻', () => {
    const title = 'クラス≪無職≫の英雄譚～公爵家を追放されたが、実は殴っただけでスキルを獲得できるとわかり、大陸一の英雄に上り詰める～【電子単行本】　4 (ヤングチャンピオン・コミックス)';
    assert.strictEqual(parseVolume(title), 4);
    const base = parseBaseTitle(title);
    assert.ok(base.includes('クラス≪無職≫の英雄譚'), '作品名が保持されるべき: ' + base);
    assert.ok(!base.includes('4'), '巻数4は除去されるべき: ' + base);
});

// ルックバック（巻数なし・単巻）
test('実データ: ルックバック 単巻', () => {
    const title = 'ルックバック (ジャンプコミックスDIGITAL)';
    assert.strictEqual(parseVolume(title), 1);
    const base = parseBaseTitle(title);
    assert.ok(base.includes('ルックバック'), '作品名が保持されるべき: ' + base);
});

// 涼宮ハルヒの憂鬱(10)（半角括弧・末尾巻数）
test('実データ: 涼宮ハルヒの憂鬱 10巻', () => {
    const title = '涼宮ハルヒの憂鬱(10) (角川コミックス・エース)';
    assert.strictEqual(parseVolume(title), 10);
    const base = parseBaseTitle(title);
    assert.ok(base.includes('涼宮ハルヒの憂鬱'), '作品名が保持されるべき: ' + base);
});

// 神呪のネクタール 18巻
test('実データ: 神呪のネクタール 18巻', () => {
    const title = '神呪のネクタール　18 (チャンピオンREDコミックス)';
    assert.strictEqual(parseVolume(title), 18);
    const base = parseBaseTitle(title);
    assert.ok(base.includes('神呪のネクタール'), '作品名が保持されるべき: ' + base);
});

// 我にチートを 10巻（タイトル内にチート数字はない）
test('実データ: 我にチートを 10巻', () => {
    const title = '我にチートを ～ハズレチートの召喚勇者は異世界でゆっくり暮らしたい～【電子単行本】　10 (ヤングチャンピオン・コミックス)';
    assert.strictEqual(parseVolume(title), 10);
    const base = parseBaseTitle(title);
    assert.ok(base.includes('我にチートを'), '作品名が保持されるべき: ' + base);
});

