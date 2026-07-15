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
            return newValue
                ? newValue
                      .split(/\n/)
                      .map((s) => s.trim())
                      .filter((s) => s !== '')
                : [];
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

    // フォーム入力と既存レコードから新しい系統レコードを組み立てる
    const createHorse = (input, horses, id) => {
        const maxOrder =
            horses.length > 0
                ? Math.max(...horses.map((horse) => horse.order))
                : 0;
        return {
            id,
            order: maxOrder + 1,
            name: input.name,
            birthYear: input.birthYear ? parseInt(input.birthYear, 10) : '',
            horseName: input.horseName || '種牡馬',
            otherHorseNames: [],
            isRunner: true
        };
    };

    // 指定IDの系統を除外した新しい配列を返す
    const removeHorse = (horses, id) =>
        horses.filter((horse) => horse.id !== id);

    // 指定IDの系統の1項目だけを非破壊で更新する
    const updateHorseValue = (horses, id, key, value) => {
        return horses.map((horse) =>
            horse.id === id ? { ...horse, [key]: value } : horse
        );
    };

    // 年齢条件を満たす場合だけ指定系統の現役状態を反転する
    const toggleHorseRunner = (horses, id, currentYear) => {
        const horse = horses.find((item) => item.id === id);
        if (!horse) return horses;
        const age = calcAge(horse, currentYear);
        if (age !== null && age >= STALLION_AGE_THRESHOLD) return horses;
        return updateHorseValue(horses, id, 'isRunner', !horse.isRunner);
    };

    // ヘッダクリック後のソート状態を返す
    const getNextSortState = (sortState, key) => {
        if (sortState.key === key) return { key, asc: !sortState.asc };
        return { key, asc: true };
    };

    // 指定列と方向で系統を非破壊に並べ替える
    const sortHorses = (horses, key, asc) => {
        return [...horses].sort((a, b) => {
            const valA = a[key];
            const valB = b[key];
            const emptyA = valA === '' || valA === null || valA === undefined;
            const emptyB = valB === '' || valB === null || valB === undefined;
            if (emptyA || emptyB) {
                if (emptyA && emptyB) return 0;
                if (emptyA) return asc ? 1 : -1;
                return asc ? -1 : 1;
            }
            if (typeof valA === 'string' || typeof valB === 'string') {
                const comparison = String(valA).localeCompare(
                    String(valB),
                    'ja'
                );
                return asc ? comparison : -comparison;
            }
            return asc ? valA - valB : valB - valA;
        });
    };

    // 指定位置へ移動し、表示順に合わせてorderを連番へ振り直す
    const reorderHorses = (horses, oldIndex, newIndex) => {
        const reordered = [...horses];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        return reordered.map((horse, index) => ({
            ...horse,
            order: index + 1
        }));
    };

    // ゲーム内年の前年以降に誕生する史実馬を年別グループに整形する
    const listHistoricalHorseGroups = (masterHorseData, currentGameYear) => {
        const filterYear = currentGameYear - 1;
        return Object.keys(masterHorseData)
            .map(Number)
            .filter((year) => year >= filterYear)
            .sort((a, b) => a - b)
            .map((year) => ({ year, horses: [...masterHorseData[year]] }));
    };

    // 読み込んだデータが最低限の系統レコード配列かを判定する
    const isValidHorseList = (data) => {
        return (
            Array.isArray(data) &&
            data.every(
                (horse) =>
                    horse &&
                    typeof horse.id !== 'undefined' &&
                    typeof horse.name !== 'undefined'
            )
        );
    };

    // 手動順が表示されているかを判定する
    const isManualSort = (sortState) =>
        sortState.key === 'order' && sortState.asc;

    const HORSE_LOGIC = {
        STALLION_AGE_THRESHOLD,
        calcAge,
        isStallion,
        parseEditValue,
        getEditOriginalValue,
        createHorse,
        removeHorse,
        updateHorseValue,
        toggleHorseRunner,
        getNextSortState,
        sortHorses,
        reorderHorses,
        listHistoricalHorseGroups,
        isValidHorseList,
        isManualSort
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
