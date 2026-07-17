const { test } = require('node:test');
const assert = require('node:assert');
const {
    isFioJson,
    splitBench,
    parseBench,
    getBenchGroup,
    rateSeqBw,
    rateRandIops,
    rateLatency
} = require('../js/bench-logic.js');

// テスト用の最小fio結果（seq/rand それぞれ jobs[0].read を持つ統合JSON）
const makeFio = (seqRead, randRead, latencyRead) =>
    JSON.stringify({
        seq: {
            fio_version: 'fio-3.42',
            jobs: [{ jobname: 'sata_seq', read: seqRead }]
        },
        rand: {
            fio_version: 'fio-3.42',
            jobs: [{ jobname: 'sata_rand', read: randRead }]
        },
        ...(latencyRead
            ? {
                  latency: {
                      fio_version: 'fio-3.42',
                      jobs: [{ jobname: 'sata_latency', read: latencyRead }]
                  }
              }
            : {})
    });

const sampleRead = {
    bw_bytes: 360243752,
    iops: 343.555,
    clat_ns: { percentile: { '99.000000': 2907020 } }
};

// ============================================================
// isFioJson
// ============================================================
test('isFioJson: seq/rand 両方持ちなら true', () => {
    assert.strictEqual(isFioJson(makeFio(sampleRead, sampleRead)), true);
});

test('isFioJson: smartctl JSON（serial_number）なら false', () => {
    const smartctl = JSON.stringify({
        serial_number: 'ABC',
        model_name: 'Drive'
    });
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
test('splitBench: 統合JSON を用途別の compact 文字列に分割', () => {
    const { seq, rand, latency } = splitBench(
        makeFio(sampleRead, sampleRead, sampleRead)
    );
    assert.strictEqual(
        seq,
        JSON.stringify({
            fio_version: 'fio-3.42',
            jobs: [{ jobname: 'sata_seq', read: sampleRead }]
        })
    );
    assert.strictEqual(
        rand,
        JSON.stringify({
            fio_version: 'fio-3.42',
            jobs: [{ jobname: 'sata_rand', read: sampleRead }]
        })
    );
    assert.strictEqual(
        latency,
        JSON.stringify({
            fio_version: 'fio-3.42',
            jobs: [{ jobname: 'sata_latency', read: sampleRead }]
        })
    );
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
test('parseBench: seq/rand の帯域・IOPS・p99レイテンシを抽出', () => {
    const { seq, rand, latency } = splitBench(
        makeFio(
            sampleRead,
            {
                bw_bytes: 15240958,
                iops: 3720.937,
                clat_ns: { percentile: { '99.000000': 4297640 } }
            },
            {
                bw_bytes: 0,
                iops: 5600,
                clat_ns: { percentile: { '99.000000': 178000 } }
            }
        )
    );
    const result = parseBench(seq, rand, latency);
    assert.strictEqual(result.seqBwBytes, 360243752);
    assert.strictEqual(result.seqIops, 343.555);
    assert.strictEqual(result.seqClatP99Ns, 2907020);
    assert.strictEqual(result.randBwBytes, 15240958);
    assert.strictEqual(result.randIops, 3720.937);
    assert.strictEqual(result.randClatP99Ns, 4297640);
    assert.strictEqual(result.latencyClatP99Ns, 178000);
});

test('parseBench: fio が us 単位で出力した p99 を ns に換算', () => {
    const result = parseBench(
        JSON.stringify({
            jobs: [
                {
                    read: {
                        clat_us: { percentile: { '99.000000': 250 } }
                    }
                }
            ]
        })
    );
    assert.strictEqual(result.seqClatP99Ns, 250000);
});

test('parseBench: seq/rand 両方 null なら null', () => {
    assert.strictEqual(parseBench(null, null), null);
});

test('parseBench: 不正JSON は null', () => {
    assert.strictEqual(parseBench('{broken', '{broken'), null);
});

// ============================================================
// getBenchGroup
// ============================================================
test('getBenchGroup: nvme', () => {
    assert.strictEqual(getBenchGroup('nvme'), 'nvme');
});

test('getBenchGroup: sata-ssd / emmc は sata', () => {
    assert.strictEqual(getBenchGroup('sata-ssd'), 'sata');
    assert.strictEqual(getBenchGroup('emmc'), 'sata');
});

test('getBenchGroup: hdd-25 / hdd-35 / sshd は hdd', () => {
    assert.strictEqual(getBenchGroup('hdd-25'), 'hdd');
    assert.strictEqual(getBenchGroup('hdd-35'), 'hdd');
    assert.strictEqual(getBenchGroup('sshd'), 'hdd');
});

test('getBenchGroup: unknown は null', () => {
    assert.strictEqual(getBenchGroup('unknown'), null);
    assert.strictEqual(getBenchGroup(''), null);
});

// ============================================================
// rateSeqBw: Seq帯域（MiB/s）の4段階評価
// ============================================================
test('rateSeqBw: NVMe 4000MiB/s は ideal', () => {
    assert.strictEqual(rateSeqBw(4000 * 1024 * 1024, 'nvme'), 'ideal');
});

test('rateSeqBw: NVMe 1500MiB/s は slow', () => {
    assert.strictEqual(rateSeqBw(1500 * 1024 * 1024, 'nvme'), 'slow');
});

test('rateSeqBw: SATA 400MiB/s は normal', () => {
    assert.strictEqual(rateSeqBw(400 * 1024 * 1024, 'sata-ssd'), 'normal');
});

test('rateSeqBw: HDD 80MiB/s は slow', () => {
    assert.strictEqual(rateSeqBw(80 * 1024 * 1024, 'hdd-35'), 'slow');
});

test('rateSeqBw: unknown は null', () => {
    assert.strictEqual(rateSeqBw(1000 * 1024 * 1024, 'unknown'), null);
});

// ============================================================
// rateRandIops: Rand IOPSの4段階評価
// ============================================================
test('rateRandIops: NVMe 150000 は normal', () => {
    assert.strictEqual(rateRandIops(150000, 'nvme'), 'normal');
});

test('rateRandIops: SATA 5000 は bad', () => {
    assert.strictEqual(rateRandIops(5000, 'sata-ssd'), 'bad');
});

test('rateRandIops: HDD 150 は ideal', () => {
    assert.strictEqual(rateRandIops(150, 'hdd-25'), 'ideal');
});

// ============================================================
// rateLatency: レイテンシ（ms・低いほど良し）
// ============================================================
test('rateLatency: NVMe 0.05ms は ideal', () => {
    assert.strictEqual(rateLatency(0.05e6, 'nvme'), 'ideal');
});

test('rateLatency: NVMe 3ms は bad', () => {
    assert.strictEqual(rateLatency(3e6, 'nvme'), 'bad');
});

test('rateLatency: HDD 15ms は normal', () => {
    assert.strictEqual(rateLatency(15e6, 'hdd-35'), 'normal');
});

test('rateLatency: unknown は null', () => {
    assert.strictEqual(rateLatency(1e6, 'unknown'), null);
});
