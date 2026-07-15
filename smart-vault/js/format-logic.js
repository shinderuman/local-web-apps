// 表示文字列フォーマットの純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.FORMAT_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // 通電時間の表示（0=不明）
    const formatHours = (val) => val === 0 ? '不明' : val + ' H';

    // 温度の表示（0=不明）
    const formatTemp = (val) => val === 0 ? '不明' : val + ' °C';

    // 総書込量の表示（0=未計測）
    const formatTbw = (val) => val === 0 ? '--' : val.toFixed(1) + ' TBW';

    // 個数表示（-1=未取得）
    const formatCount = (val) => val >= 0 ? String(val) : '-';

    // 通電時間 / 電源回数 の結合表示
    const formatPowerOnHours = (hours, cycles) => `${hours} / ${cycles}回`;

    // 帯域（byte/s）を人間可読に（KiB/MiB/GiB、小数1桁）。0=未計測
    const formatBw = (bytesPerSec) => {
        if (!bytesPerSec) return '--';
        const kib = bytesPerSec / 1024;
        if (kib < 1024) return kib.toFixed(1) + ' KiB/s';
        const mib = kib / 1024;
        if (mib < 1024) return mib.toFixed(1) + ' MiB/s';
        return (mib / 1024).toFixed(1) + ' GiB/s';
    };

    // IOPS を3桁カンマ表示。0=未計測
    const formatIops = (iops) => {
        if (!iops) return '--';
        return Math.round(iops).toLocaleString('en-US') + ' IOPS';
    };

    // レイテンシ（ns）を人間可読に（us/ms）。0=未計測
    const formatLatency = (ns) => {
        if (!ns) return '--';
        const us = ns / 1000;
        if (us < 1000) return us.toFixed(1) + ' us';
        return (us / 1000).toFixed(1) + ' ms';
    };

    const FORMAT_LOGIC = {
        formatHours,
        formatTemp,
        formatTbw,
        formatCount,
        formatPowerOnHours,
        formatBw,
        formatIops,
        formatLatency
    };

    factory(root, FORMAT_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.FORMAT_LOGIC = mod;
    }
});
