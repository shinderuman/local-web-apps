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

const showMessage = (text) => {
    MESSAGE_EL.textContent = text;
    MESSAGE_EL.hidden = false;
};

const renderApps = (apps) => {
    APP_LIST_EL.innerHTML = '';
    for (const app of apps) {
        const link = document.createElement('a');
        link.href = app.path;
        link.target = '_blank';
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

// ディレクトリリンクは末尾 / を持つ（Apache/nginx 共通）。ファイルリンク・通常HTMLは除外
const parseCandidateDirs = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const dirs = [];
    for (const a of doc.querySelectorAll('a[href]')) {
        const raw = a.getAttribute('href');
        if (!raw || raw.startsWith('?')) {
            continue;
        }
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

const isCandidateApp = (dir) => {
    if (dir === '' || dir === '.' || dir === '..') {
        return false;
    }
    return !NON_APP_DIRS.includes(dir);
};

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
