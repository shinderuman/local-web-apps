// 期間指定のシリアライズ/デシリアライズ純粋関数（ブラウザ/Node両方で利用）

((root, factory) => {
    // YYYY-MM 形式として有効な月文字列かを判定する
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

    // 期間指定オブジェクトをJSON文字列にシリアライズ
    const serializePeriod = (period) => {
        return JSON.stringify(period);
    };

    // JSON文字列から期間指定を復元。無効JSONや空文字はnull
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
