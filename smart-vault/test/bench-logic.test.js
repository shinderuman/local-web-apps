const { test } = require('node:test');
const assert = require('node:assert');
const { isFioJson, splitBench, parseBench } = require('../js/bench-logic.js');

// テスト用の最小fio結果（seq/rand それぞれ jobs[0].read を持つ統合JSON）
const makeFio = (seqRead, randRead) => JSON.stringify({
    seq: { fio_version: 'fio-3.42', jobs: [{ jobname: 'sata_seq', read: seqRead }] },
    rand: { fio_version: 'fio-3.42', jobs: [{ jobname: 'sata_rand', read: randRead }] }
});

const sampleRead = {
    bw_bytes: 360243752,
    iops: 343.555,
    clat_ns: { mean: 2907020 }
};

// ============================================================
// isFioJson
// ============================================================
test('isFioJson: seq/rand 両方持ちなら true', () => {
    assert.strictEqual(isFioJson(makeFio(sampleRead, sampleRead)), true);
});

test('isFioJson: smartctl JSON（serial_number）なら false', () => {
    const smartctl = JSON.stringify({ serial_number: 'ABC', model_name: 'Drive' });
    assert.strictEqual(isFioJson(smartctl), false);
});

test('isFioJson: seq だけなら false', () => {
    const seqOnly = JSON.stringify({ seq: { jobs: [] } });
    assert.strictEqual(isFioJson(seqOnly), false);
});

test('isFioJson: 不正JSON は false', () => {
    assert.strictEqual(isFioJson('{broken json'), false);
});

test('isFioJson: 空文字・null は false', () => {
    assert.strictEqual(isFioJson(''), false);
    assert.strictEqual(isFioJson(null), false);
});

// ============================================================
// splitBench
// ============================================================
test('splitBench: 統合JSON を seq/rand 別々の compact 文字列に分割', () => {
    const { seq, rand } = splitBench(makeFio(sampleRead, sampleRead));
    assert.strictEqual(seq, JSON.stringify({ fio_version: 'fio-3.42', jobs: [{ jobname: 'sata_seq', read: sampleRead }] }));
    assert.strictEqual(rand, JSON.stringify({ fio_version: 'fio-3.42', jobs: [{ jobname: 'sata_rand', read: sampleRead }] }));
});

test('splitBench: seq/rand なければ両方 null', () => {
    const { seq, rand } = splitBench(JSON.stringify({ foo: 1 }));
    assert.strictEqual(seq, null);
    assert.strictEqual(rand, null);
});

test('splitBench: 不正JSON は両方 null', () => {
    const { seq, rand } = splitBench('{broken json');
    assert.strictEqual(seq, null);
    assert.strictEqual(rand, null);
});

// ============================================================
// parseBench
// ============================================================
test('parseBench: seq/rand の帯域・IOPS・レイテンシを抽出', () => {
    const { seq, rand } = splitBench(makeFio(sampleRead, {
        bw_bytes: 15240958,
        iops: 3720.937,
        clat_ns: { mean: 4297640 }
    }));
    const result = parseBench(seq, rand);
    assert.strictEqual(result.seqBwBytes, 360243752);
    assert.strictEqual(result.seqIops, 343.555);
    assert.strictEqual(result.seqClatMeanNs, 2907020);
    assert.strictEqual(result.randBwBytes, 15240958);
    assert.strictEqual(result.randIops, 3720.937);
    assert.strictEqual(result.randClatMeanNs, 4297640);
});

test('parseBench: seq/rand 両方 null なら null', () => {
    assert.strictEqual(parseBench(null, null), null);
});

test('parseBench: 不正JSON は null', () => {
    assert.strictEqual(parseBench('{broken', '{broken'), null);
});
