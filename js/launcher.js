// ルートランチャーページのアプリ一覧描画・取得ロジック。
// - file:// 運用: apps.js（ビルド生成マニフェスト, window.APPS）で即時描画する。
// - http(s) サーバー運用（autoindex 有効）: 起動後にルートディレクトリ一覧を fetch し、
//   実行時にアプリ一覧を組み立てて最新化する（アプリ追加時の手作業ゼロ）。

const APP_LIST_EL = document.getElementById('app-list');
const MESSAGE_EL = document.getElementById('launcher-message');

// autoindex 候補から除外する非アプリディレクトリ
const NON_APP_DIRS = [
    'node_modules',
    '.git',
    '.claude',
    'css',
    'js',
    'scripts'
];

// エントリポイント: マニフェストで即時描画し、http(s) の場合は非同期で最新化する
const initLauncher = () => {
    const apps = window.APPS || [];
    if (apps.length === 0) {
        showMessage(
            'アプリ一覧を取得できませんでした。node scripts/build-apps.js で apps.js を再生成してください。'
        );
        return;
    }
    renderApps(apps);
    if (location.protocol === 'http:' || location.protocol === 'https:') {
        refreshLive();
    }
};

// メッセージ領域にテキストを表示する
const showMessage = (text) => {
    MESSAGE_EL.textContent = text;
    MESSAGE_EL.hidden = false;
};

// アプリ一覧をカードとして描画する
const renderApps = (apps) => {
    APP_LIST_EL.innerHTML = '';
    for (const app of apps) {
        const link = document.createElement('a');
        link.href = app.path;
        link.className = 'app-link';
        const title = document.createElement('span');
        title.className = 'app-title';
        title.textContent = app.title;
        const id = document.createElement('span');
        id.className = 'app-id';
        id.textContent = app.id;
        link.appendChild(title);
        link.appendChild(id);
        const card = document.createElement('li');
        card.className = 'app-card';
        card.appendChild(link);
        APP_LIST_EL.appendChild(card);
    }
};

// http(s) の場合にアプリ一覧を実行時取得で最新化する（失敗時はベース描画を維持）
const refreshLive = async () => {
    try {
        const live = await fetchAppsLive();
        if (live.length > 0) {
            renderApps(live);
        }
    } catch (err) {
        console.error('live refresh skipped:', err);
    }
};

// http(s) 時: ルートの autoindex を取得し、実行時にアプリ一覧を組み立てる
const fetchAppsLive = async () => {
    const res = await fetch('./');
    if (!res.ok) {
        throw new Error('autoindex fetch failed: ' + res.status);
    }
    const html = await res.text();
    const dirs = parseCandidateDirs(html).filter(isCandidateApp);
    const metas = await Promise.all(dirs.map(fetchAppMeta));
    return metas.filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
};

// autoindex HTML からディレクトリ候補（末尾 / 付きリンク）を抽出する
const parseCandidateDirs = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const dirs = [];
    for (const a of doc.querySelectorAll('a[href]')) {
        const raw = a.getAttribute('href');
        if (!raw || raw.startsWith('?')) {
            continue;
        }
        // ディレクトリリンクは末尾 / を持つ（Apache/nginx 共通）。ファイルリンク・通常HTMLは除外する
        if (!raw.endsWith('/')) {
            continue;
        }
        const dir = raw.replace(/^\/+/, '').replace(/\/+$/, '');
        if (dir) {
            dirs.push(dir);
        }
    }
    return dirs;
};

// 抽出したディレクトリ名がアプリ候補か（非アプリ・自己・親を除外）判定する
const isCandidateApp = (dir) => {
    if (dir === '' || dir === '.' || dir === '..') {
        return false;
    }
    return !NON_APP_DIRS.includes(dir);
};

// 1ディレクトリの index.html を fetch してアプリメタを返す（失敗時は null）
const fetchAppMeta = async (dir) => {
    try {
        const res = await fetch(dir + '/index.html');
        if (!res.ok) {
            return null;
        }
        const html = await res.text();
        const match = html.match(/<title>\s*(.*?)\s*<\/title>/i);
        const title = match ? match[1] : dir;
        return { id: dir, title, path: dir + '/index.html' };
    } catch (err) {
        console.error('fetchAppMeta error for ' + dir + ':', err);
        return null;
    }
};

initLauncher();
