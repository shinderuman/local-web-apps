const { test } = require('node:test');
const assert = require('node:assert');
const {
    serializeUIState,
    deserializeUIState
} = require('../js/ui-logic.js');

// ============================================================
// serializeUIState
// ============================================================

test('serializeUIState: 状態オブジェクトをJSON文字列化', () => {
    const state = {
        windowId: 1,
        groupId: 2,
        sortKey: 'title',
        sortAsc: false,
        addPositionTop: false,
        selectedGroupByWindow: { 1: 10 }
    };
    const json = serializeUIState(state);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.windowId, 1);
    assert.strictEqual(parsed.groupId, 2);
    assert.strictEqual(parsed.sortKey, 'title');
    assert.strictEqual(parsed.sortAsc, false);
    assert.strictEqual(parsed.addPositionTop, false);
    assert.deepStrictEqual(parsed.selectedGroupByWindow, { 1: 10 });
});

test('serializeUIState: null値も保持', () => {
    const state = { windowId: null, groupId: null, sortKey: 'sortOrder', sortAsc: true, addPositionTop: true, selectedGroupByWindow: {} };
    const json = serializeUIState(state);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.windowId, null);
    assert.strictEqual(parsed.groupId, null);
});

// ============================================================
// deserializeUIState
// ============================================================

test('deserializeUIState: 全フィールド存在ならそのまま復元', () => {
    const json = JSON.stringify({
        windowId: 1, groupId: 2, sortKey: 'title', sortAsc: false, addPositionTop: false, selectedGroupByWindow: { 1: 10 }
    });
    const state = deserializeUIState(json);
    assert.strictEqual(state.windowId, 1);
    assert.strictEqual(state.groupId, 2);
    assert.strictEqual(state.sortKey, 'title');
    assert.strictEqual(state.sortAsc, false);
    assert.strictEqual(state.addPositionTop, false);
    assert.deepStrictEqual(state.selectedGroupByWindow, { 1: 10 });
});

test('deserializeUIState: フィールド欠落時はデフォルト', () => {
    const json = '{}';
    const state = deserializeUIState(json);
    assert.strictEqual(state.windowId, null);
    assert.strictEqual(state.groupId, null);
    assert.strictEqual(state.sortKey, 'sortOrder');
    assert.strictEqual(state.sortAsc, true);
    assert.strictEqual(state.addPositionTop, true);
    assert.deepStrictEqual(state.selectedGroupByWindow, {});
    assert.strictEqual(state.dupCheckEnabled, false);
    assert.strictEqual(state.dupCheckLength, 6);
});

test('deserializeUIState: 重複チェック設定があれば復元', () => {
    const json = JSON.stringify({ dupCheckEnabled: true, dupCheckLength: 4 });
    const state = deserializeUIState(json);
    assert.strictEqual(state.dupCheckEnabled, true);
    assert.strictEqual(state.dupCheckLength, 4);
});

test('deserializeUIState: 無効JSONならnull', () => {
    const state = deserializeUIState('not json');
    assert.strictEqual(state, null);
});

test('deserializeUIState: 空文字ならnull', () => {
    const state = deserializeUIState('');
    assert.strictEqual(state, null);
});
