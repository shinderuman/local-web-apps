// 深刻度スコア算出の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.HEALTH_LOGIC にエクスポート
// Node: module.exports にエクスポート
// ※ getAttrRaw は PARSE_LOGIC に依存

((root, factory) => {
    const PARSE_LOGIC =
        (typeof window !== 'undefined' ? window.PARSE_LOGIC : null) ||
        (typeof require === 'function' ? require('./parse-logic.js') : null);
    const getAttrRaw = PARSE_LOGIC.getAttrRaw;

    // ============================================================
    // 定数（スコア重み・公称寿命基準・レベル閾値）
    // ============================================================

    // S.M.A.R.T. 総合判定 FAILED の固定加算（最優先・L6を保証）
    const FAILED_PENALTY = 100000;

    // セクタ系指標の重み（HDD/SSD共通・物理的不良の深刻度順）
    const SECTOR_WEIGHT = {
        realloc: 100, // 代替処理済セクタ(5)
        pending: 150, // 保留中セクタ(197)
        uncorrectable: 200 // 回復不能セクタ(198)
    };

    // HDD/SSHD 固有の重み・ペナルティ
    const HDD_PENALTY = {
        idnf: 3000, // エラーログ IDNF 検出
        commandTimeout: 500, // Command_Timeout(188)>0（生値不使用の固定）
        uncPerError: 5, // エラーログ UNC 件数あたり
        hourBenchmark: 30000 // 公称寿命基準（時間）。超過分を加算
    };

    // SATA-SSD/eMMC 固有の重み・ペナルティ
    const SSD_PENALTY = {
        lifePerPoint: 50, // 残り寿命1%低下あたり
        lifeCritical: 5000, // 残り寿命<=10% の臨界ペナルティ
        reservedLow: 8000, // 予備ブロックしきい値下回り
        unknownLife: 2000, // 残り寿命・書込量ともに取得不能（評価不能＝異常扱い）
        hourBenchmark: 40000 // 公称寿命基準（時間）
    };

    // NVMe 固有の重み・ペナルティ
    const NVME_PENALTY = {
        criticalWarning: 20000, // critical_warning ≠ 0
        mediaErrorPerCount: 200, // media_errors 件あたり
        pctUsedCriticalThreshold: 90, // percentage_used 臨界判定のしきい値(%)
        pctUsedCritical: 5000, // percentage_used>=90% の臨界ペナルティ
        pctUsedPerPoint: 100, // 90%超の1%あたり
        availSpareCritical: 10, // available_spare 臨界判定のしきい値(%)
        availSpareLow: 5000, // available_spare<=10% のペナルティ
        availSpareWarnMax: 50, // available_spare 注意域の上限(%)
        availSpareWarnPerPoint: 50 // 11-50%帯の1%あたり
    };

    // 7段階レベルのスコア上限（添字=レベル、そのレベルの最大スコア）
    const LEVEL_SCORE_MAX = [
        0,
        9,
        99,
        999,
        9999,
        99999,
        Number.MAX_SAFE_INTEGER
    ];

    // ============================================================
    // スコア加算ヘルパ
    // ============================================================

    // スコア加算結果と理由を蓄積するヘルパを生成
    const makeScorer = () => {
        let score = 0;
        const reasons = [];
        const add = (points, reason) => {
            score += points;
            if (reason && !reasons.includes(reason)) reasons.push(reason);
        };
        return {
            add,
            getScore: () => score,
            getReasons: () =>
                reasons.length === 0 ? ['判定基準に該当なし'] : reasons
        };
    };

    // エラーログの概要から件数とエラー種別フラグを抽出
    const parseErrorDescriptions = (errSummary) => {
        const errCount = Number(errSummary?.count) || 0;
        const descs = (errSummary?.table || [])
            .map((e) => (e.error_description || '').toUpperCase())
            .join(' ');
        return {
            errCount,
            hasUNC: /\bUNC\b/.test(descs),
            hasIDNF: /\bIDNF\b/.test(descs),
            hasICRC: /\bICRC\b/.test(descs),
            hasABRT: /\bABRT\b/.test(descs)
        };
    };

    // HDD判定（物理駆動・セクタ不良重視）
    const judgeHdd = (ctx, add) => {
        const {
            table,
            hours_val,
            reallocSectors,
            pendingSectors,
            crcErrors,
            errs
        } = ctx;
        const offlineUncorrectable = getAttrRaw(table, 198);
        const commandTimeout = getAttrRaw(table, 188);

        if (pendingSectors > 0)
            add(
                pendingSectors * SECTOR_WEIGHT.pending,
                `保留中セクタ(197)=${pendingSectors}`
            );
        if (offlineUncorrectable > 0)
            add(
                offlineUncorrectable * SECTOR_WEIGHT.uncorrectable,
                `回復不能セクタ(198)=${offlineUncorrectable}`
            );
        if (reallocSectors > 0)
            add(
                reallocSectors * SECTOR_WEIGHT.realloc,
                `代替処理済セクタ(5)=${reallocSectors}`
            );
        if (errs.hasUNC)
            add(
                errs.errCount * HDD_PENALTY.uncPerError,
                `エラーログにUNC検出 (${errs.errCount}件)`
            );
        if (errs.hasIDNF) add(HDD_PENALTY.idnf, 'エラーログにIDNF検出');

        if (hours_val >= HDD_PENALTY.hourBenchmark) {
            add(
                hours_val - HDD_PENALTY.hourBenchmark,
                `通電時間=${hours_val}H (公称寿命${HDD_PENALTY.hourBenchmark}H超)`
            );
        }

        if (crcErrors > 0) add(crcErrors, `UDMA_CRC(199)=${crcErrors}`);
        if (commandTimeout > 0)
            add(
                HDD_PENALTY.commandTimeout,
                `Command_Timeout(188)=${commandTimeout}`
            );
        if ((errs.hasICRC || errs.hasABRT) && !errs.hasUNC && !errs.hasIDNF) {
            add(errs.errCount, `エラーログにICRC/ABRT (${errs.errCount}件)`);
        }
    };

    // SATA-SSD判定（書込寿命・予備ブロック重視）
    const judgeSataSsd = (ctx, add) => {
        const {
            table,
            hours_val,
            lifePercent,
            reallocSectors,
            crcErrors,
            tbw_val
        } = ctx;

        const lifeKnown = lifePercent >= 0 && lifePercent <= 100;
        if (lifeKnown) {
            add(
                (100 - lifePercent) * SSD_PENALTY.lifePerPoint,
                `残り寿命=${lifePercent}%`
            );
            if (lifePercent <= 10)
                add(
                    SSD_PENALTY.lifeCritical,
                    `残り寿命=${lifePercent}% (<=10)`
                );
        } else if (!tbw_val) {
            // 残り寿命も書込量も取得不能は評価不能＝異常扱い
            add(SSD_PENALTY.unknownLife, '残り寿命・書込容量ともに取得不能');
        }

        const reserved = (table || []).find(
            (a) => a.id === 232 || a.id === 233
        );
        if (
            reserved &&
            reserved.thresh !== undefined &&
            Number(reserved.value) < Number(reserved.thresh)
        ) {
            add(
                SSD_PENALTY.reservedLow,
                `予備ブロック(ID${reserved.id})がしきい値下回り`
            );
        }

        if (reallocSectors > 0)
            add(
                reallocSectors * SECTOR_WEIGHT.realloc,
                `代替処理済セクタ(5)=${reallocSectors}`
            );
        if (crcErrors > 0) add(crcErrors, `UDMA_CRC(199)=${crcErrors}`);
        if (hours_val >= SSD_PENALTY.hourBenchmark) {
            add(
                hours_val - SSD_PENALTY.hourBenchmark,
                `通電時間=${hours_val}H (公称寿命${SSD_PENALTY.hourBenchmark}H超)`
            );
        }
    };

    // NVMe判定（percentage_used / available_spare / critical_warning 重視）
    const judgeNvme = (nvmeLog, add) => {
        const pctUsed = Number(nvmeLog?.percentage_used);
        const availSpare = Number(nvmeLog?.available_spare);
        const criticalWarning = Number(nvmeLog?.critical_warning) || 0;
        const mediaErrors = Number(nvmeLog?.media_errors) || 0;

        if (criticalWarning !== 0)
            add(
                NVME_PENALTY.criticalWarning,
                `critical_warning=0x${criticalWarning.toString(16)}`
            );
        if (mediaErrors > 0)
            add(
                mediaErrors * NVME_PENALTY.mediaErrorPerCount,
                `media_errors=${mediaErrors}`
            );
        if (
            !Number.isNaN(pctUsed) &&
            pctUsed >= NVME_PENALTY.pctUsedCriticalThreshold
        ) {
            add(
                (pctUsed - NVME_PENALTY.pctUsedCriticalThreshold) *
                    NVME_PENALTY.pctUsedPerPoint +
                    NVME_PENALTY.pctUsedCritical,
                `percentage_used=${pctUsed}% (>=${NVME_PENALTY.pctUsedCriticalThreshold})`
            );
        }
        if (!Number.isNaN(availSpare)) {
            if (availSpare <= NVME_PENALTY.availSpareCritical)
                add(
                    NVME_PENALTY.availSpareLow,
                    `available_spare=${availSpare}% (<=${NVME_PENALTY.availSpareCritical})`
                );
            if (
                availSpare > NVME_PENALTY.availSpareCritical &&
                availSpare <= NVME_PENALTY.availSpareWarnMax
            ) {
                add(
                    (NVME_PENALTY.availSpareWarnMax - availSpare) *
                        NVME_PENALTY.availSpareWarnPerPoint,
                    `available_spare=${availSpare}% (${NVME_PENALTY.availSpareCritical + 1}-${NVME_PENALTY.availSpareWarnMax})`
                );
            }
        }
    };

    // スコアから7段階レベルへ変換（LEVEL_SCORE_MAX の上限で二分探索相当の線形判定）
    const levelFromScore = (score) => {
        for (let lv = 0; lv < LEVEL_SCORE_MAX.length; lv++) {
            if (score <= LEVEL_SCORE_MAX[lv]) return lv;
        }
        return LEVEL_SCORE_MAX.length - 1;
    };

    // 種別ごとにjudgeへディスパッチ
    const dispatchByType = (data, record, add) => {
        const {
            customType,
            hours_val,
            lifePercent,
            reallocSectors,
            pendingSectors,
            crcErrors,
            tbw_val
        } = record;
        const table = data.ata_smart_attributes?.table || [];
        const errs = parseErrorDescriptions(data.ata_smart_error_log?.summary);
        const ctx = {
            table,
            hours_val,
            lifePercent,
            reallocSectors,
            pendingSectors,
            crcErrors,
            tbw_val,
            errs
        };

        if (customType === 'nvme') {
            judgeNvme(data.nvme_smart_health_information_log, add);
            return;
        }
        if (customType === 'sata-ssd' || customType === 'emmc') {
            judgeSataSsd(ctx, add);
            return;
        }
        // hdd-25 / hdd-35 / sshd / unknown は HDD ロジック
        judgeHdd(ctx, add);
    };

    // 公開API: record から深刻度スコアと理由を算出
    const computeSeverityScore = (data, record) => {
        const { add, getScore, getReasons } = makeScorer();
        if (record.health === 'FAILED') {
            add(FAILED_PENALTY, 'S.M.A.R.T. 総合判定 = FAILED');
            return { score: getScore(), reasons: getReasons() };
        }
        dispatchByType(data, record, add);
        return { score: getScore(), reasons: getReasons() };
    };

    // 公開API: レベルと理由とスコアを返す（levelはscoreから導出）
    const computeHealthLevel = (data, record) => {
        const { score, reasons } = computeSeverityScore(data, record);
        return { level: levelFromScore(score), reasons, score };
    };

    const HEALTH_LOGIC = {
        computeHealthLevel,
        computeSeverityScore,
        levelFromScore,
        parseErrorDescriptions,
        judgeHdd,
        judgeSataSsd,
        judgeNvme
    };

    factory(root, HEALTH_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.HEALTH_LOGIC = mod;
    }
});
