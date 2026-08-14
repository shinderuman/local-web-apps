// 系統データ関連の純粋関数
// ブラウザ: window.HORSE_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {
    const STALLION_AGE_THRESHOLD = 10;

    const calcAge = (horse, currentYear) => {
        if (!horse.birthYear || !currentYear) return null;
        return currentYear - horse.birthYear;
    };

    const isStallion = (horse, currentYear) => {
        const age = calcAge(horse, currentYear);
        if (age !== null && age >= STALLION_AGE_THRESHOLD) return true;
        return !horse.isRunner;
    };

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

    const getEditOriginalValue = (horse, key) => {
        if (key === 'otherHorseNames') {
            return (horse.otherHorseNames || []).join('\n');
        }
        return horse[key];
    };

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

    const removeHorse = (horses, id) =>
        horses.filter((horse) => horse.id !== id);

    const updateHorseValue = (horses, id, key, value) => {
        return horses.map((horse) =>
            horse.id === id ? { ...horse, [key]: value } : horse
        );
    };

    const toggleHorseRunner = (horses, id, currentYear) => {
        const horse = horses.find((item) => item.id === id);
        if (!horse) return horses;
        const age = calcAge(horse, currentYear);
        if (age !== null && age >= STALLION_AGE_THRESHOLD) return horses;
        return updateHorseValue(horses, id, 'isRunner', !horse.isRunner);
    };

    const getNextSortState = (sortState, key) => {
        if (sortState.key === key) return { key, asc: !sortState.asc };
        return { key, asc: true };
    };

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

    const reorderHorses = (horses, oldIndex, newIndex) => {
        const reordered = [...horses];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        return reordered.map((horse, index) => ({
            ...horse,
            order: index + 1
        }));
    };

    const listHistoricalHorseGroups = (masterHorseData, currentGameYear) => {
        const filterYear = currentGameYear - 1;
        return Object.keys(masterHorseData)
            .map(Number)
            .filter((year) => year >= filterYear)
            .sort((a, b) => a - b)
            .map((year) => ({ year, horses: [...masterHorseData[year]] }));
    };

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
