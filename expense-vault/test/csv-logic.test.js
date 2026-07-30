const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeDate,
    parseCsvRows,
    parseExpenseCsv
} = require('../js/csv-logic.js');

test('normalizeDateは1桁月日を正規化する', () => {
    assert.equal(normalizeDate('2026/7/3'), '2026-07-03');
    assert.equal(normalizeDate('2026/13/3'), null);
});

test('parseCsvRowsは引用符と末尾空カラムを維持する', () => {
    const rows = parseCsvRows('2026/7/1,"店,舗",100,,,');

    assert.deepEqual(rows, [['2026/7/1', '店,舗', '100', '', '', '']]);
});

test('確定CSVは先頭個人情報を破棄して解析する', () => {
    const parsed = parseExpenseCsv(
        [
            '本名,****-****-****-1234',
            'ご利用日,ご利用店名 ※,ご利用金額,支払区分,今回回数,お支払い金額',
            '2025/04/30,ＡｍａｚｏｎＰａｙ提携サイト,1980,１,１,1980,ＡＭＺ＊ＭＡＮＤＡＲＡＫＥ'
        ].join('\r\n')
    );

    assert.equal(parsed.sourceType, 'confirmed');
    assert.equal(parsed.discardedLeadingRowCount, 2);
    assert.deepEqual(parsed.records[0], {
        usedAt: '2025-04-30',
        merchant: 'ＡｍａｚｏｎＰａｙ提携サイト',
        amount: 1980,
        monthKey: '2025-04',
        sourceType: 'confirmed'
    });
});

test('未確定CSVは7列目の金額だけを利用する', () => {
    const parsed = parseExpenseCsv(
        "2026/7/26,ＡＭＡＺＯＮ．ＣＯ．ＪＰ,ご本人,1回払い,,'26/08,1312,9999,,,,,"
    );

    assert.equal(parsed.sourceType, 'provisional');
    assert.equal(parsed.records[0].amount, 1312);
});
