// UI状態のシリアライズ/デシリアライズ純粋関数（ブラウザ/Node両方で利用）

((root, factory) => {

    // UI状態オブジェクトをJSON文字列にシリアライズ
    const serializeUIState = (state) => {
        return JSON.stringify(state);
    };

    // JSON文字列からUI状態を復元。無効JSONや空文字はnull
    const deserializeUIState = (json) => {
        if (!json) return null;
        try {
            const state = JSON.parse(json);
            return {
                windowId: state.windowId ?? null,
                groupId: state.groupId ?? null,
                sortKey: state.sortKey ?? 'sortOrder',
                sortAsc: state.sortAsc ?? true,
                addPositionTop: state.addPositionTop ?? true,
                selectedGroupByWindow: state.selectedGroupByWindow ?? {},
                dupCheckEnabled: state.dupCheckEnabled ?? false,
                dupCheckLength: state.dupCheckLength ?? 6
            };
        } catch (e) {
            return null;
        }
    };

    const UI_LOGIC = {
        serializeUIState,
        deserializeUIState
    };

    factory(root, UI_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, UI_LOGIC) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = UI_LOGIC;
    }
    if (typeof window !== 'undefined') {
        window.UI_LOGIC = UI_LOGIC;
    }
});
