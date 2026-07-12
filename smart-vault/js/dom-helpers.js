// DOM要素生成ヘルパ（状態非依存の純粋関数。ブラウザ/Node両方で利用）
// ブラウザ: window.DOM_HELPERS にエクスポート
// Node: module.exports にエクスポート
// ※ document.createElement を使うが、状態(localStorage/IndexedDB/Date.now)に依存せず
//    引数のみから要素を生成するため純粋関数モジュールとして切り出す

((root, factory) => {

    // 編集可能セル（clickable-cell）を生成。onEdit: クリック時に呼ぶコールバック（app.js から注入）
    const createEditableCell = (text, onEdit) => {
        const cell = document.createElement('div');
        cell.className = 'clickable-cell';
        cell.innerText = text;
        cell.addEventListener('click', onEdit);
        return cell;
    };

    // 通電時間 / 電源回数の表示文字列（未入力項目は省略、両方未入力なら空）
    const formatHoursCycle = (powerOnHours, powerCycleCount) => {
        const hasHours = powerOnHours && powerOnHours !== '不明';
        const cycleNum = typeof powerCycleCount === 'number' ? powerCycleCount : 0;
        const hasCycle = typeof powerCycleCount === 'number' && cycleNum > 0;
        if (hasHours && hasCycle) return `${powerOnHours} / ${cycleNum}回`;
        if (hasHours) return powerOnHours;
        if (hasCycle) return `${cycleNum}回`;
        return '';
    };

    // 状態レベルバッジを生成: L番号 + Score 融合表示（手動登録は青バッジ「手動」）
    const createLevelBadge = (item) => {
        const badge = document.createElement('span');
        if (item.isManual) {
            badge.className = 'level-badge level-manual';
            badge.innerText = '手動';
            return badge;
        }
        const hl = item.healthLevel ?? 0;
        badge.className = `level-badge level-${hl}`;
        badge.title = item.healthReasons.join('\n');
        badge.innerText = `L${hl} ${item.severityScore ?? 0}`;
        return badge;
    };

    // メモセルを生成。onEditMemo: クリック時に呼ぶコールバック（app.js の enableTextEdit を注入）
    const createMemoCell = (item, onEditMemo) => {
        const td = document.createElement('td');
        const memoCell = document.createElement('div');
        memoCell.className = 'clickable-cell';
        if (item.memo) {
            memoCell.innerText = item.memo;
        } else {
            const ph = document.createElement('span');
            ph.className = 'memo-placeholder';
            ph.innerText = 'クリックして入力';
            memoCell.appendChild(ph);
        }
        memoCell.addEventListener('click', () => onEditMemo(item.id, memoCell, 'memo'));
        td.appendChild(memoCell);
        return td;
    };

    // 詳細グリッドに「ラベル: 値」のフィールドを追加
    const appendDetailField = (grid, label, value) => {
        const div = document.createElement('div');
        const strong = document.createElement('strong');
        strong.innerText = label + ': ';
        div.appendChild(strong);
        div.append(value);
        grid.appendChild(div);
    };

    // 判定理由1行をノード配列に変換: 既知キーワードはツールチップ付きspanに、それ以外はテキストに
    // glossary: app.js の REASON_GLOSSARY を引数で注入（ドメイン知識を dom-helpers に持ち込まない）
    const createReasonNodes = (reason, glossary) => {
        const nodes = [];
        let rest = reason;
        while (rest.length > 0) {
            // 出現位置が最も早いキーワードを探す
            const match = glossary
                .map(g => ({ g, idx: rest.indexOf(g.key) }))
                .filter(m => m.idx !== -1)
                .sort((a, b) => a.idx - b.idx)[0];
            if (!match) {
                nodes.push(document.createTextNode(rest));
                break;
            }
            if (match.idx > 0) {
                nodes.push(document.createTextNode(rest.slice(0, match.idx)));
            }
            const span = document.createElement('span');
            span.className = 'reason-keyword';
            span.tabIndex = 0;
            span.title = match.g.desc;
            span.innerText = match.g.key;
            nodes.push(span);
            rest = rest.slice(match.idx + match.g.key.length);
        }
        return nodes;
    };

    // 詳細グリッドに判定理由ブロックを追加（右端に消去ボタンを配置）
    // glossary: createReasonNodes に渡す REASON_GLOSSARY（app.js から注入）
    const appendReasonsBlock = (grid, reasons, actionBtn, glossary) => {
        const div = document.createElement('div');
        div.className = 'reason-block';
        // ラベル行（ラベル左詰め、ボタン右詰め）
        const header = document.createElement('div');
        header.className = 'reason-header';
        const strong = document.createElement('strong');
        strong.innerText = '判定理由:';
        header.appendChild(strong);
        if (actionBtn) header.appendChild(actionBtn);
        div.appendChild(header);
        // 理由本文（各理由を1行に、キーワードはツールチップ付きspanに）
        const body = document.createElement('span');
        reasons.forEach((reason, i) => {
            if (i > 0) body.appendChild(document.createElement('br'));
            body.append(document.createTextNode('・'));
            createReasonNodes(reason, glossary).forEach(node => body.appendChild(node));
        });
        div.appendChild(body);
        grid.appendChild(div);
    };

    // 0件時の行: メッセージ＋新規追加ボタン
    // onAddManual: 新規追加ボタン押下時に呼ぶコールバック（app.js の addManualRecordToEnd を注入）
    const createEmptyRow = (onAddManual) => {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 11;
        td.style.cssText = 'text-align:center; color:#a0aec0; padding:30px;';

        const msg = document.createElement('span');
        msg.innerText = '該当するディスクがありません。';
        td.appendChild(msg);

        const btn = document.createElement('button');
        btn.className = 'btn-add-empty';
        btn.innerText = '＋ 新規追加';
        btn.addEventListener('click', () => onAddManual());
        td.appendChild(btn);

        tr.appendChild(td);
        return tr;
    };

    const DOM_HELPERS = {
        createEditableCell,
        formatHoursCycle,
        createLevelBadge,
        createMemoCell,
        appendDetailField,
        createReasonNodes,
        appendReasonsBlock,
        createEmptyRow
    };

    factory(root, DOM_HELPERS);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.DOM_HELPERS = mod;
    }
});
