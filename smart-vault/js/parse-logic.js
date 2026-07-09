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

    // 容量文字列（例: "500GB", "2 TB", "1.5tb"）をバイト数に変換（手動入力用・失敗時は0）
    const parseSizeToBytes = (text) => {
        if (!text) return 0;
        const match = String(text).trim().match(/^([\d.]+)\s*(tb|gb|mb)?/i);
        if (!match) return 0;
        const value = parseFloat(match[1]);
        if (isNaN(value)) return 0;
        const unit = (match[2] || '').toLowerCase();
        const factors = { tb: 1024 ** 4, gb: 1024 ** 3, mb: 1024 ** 2 };
        return Math.round(value * (factors[unit] || 1));
    };

    // ATA書込量属性のraw値をTBに換算（属性名の単位で係数を切替）
    const ataWriteAttrToTb = (attr) => {
        const raw = Number(attr.raw?.value || 0);
        if (!raw) return 0;
        const name = (attr.name || '').toUpperCase();
        // LBA単位（512バイト/セクタ）
        if (name.includes('LBA')) {
            return (raw * 512) / 1e12;
        }
        // 32MiB単位
        if (name.includes('32MIB')) {
            return (raw * 33554432) / 1e12;
        }
        // GiB単位（Total_Writes_GiB 等）
        return (raw * 1.073741824) / 1000;
    };

    // 総書込量（TB）を算出
    const calcTbw = (data) => {
        const nvmeLog = data.nvme_smart_health_information_log;
        if (nvmeLog?.data_units_written !== undefined) {
            return (Number(nvmeLog.data_units_written) * 512000) / 1e12;
        }
        const table = data.ata_smart_attributes?.table || [];
        // ID 241（Total_Writes_GiB / Host_Writes_32MiB / Total_LBAs_Written）を優先、なければ 246
        const attr = table.find(a => a.id === 241 && a.raw?.value)
            || table.find(a => a.id === 246 && a.raw?.value);
        return attr ? ataWriteAttrToTb(attr) : 0;
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
        }
        // 寿命情報非対応のディスクは不明（代替セクタ数は別項目で表示）
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
        parseSizeToBytes,
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
