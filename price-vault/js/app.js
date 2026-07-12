// ============================================================
// 定数
// ============================================================

// タイムアウト（ミリ秒）
const TIMING = {
    TOAST_DURATION: 2500
};

// バックアップファイル名・カテゴリ新規追加のセンチネル値
const BACKUP_FILENAME = 'price-vault.json';
const NEW_CATEGORY_VALUE = '__new_category__';
const UNCATEGORIZED = '未分類';

// トーストメッセージ
const TOAST = {
    SAVED: '商品を登録しました',
    UPDATED: '履歴を追加しました',
    INPUT_INVALID: 'エラー: 商品名・値段・日付は必須です',
    HISTORY_UPDATED: '履歴を更新しました',
    DELETED: '記録を削除しました',
    IMPORTED: 'バックアップからデータを復元しました',
    IMPORT_FAIL: 'エラー: 不正なファイル構造です',
    SAVED_FILE: 'ファイルを保存しました',
    SAVE_FAIL: 'エラー: 保存に失敗しました'
};

// View/Events に渡す固定定数
const VIEW_CONSTANTS = {
    TIMING,
    UNCATEGORIZED,
    NEW_CATEGORY_VALUE,
    BACKUP_FILENAME
};

// 今日の日付を YYYY-MM-DD で返す
const todayStr = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

// ============================================================
// モジュールのインポート
// ============================================================

const { bindEvents, refreshDataView } = window.PRICE_EVENTS;

// ============================================================
// D&D 初期化
// ============================================================

const initDragAndDrop = (onEnd) => {
    const tbody = document.getElementById('storageTbody');
    Sortable.create(tbody, {
        animation: 150,
        draggable: '.item-row',
        filter: '.details-row, button, input, select',
        preventOnFilter: false,
        onEnd
    });
};

// ============================================================
// 初期化
// ============================================================

const initApp = () => {
    document.getElementById('inputDate').value = todayStr();
    const { handlers, saveNewOrder: onSortEnd } = bindEvents(VIEW_CONSTANTS, TOAST);
    refreshDataView(VIEW_CONSTANTS, handlers);
    initDragAndDrop(onSortEnd);
};

// ============================================================
// IndexedDB 初期化（準備完了後に initApp を呼ぶ）
// ============================================================

window.PRICE_DB.open(initApp);
