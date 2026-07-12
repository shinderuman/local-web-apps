// 描画ヘルパ（ブラウザ/Node両方で利用）
// ブラウザ: window.WP_VIEW にエクスポート
// Node: module.exports にエクスポート
// ※ DBアクセスを行わず、データとコールバックを引数で受け取って描画のみ行う（View の純粋化）
// ※ 依存: HORSE_LOGIC / DOM_HELPERS / WP_DB（チェックボックス状態の保存・復元）

((root, factory) => {

    const HORSE_LOGIC = (typeof window !== 'undefined' ? window.HORSE_LOGIC : null)
        || (typeof require === 'function' ? require('./horse-logic.js') : null);
    const { calcAge, isStallion } = HORSE_LOGIC;
    const DOM_HELPERS = (typeof window !== 'undefined' ? window.DOM_HELPERS : null)
        || (typeof require === 'function' ? require('./dom-helpers.js') : null);
    const {
        createDragHandleCell, createOrderCell, createNameCell, createAgeCell,
        createEditableCell, createDeleteCell, attachRowEvents
    } = DOM_HELPERS;
    const WP_DB = (typeof window !== 'undefined' ? window.WP_DB : null)
        || (typeof require === 'function' ? require('./db.js') : null);

    // テーブル本体を描画。handlers: { onStartEdit, onDeleteData, onToggleRunner }
    const render = (horses, currentGameYear, handlers) => {
        const tbody = document.getElementById('horseTableBody');
        tbody.innerHTML = '';
        horses.forEach((h) => {
            const age = calcAge(h, currentGameYear) ?? '-';
            const stallion = isStallion(h, currentGameYear);
            const otherText = (h.otherHorseNames || []).join('\n');
            const tr = document.createElement('tr');
            tr.dataset.id = h.id;
            if (!stallion) tr.classList.add('runner-row');
            tr.appendChild(createDragHandleCell());
            tr.appendChild(createOrderCell(h.order));
            tr.appendChild(createNameCell(h.name));
            tr.appendChild(createAgeCell(age));
            tr.appendChild(createEditableCell(h.id, 'birthYear', h.birthYear, handlers.onStartEdit));
            tr.appendChild(createEditableCell(h.id, 'horseName', h.horseName, handlers.onStartEdit));
            tr.appendChild(createEditableCell(h.id, 'otherHorseNames', otherText, handlers.onStartEdit));
            tr.appendChild(createDeleteCell(h.id, handlers.onDeleteData));
            attachRowEvents(tr, h.id, handlers.onToggleRunner);
            tbody.appendChild(tr);
        });
    };

    // 年代別馬リストを描画（ゲーム内年-1以降の史実馬）
    const renderFilteredHorseList = (currentGameYear, masterHorseData) => {
        const targetContainer = document.getElementById('filteredHorseList');
        targetContainer.innerHTML = '';

        const filterYear = currentGameYear - 1;
        const years = Object.keys(masterHorseData).map(Number).filter(y => y >= filterYear).sort((a, b) => a - b);

        if (years.length === 0) {
            const msg = document.createElement('div');
            msg.style.color = '#666';
            msg.style.fontSize = '14px';
            msg.style.padding = '10px';
            msg.textContent = `${filterYear}年以降の該当データはありません。`;
            targetContainer.appendChild(msg);
            return;
        }

        years.forEach(year => {
            const card = document.createElement('div');
            card.className = 'year-card';

            const title = document.createElement('h4');
            title.textContent = `${year}年`;
            card.appendChild(title);

            const ul = document.createElement('ul');
            masterHorseData[year].forEach(horse => {
                const li = document.createElement('li');
                li.textContent = horse;
                ul.appendChild(li);
            });
            card.appendChild(ul);
            targetContainer.appendChild(card);
        });
    };

    // スケジュールの全checkbox状態を保存
    const saveCheckboxes = () => {
        const checkboxes = document.querySelectorAll('#scheduleSection input[type="checkbox"]');
        const state = {};
        checkboxes.forEach(cb => {
            state[cb.id] = cb.checked;
        });
        WP_DB.saveScheduleState(state);
    };

    // 保存済みのcheckbox状態を復元
    const loadCheckboxes = () => {
        const state = WP_DB.loadScheduleState();
        if (!state) return;
        Object.keys(state).forEach(id => {
            const cb = document.getElementById(id);
            if (cb) cb.checked = state[id];
        });
    };

    const WP_VIEW = {
        render,
        renderFilteredHorseList,
        saveCheckboxes,
        loadCheckboxes
    };

    factory(root, WP_VIEW);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.WP_VIEW = mod;
    }
});
