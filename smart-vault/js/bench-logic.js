// fio ベンチマーク結果のパース純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.BENCH_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

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
    const extractReadMetrics = (fioRoot) => {
        const read = fioRoot?.jobs?.[0]?.read || {};
        return {
            bwBytes: Number(read.bw_bytes || 0),
            iops: Number(read.iops || 0),
            clatMeanNs: Number(read.clat_ns?.mean || 0)
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
            seqClatMeanNs: seq?.clatMeanNs || 0,
            randBwBytes: rand?.bwBytes || 0,
            randIops: rand?.iops || 0,
            randClatMeanNs: rand?.clatMeanNs || 0
        };
    };

    const BENCH_LOGIC = {
        isFioJson,
        splitBench,
        parseBenchPart,
        parseBench
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
