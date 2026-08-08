// ルート直下の各アプリ index.html からアプリ一覧マニフェスト（apps.js）を自動生成する。
// アプリ追加・タイトル変更時は `node scripts/build-apps.js` を再実行する。
// file:// 運用ではブラウザがファイルシステムを列挙できないため、このビルド成果物を
// ランチャーが <script> で読み込む方式で「アプリ一覧の手書き」を不要にする。

const fs = require('fs');
const path = require('path');

// このスクリプトは scripts/ 配下にあるため、リポジトリルートは1階層上
const ROOT = path.resolve(__dirname, '..');

// autoindex 取得対象外のディレクトリ（index.html の有無に関わらず除外）
const EXCLUDE_DIRS = ['node_modules', '.git'];

// 収集結果を apps.js として出力する（エントリポイント）
const build = () => {
    const apps = collectApps();
    const json = JSON.stringify(apps, null, 4);
    const header =
        '// このファイルは scripts/build-apps.js が自動生成したアプリ一覧マニフェストです。\n' +
        '// 手動で編集しないこと。アプリ追加・タイトル変更時は `node scripts/build-apps.js` で再生成。\n';
    const content = header + 'window.APPS = ' + json + ';\n';
    fs.writeFileSync(path.join(ROOT, 'apps.js'), content, 'utf8');
    console.log('apps.js を生成しました: ' + apps.length + ' 件');
    for (const app of apps) {
        console.log('  - ' + app.id + ' (' + app.title + ')');
    }
};

// ルート直下のアプリ群を収集する
const collectApps = () => {
    const entries = fs.readdirSync(ROOT, { withFileTypes: true });
    const apps = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        if (!isAppDir(entry.name)) {
            continue;
        }
        const html = fs.readFileSync(
            path.join(ROOT, entry.name, 'index.html'),
            'utf8'
        );
        const title = extractTitle(html) || entry.name;
        apps.push({ id: entry.name, title, path: entry.name + '/index.html' });
    }
    apps.sort((a, b) => a.id.localeCompare(b.id));
    return apps;
};

// 指定ディレクトリがアプリ（index.html を持つ）か判定する
const isAppDir = (name) => {
    if (EXCLUDE_DIRS.includes(name)) {
        return false;
    }
    return fs.existsSync(path.join(ROOT, name, 'index.html'));
};

// index.html の <title> 要素の中身を抽出する（未検出時は空文字）
const extractTitle = (html) => {
    const match = html.match(/<title>\s*(.*?)\s*<\/title>/i);
    return match ? match[1] : '';
};

build();
