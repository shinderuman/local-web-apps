// localStorage アクセス層（CRUD とキー管理）。ブラウザ/Node両方で利用
// ブラウザ: window.WP_DB にエクスポート
// Node: module.exports にエクスポート
// ※ localStorage のキー定義と読み書きを集約し、app.js がキー文字列を意識しないようにする

((root, factory) => {

    // localStorage の保存キー
    const STORAGE_KEYS = {
        HORSES: 'horse_data_ordered_v7',
        GAME_YEAR: 'game_year_v3',
        SCHEDULE: 'schedule_checkbox_states_v1'
    };

    // section表示状態の保存キー接尾辞（{sectionId}_visible）
    const VISIBLE_SUFFIX = '_visible';

    // 系統データを読込
    const loadHorses = () => {
        const saved = localStorage.getItem(STORAGE_KEYS.HORSES);
        return saved ? JSON.parse(saved) : [];
    };

    // 系統データを保存
    const saveHorses = (horses) => {
        localStorage.setItem(STORAGE_KEYS.HORSES, JSON.stringify(horses));
    };

    // ゲーム内年を読込（無ければ null）
    const loadGameYear = () => {
        const saved = localStorage.getItem(STORAGE_KEYS.GAME_YEAR);
        return saved ? parseInt(saved, 10) : null;
    };

    // ゲーム内年を保存
    const saveGameYear = (year) => {
        localStorage.setItem(STORAGE_KEYS.GAME_YEAR, year);
    };

    // スケジュールのチェックボックス状態を読込
    const loadScheduleState = () => {
        const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
        return saved ? JSON.parse(saved) : null;
    };

    // スケジュールのチェックボックス状態を保存
    const saveScheduleState = (state) => {
        localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(state));
    };

    // section表示状態を読込
    const loadSectionVisible = (sectionId) => {
        return localStorage.getItem(sectionId + VISIBLE_SUFFIX) === 'true';
    };

    // section表示状態を保存
    const saveSectionVisible = (sectionId, visible) => {
        localStorage.setItem(sectionId + VISIBLE_SUFFIX, visible);
    };

    const WP_DB = {
        STORAGE_KEYS,
        loadHorses,
        saveHorses,
        loadGameYear,
        saveGameYear,
        loadScheduleState,
        saveScheduleState,
        loadSectionVisible,
        saveSectionVisible
    };

    factory(root, WP_DB);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.WP_DB = mod;
    }
});
