// S.M.A.R.T. JSON パース関連の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.PARSE_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // ATA属性テーブルからID指定でraw値を数値化（無ければ0）
    const getAttrRaw = (table, id) => {
        const a = (table || []).find(x => x.id === id);
        return a ? Number(a.raw?.value || 0) : 0;
    };

    // ドットパスで値を取得
    const getByPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

    // 第一候補 → NVMeフォールバック → デフォルト の数値取得
    const pickNum = (data, primaryPath, nvmePath, fallback) => {
        const primary = getByPath(data, primaryPath);
        if (primary !== undefined) return Number(primary);
        const nvme = getByPath(data, nvmePath);
        if (nvme !== undefined) return Number(nvme);
        return fallback;
    };

    // モデル名からサイズを推定（capacityBytes=0時のフォールバック）
    const estimateSizeFromModel = (model) => {
        const match = model.match(/(\d+)(Z|G|T)/i);
        if (!match) return { sizeStr: '不明', sizeBytes: 0 };
        const unit = match[2].toUpperCase();
        const num = parseInt(match[1]);
        if (unit === 'G' || unit === 'Z') {
            return { sizeStr: num + ' GB', sizeBytes: num * 1000 * 1000 * 1000 };
        }
        if (unit === 'T') {
            return { sizeStr: num + ' TB', sizeBytes: num * 1000 * 1000 * 1000 * 1000 };
        }
        return { sizeStr: '不明', sizeBytes: 0 };
    };

    // 容量表示を算出（user_capacity優先、モデル名フォールバック）
    const calcSize = (model, capacityBytes) => {
        if (capacityBytes > 0) {
            const gb = capacityBytes / (1000 * 1000 * 1000);
            const sizeStr = gb >= 1000 ? (gb / 1000).toFixed(1) + ' TB' : Math.round(gb) + ' GB';
            return { sizeStr, sizeBytes: capacityBytes };
        }
        return estimateSizeFromModel(model);
    };

    // 総書込量（TB）を算出
    const calcTbw = (data) => {
        const nvmeLog = data.nvme_smart_health_information_log;
        if (nvmeLog?.data_units_written !== undefined) {
            return (Number(nvmeLog.data_units_written) * 512000) / (1000 * 1000 * 1000 * 1000);
        }
        const attr241 = data.ata_smart_attributes?.table?.find(a => a.id === 241);
        if (attr241 && attr241.raw?.value) {
            return (Number(attr241.raw.value) / 2) / 1000;
        }
        return 0;
    };

    // 残り寿命を算出（lifePercent + 表示用 lifeOrSector）
    const calcLife = (data) => {
        if (data.endurance_used?.current_percent !== undefined) {
            const lifePercent = 100 - Number(data.endurance_used.current_percent);
            return { lifePercent, lifeOrSector: '寿命: ' + lifePercent + '%' };
        }
        if (data.nvme_smart_health_information_log?.percentage_used !== undefined) {
            const lifePercent = 100 - Number(data.nvme_smart_health_information_log.percentage_used);
            return { lifePercent, lifeOrSector: '寿命: ' + lifePercent + '%' };
        }
        const table = data.ata_smart_attributes?.table;
        if (table) {
            const attrLife = table.find(a => a.id === 232 || a.id === 233 || a.id === 202);
            if (attrLife) {
                const lifePercent = Number(attrLife.value);
                return { lifePercent, lifeOrSector: '寿命: ' + lifePercent + '%' };
            }
            const attr5 = table.find(a => a.id === 5);
            if (attr5) {
                const count = attr5.raw?.value || 0;
                const lifeOrSector = count > 0 ? `<span class="bad-count">代替: ${count}</span>` : '代替: 0';
                return { lifePercent: -1, lifeOrSector };
            }
        }
        return { lifePercent: -1, lifeOrSector: '不明' };
    };

    // ATA属性から代替/保留/CRCの個数を抽出（無い場合は-1）
    const calcSectorCounts = (data) => {
        const table = data.ata_smart_attributes?.table;
        if (!table) {
            return {
                reallocSectors: data.nvme_smart_health_information_log?.media_errors !== undefined
                    ? Number(data.nvme_smart_health_information_log.media_errors)
                    : -1,
                pendingSectors: -1,
                crcErrors: -1
            };
        }
        const result = { reallocSectors: -1, pendingSectors: -1, crcErrors: -1 };
        const attr5 = table.find(a => a.id === 5);
        const attr197 = table.find(a => a.id === 197);
        const attr199 = table.find(a => a.id === 199);
        if (attr5) result.reallocSectors = Number(attr5.raw?.value || 0);
        if (attr197) result.pendingSectors = Number(attr197.raw?.value || 0);
        if (attr199) result.crcErrors = Number(attr199.raw?.value || 0);
        return result;
    };

    // プロトコル/モデル名/デバイスタイプから customType を推定（既存値優先）
    const detectCustomType = (protocol, model, deviceType, existingType) => {
        if (existingType) return existingType;
        const p = (protocol || '').toLowerCase();
        const m = (model || '').toLowerCase();
        const t = (deviceType || '').toLowerCase();
        if (p.includes('nvme')) return 'nvme';
        if (m.includes('emmc')) return 'emmc';
        if (m.includes('sshd') || t.includes('sshd')) return 'sshd';
        if (m.includes('ssd')) return 'sata-ssd';
        return 'unknown';
    };

    const PARSE_LOGIC = {
        getAttrRaw,
        pickNum,
        calcSize,
        calcTbw,
        calcLife,
        calcSectorCounts,
        detectCustomType
    };

    factory(root, PARSE_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.PARSE_LOGIC = mod;
    }
});
