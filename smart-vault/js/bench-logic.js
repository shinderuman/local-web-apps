// fio ベンチマーク結果のパース純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.BENCH_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // 指標ごとの4段階閾値テーブル（値の単位: Seq帯域=MiB/s, IOPS=個, レイテンシ=ms）
    // 各グループ [理想, 正常, 少し遅い] の下限（この値以上なら該当段階、未満は次段階）
    const BENCH_THRESHOLDS = {
        seqBwMiB: { nvme: [3500, 2000, 1000], sata: [500, 300, 150], hdd: [150, 100, 60] },
        randIops: { nvme: [200000, 100000, 30000], sata: [60000, 30000, 10000], hdd: [150, 80, 40] },
        latencyMs: { nvme: [0.1, 0.5, 2], sata: [0.2, 1, 5], hdd: [10, 20, 40] }
    };

    // ペースト文字列が fio 結果（seq/rand を持つ統合JSON）か判定
    // JSON.parse でき、seq と rand キーが両方あれば true。それ以外は false
    const isFioJson = (text) => {
        if (!text) return false;
        try {
            const obj = JSON.parse(text);
            return !!(obj && obj.seq && obj.rand);
        } catch {
            return false;
        }
    };

    // fio JSON の jobs[0].read から帯域・IOPS・平均レイテンシを抽出
    // 該当ジョブ・値がない場合は各フィールド 0
    // レイテンシは mean ではなく p99（99百分位数）を採用。外れ値を含む最悪応答性を評価するため
    const extractReadMetrics = (fioRoot) => {
        const read = fioRoot?.jobs?.[0]?.read || {};
        return {
            bwBytes: Number(read.bw_bytes || 0),
            iops: Number(read.iops || 0),
            clatP99Ns: Number(read.clat_ns?.percentile?.['99.000000'] || 0)
        };
    };

    // 統合JSON（{seq,rand}）を seq/rand 別々の compact JSON 文字列に分割
    // 不正時は { seq: null, rand: null }
    const splitBench = (text) => {
        try {
            const obj = JSON.parse(text);
            if (!obj || !obj.seq || !obj.rand) return { seq: null, rand: null };
            return {
                seq: JSON.stringify(obj.seq),
                rand: JSON.stringify(obj.rand)
            };
        } catch {
            return { seq: null, rand: null };
        }
    };

    // 単一 fio JSON 文字列（seq または rand 側）から表示用サマリを抽出
    // 不正時は null
    const parseBenchPart = (partText) => {
        if (!partText) return null;
        try {
            const obj = JSON.parse(partText);
            const m = extractReadMetrics(obj);
            return m;
        } catch {
            return null;
        }
    };

    // seq/rand 両方の compact 文字列から表示用サマリオブジェクトを抽出
    const parseBench = (seqText, randText) => {
        const seq = parseBenchPart(seqText);
        const rand = parseBenchPart(randText);
        if (!seq && !rand) return null;
        return {
            seqBwBytes: seq?.bwBytes || 0,
            seqIops: seq?.iops || 0,
            seqClatP99Ns: seq?.clatP99Ns || 0,
            randBwBytes: rand?.bwBytes || 0,
            randIops: rand?.iops || 0,
            randClatP99Ns: rand?.clatP99Ns || 0
        };
    };

    // customType からベンチ評価グループへ変換（NVMe/SATA/HDD/なし）
    // SSHD=HDD、eMMC=SATA、unknown等は null（色付け対象外）
    const getBenchGroup = (customType) => {
        if (customType === 'nvme') return 'nvme';
        if (customType === 'sata-ssd' || customType === 'emmc') return 'sata';
        if (customType === 'hdd-25' || customType === 'hdd-35' || customType === 'sshd') return 'hdd';
        return null;
    };

    // 値が閾値配列 [理想, 正常, 少し遅い] に対し 4段階のどれかを返す
    // higherBetter=true なら大きいほど良し、false なら小さいほど良し（レイテンシ）
    // 戻り値: 'ideal' / 'normal' / 'slow' / 'bad'
    const rateByThresholds = (value, thresholds, higherBetter) => {
        const [ideal, normal, slow] = thresholds;
        if (higherBetter) {
            if (value >= ideal) return 'ideal';
            if (value >= normal) return 'normal';
            if (value >= slow) return 'slow';
            return 'bad';
        }
        if (value <= ideal) return 'ideal';
        if (value <= normal) return 'normal';
        if (value <= slow) return 'slow';
        return 'bad';
    };

    // Seq帯域の評価（bwBytes と customType から）
    const rateSeqBw = (bwBytes, customType) => {
        const group = getBenchGroup(customType);
        if (!group) return null;
        return rateByThresholds(bwBytes / (1024 * 1024), BENCH_THRESHOLDS.seqBwMiB[group], true);
    };

    // Rand IOPSの評価
    const rateRandIops = (iops, customType) => {
        const group = getBenchGroup(customType);
        if (!group) return null;
        return rateByThresholds(iops, BENCH_THRESHOLDS.randIops[group], true);
    };

    // レイテンシの評価（ns → ms 換算）
    const rateLatency = (latencyNs, customType) => {
        const group = getBenchGroup(customType);
        if (!group) return null;
        return rateByThresholds(latencyNs / 1e6, BENCH_THRESHOLDS.latencyMs[group], false);
    };

    const BENCH_LOGIC = {
        isFioJson,
        splitBench,
        parseBenchPart,
        parseBench,
        getBenchGroup,
        rateSeqBw,
        rateRandIops,
        rateLatency
    };

    factory(root, BENCH_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.BENCH_LOGIC = mod;
    }
});
