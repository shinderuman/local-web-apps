// 期間指定のシリアライズ/デシリアライズ純粋関数
// ブラウザ: window.PERIOD_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    const isValidMonth = (value) => {
        if (typeof value !== 'string') {
            return false;
        }

        const match = value.match(/^(\d{4})-(\d{2})$/);
        if (!match) {
            return false;
        }

        const month = Number(match[2]);

        return month >= 1 && month <= 12;
    };

    const serializePeriod = (period) => {
        return JSON.stringify(period);
    };

    const deserializePeriod = (json, fallbackMonth) => {
        if (!json) {
            return null;
        }

        try {
            const state = JSON.parse(json);
            return {
                mode: state.mode === 'range' ? 'range' : 'monthly',
                month: isValidMonth(state.month) ? state.month : fallbackMonth,
                rangeStart: isValidMonth(state.rangeStart)
                    ? state.rangeStart
                    : null,
                rangeEnd: isValidMonth(state.rangeEnd) ? state.rangeEnd : null
            };
        } catch (error) {
            console.error('期間指定の復元に失敗しました:', error);
            return null;
        }
    };

    const PERIOD_LOGIC = {
        serializePeriod,
        deserializePeriod
    };

    factory(root, PERIOD_LOGIC);
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    (root, PERIOD_LOGIC) => {
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = PERIOD_LOGIC;
        }
        if (typeof window !== 'undefined') {
            window.PERIOD_LOGIC = PERIOD_LOGIC;
        }
    }
);
