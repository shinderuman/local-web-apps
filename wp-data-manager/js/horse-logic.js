// 系統データ関連の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.HORSE_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // 種牡馬強制判定の年齢閾値
    const STALLION_AGE_THRESHOLD = 10;

    // 生年と現在年から年齢を計算。いずれかが未設定ならnull
    const calcAge = (horse, currentYear) => {
        if (!horse.birthYear || !currentYear) return null;
        return currentYear - horse.birthYear;
    };

    // 種牡馬かどうかの判定: 閾値以上は強制種牡馬、それ以外は isRunner フラグ
    const isStallion = (horse, currentYear) => {
        const age = calcAge(horse, currentYear);
        if (age !== null && age >= STALLION_AGE_THRESHOLD) return true;
        return !horse.isRunner;
    };

    // 編集入力値をhorseに反映すべき値に変換
    // birthYearは数値、otherHorseNamesは改行区切りの配列、それ以外はそのまま
    const parseEditValue = (key, newValue) => {
        if (key === 'birthYear') {
            return newValue !== '' ? parseInt(newValue, 10) : '';
        }
        if (key === 'otherHorseNames') {
            return newValue ? newValue.split(/\n/).map(s => s.trim()).filter(s => s !== '') : [];
        }
        return newValue;
    };

    // 編集セルの初期値を取得（otherHorseNamesは改行区切り文字列に変換）
    const getEditOriginalValue = (horse, key) => {
        if (key === 'otherHorseNames') {
            return (horse.otherHorseNames || []).join('\n');
        }
        return horse[key];
    };

    const HORSE_LOGIC = {
        STALLION_AGE_THRESHOLD,
        calcAge,
        isStallion,
        parseEditValue,
        getEditOriginalValue
    };

    factory(root, HORSE_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.HORSE_LOGIC = mod;
    }
});
