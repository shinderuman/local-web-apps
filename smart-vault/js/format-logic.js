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

    const FORMAT_LOGIC = {
        formatHours,
        formatTemp,
        formatTbw,
        formatCount,
        formatPowerOnHours
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
