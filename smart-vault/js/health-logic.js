// 劣化度4段階判定の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.HEALTH_LOGIC にエクスポート
// Node: module.exports にエクスポート
// ※ getAttrRaw は PARSE_LOGIC に依存

((root, factory) => {

    const PARSE_LOGIC = (typeof window !== 'undefined' ? window.PARSE_LOGIC : null)
        || (typeof require === 'function' ? require('./parse-logic.js') : null);
    const getAttrRaw = PARSE_LOGIC.getAttrRaw;

    // level と reasons を更新するヘルパを生成
    const makeRaiser = () => {
        let level = 0;
        const reasons = [];
        const raise = (lv, reason) => {
            if (lv > level) level = lv;
            if (!reasons.includes(reason)) reasons.push(reason);
        };
        return {
            raise,
            getResult: () => {
                if (level === 0) reasons.push('判定基準に該当なし');
                return { level, reasons };
            }
        };
    };

    // エラーログの概要から件数とエラー種別フラグを抽出
    const parseErrorDescriptions = (errSummary) => {
        const errCount = Number(errSummary?.count) || 0;
        const descs = (errSummary?.table || [])
            .map(e => (e.error_description || '').toUpperCase())
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
    const judgeHdd = (ctx, raise) => {
        const { table, hours_val, reallocSectors, pendingSectors, crcErrors, errs } = ctx;
        const offlineUncorrectable = getAttrRaw(table, 198);
        const commandTimeout = getAttrRaw(table, 188);

        if (pendingSectors > 0) raise(3, `保留中セクタ(197)=${pendingSectors}`);
        if (offlineUncorrectable > 0) raise(3, `回復不能セクタ(198)=${offlineUncorrectable}`);
        if (reallocSectors >= 1) raise(3, `代替処理済セクタ(5)=${reallocSectors}`);
        if (errs.hasUNC) raise(3, `エラーログにUNC検出 (${errs.errCount}件)`);
        if (errs.hasIDNF) raise(3, 'エラーログにIDNF検出');

        if (hours_val >= 30000) raise(2, `通電時間=${hours_val}H (>=30000)`);

        if (crcErrors > 0) raise(1, `UDMA_CRC(199)=${crcErrors}`);
        if (commandTimeout > 0) raise(1, `Command_Timeout(188)=${commandTimeout}`);
        if ((errs.hasICRC || errs.hasABRT) && !errs.hasUNC && !errs.hasIDNF) {
            raise(1, `エラーログにICRC/ABRT (${errs.errCount}件)`);
        }
    };

    // SATA-SSD判定（書込寿命・予備ブロック重視）
    const judgeSataSsd = (ctx, raise) => {
        const { hours_val, lifePercent, crcErrors } = ctx;

        if (lifePercent >= 0 && lifePercent <= 10) raise(3, `残り寿命=${lifePercent}% (<=10)`);
        const reserved = (ctx.table || []).find(a => a.id === 232 || a.id === 233);
        if (reserved && reserved.thresh !== undefined && Number(reserved.value) < Number(reserved.thresh)) {
            raise(3, `予備ブロック(ID${reserved.id})がしきい値下回り`);
        }
        if (lifePercent > 10 && lifePercent <= 50) raise(2, `残り寿命=${lifePercent}% (11-50)`);
        if (hours_val >= 40000) raise(2, `通電時間=${hours_val}H (>=40000)`);
        if (crcErrors > 0) raise(1, `UDMA_CRC(199)=${crcErrors}`);
        if (hours_val > 200000) raise(1, `通電時間異常値=${hours_val}H`);
    };

    // NVMe判定（percentage_used / available_spare / critical_warning 重視）
    const judgeNvme = (nvmeLog, raise) => {
        const pctUsed = Number(nvmeLog?.percentage_used);
        const availSpare = Number(nvmeLog?.available_spare);
        const criticalWarning = Number(nvmeLog?.critical_warning) || 0;
        const mediaErrors = Number(nvmeLog?.media_errors) || 0;

        if (pctUsed >= 90) raise(3, `percentage_used=${pctUsed}% (>=90)`);
        if (!Number.isNaN(availSpare) && availSpare <= 10) raise(3, `available_spare=${availSpare}% (<=10)`);
        if (criticalWarning !== 0) raise(3, `critical_warning=0x${criticalWarning.toString(16)}`);
        if (pctUsed >= 50 && pctUsed < 90) raise(2, `percentage_used=${pctUsed}% (50-89)`);
        if (!Number.isNaN(availSpare) && availSpare > 10 && availSpare <= 50) raise(2, `available_spare=${availSpare}% (11-50)`);
        if (mediaErrors > 0) raise(1, `media_errors=${mediaErrors}`);
    };

    // 種別ごとにjudgeへディスパッチ
    const dispatchByType = (data, record, raise) => {
        const { customType, hours_val, lifePercent, reallocSectors, pendingSectors, crcErrors } = record;
        const table = data.ata_smart_attributes?.table || [];
        const errs = parseErrorDescriptions(data.ata_smart_error_log?.summary);
        const ctx = { table, hours_val, lifePercent, reallocSectors, pendingSectors, crcErrors, errs };

        if (customType === 'nvme') {
            judgeNvme(data.nvme_smart_health_information_log, raise);
            return;
        }
        if (customType === 'sata-ssd' || customType === 'emmc') {
            judgeSataSsd(ctx, raise);
            return;
        }
        // hdd-25 / hdd-35 / sshd / unknown は HDD ロジック
        judgeHdd(ctx, raise);
    };

    // 公開API: record から4段階レベルと理由を算出
    const computeHealthLevel = (data, record) => {
        if (record.health === 'FAILED') {
            return { level: 3, reasons: ['S.M.A.R.T. 総合判定 = FAILED'] };
        }
        const { raise, getResult } = makeRaiser();
        dispatchByType(data, record, raise);
        return getResult();
    };

    const HEALTH_LOGIC = {
        computeHealthLevel,
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
