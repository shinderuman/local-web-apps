// タイトル解析ユーティリティ（ブラウザ/Node両方で利用）
// ブラウザ: window.TITLE_PARSER にエクスポート
// Node: module.exports にエクスポート
// グローバル汚染を防ぐためIIFEで囲む（他のUserScriptとの名前衝突回避）

((root, factory) => {
    // 全角数字を半角に正規化
    const normalizeDigits = (s) => s.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));

    // タイトルから巻数を抽出（全角対応）。
    // 方針:
    //   1. 末尾の括弧書き（N）→ それが巻数
    //   2. 末尾の数字 → それが巻数
    //   3. 末尾が数字を含まない括弧（雑誌名）→ その括弧を除去して再帰
    //   4. サブタイトル(〜以降)を除いた部分の末尾数字
    const parseVolume = (title) => {
        const n = normalizeDigits(title).replace(/\s+$/, '');

        // 1. 末尾の括弧書き（N）
        const parenNum = n.match(/[（(]([0-9]+)[）)]$/);
        if (parenNum) return parseInt(parenNum[1], 10);

        // 2. 末尾の「N巻」「第N巻」
        const volSuffix = n.match(/第?([0-9]+)巻$/);
        if (volSuffix) return parseInt(volSuffix[1], 10);

        // 3. 末尾の数字
        const tailNum = n.match(/([0-9]+)$/);
        if (tailNum) return parseInt(tailNum[1], 10);

        // 4. 末尾が数字を含まない括弧（雑誌名等）→ 除去して再帰
        const trailingParen = n.match(/[（(【][^（(【0-9]*[）)】]$/);
        if (trailingParen) {
            const stripped = n.slice(0, n.length - trailingParen[0].length);
            return parseVolume(stripped);
        }

        // 5. 文中の最後の「N巻」「第N巻」
        const volAnywhere = n.match(/第?([0-9]+)巻[^0-9]*$/);
        if (volAnywhere) return parseInt(volAnywhere[1], 10);

        // 6. サブタイトル（〜/～以降）を除外した本編の末尾数字
        const main = n.split(/[〜～]/)[0];
        const mainTail = main.match(/([0-9]+)\s*$/);
        if (mainTail) return parseInt(mainTail[1], 10);

        return 1;
    };

    // タイトルから検索用の作品名（メインタイトル）を取得。
    // 方針: サブタイトル（最初の〜/～以降）を切り捨て、末尾の「N巻」「第N巻」「巻数括弧(N)」「雑誌名括弧」「単独数字」を再帰除去。
    // 先頭の数字（「100万」等）は保持。
    const parseBaseTitle = (title) => {
        // サブタイトル（最初の〜/～以降）を切り捨て
        const main = normalizeDigits(title).split(/[〜～]/)[0];
        const s = main.replace(/\s+$/, '');

        // 末尾の「N巻」「第N巻」を除去して再帰
        const volSuffix = s.match(/[\s　]?第?[0-9]+巻$/);
        if (volSuffix) {
            return parseBaseTitle(s.slice(0, s.length - volSuffix[0].length));
        }
        // 末尾の雑誌名括弧（数字を含まない）を除去して再帰
        const trailingParen = s.match(/[（(][^（(0-9]*[）)]$/);
        if (trailingParen) {
            return parseBaseTitle(s.slice(0, s.length - trailingParen[0].length));
        }
        // 末尾の巻数括弧（N）を除去して再帰
        const trailingNumParen = s.match(/[（(][0-9]+[）)]$/);
        if (trailingNumParen) {
            return parseBaseTitle(s.slice(0, s.length - trailingNumParen[0].length));
        }
        // 末尾の単独数字を除去して再帰（除去後に新たな括弧が末尾になる場合があるため）
        const stripped = s.replace(/[\s　]?[0-9]+$/, '');
        if (stripped !== s) {
            return parseBaseTitle(stripped);
        }
        return s.replace(/\s+$/, '');
    };

    const TITLE_PARSER = { normalizeDigits, parseVolume, parseBaseTitle };
    factory(root, TITLE_PARSER);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, TITLE_PARSER) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TITLE_PARSER;
    }
    if (typeof window !== 'undefined') {
        window.TITLE_PARSER = TITLE_PARSER;
    }
});
