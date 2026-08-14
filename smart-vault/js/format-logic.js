// 表示文字列フォーマットの純粋関数
// ブラウザ: window.FORMAT_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    const formatHours = (val) => (val === 0 ? '不明' : val + ' H');

    const formatTemp = (val) => (val === 0 ? '不明' : val + ' °C');

    const formatTbw = (val) => (val === 0 ? '--' : val.toFixed(1) + ' TBW');

    const formatCount = (val) => (val >= 0 ? String(val) : '-');

    const formatPowerOnHours = (hours, cycles) => `${hours} / ${cycles}回`;

    const formatBw = (bytesPerSec) => {
        if (!bytesPerSec) return '--';
        const kib = bytesPerSec / 1024;
        if (kib < 1024) return kib.toFixed(1) + ' KiB/s';
        const mib = kib / 1024;
        if (mib < 1024) return mib.toFixed(1) + ' MiB/s';
        return (mib / 1024).toFixed(1) + ' GiB/s';
    };

    const formatIops = (iops) => {
        if (!iops) return '--';
        return Math.round(iops).toLocaleString('en-US') + ' IOPS';
    };

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
