import globals from 'globals';

export default [
    {
        ignores: ['eslint.config.mjs', '**/js/lib/**/*.min.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                // 環境組み込み（globalsパッケージで一括定義）
                ...globals.browser,
                ...globals.node,

                // Tampermonkey/Greasemonkey globals（globalsパッケージに含まれない特殊グローバル）
                unsafeWindow: 'readonly',
                GM_setValue: 'readonly',
                GM_getValue: 'readonly',
                GM_deleteValue: 'readonly',
                GM_listValues: 'readonly',
                GM_addStyle: 'readonly',
                GM_getResourceText: 'readonly',
                GM_getResourceURL: 'readonly',
                GM_registerMenuCommand: 'readonly',
                GM_unregisterMenuCommand: 'readonly',
                GM_openInTab: 'readonly',
                GM_xmlhttpRequest: 'readonly',
                GM_download: 'readonly',
                GM_getTab: 'readonly',
                GM_saveTab: 'readonly',
                GM_getTabs: 'readonly',
                GM_notification: 'readonly',
                GM_setClipboard: 'readonly',
                GM_info: 'readonly',

                // 外部ライブラリ（js/lib/ 配下）
                Sortable: 'readonly'
            }
        },
        rules: {
            // コードスタイル
            'indent': ['error', 4],
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'comma-dangle': ['error', 'never'],
            'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0, 'maxBOF': 0 }],

            // ベストプラクティス
            'no-unused-vars': ['warn'],
            'no-console': 'off',
            'no-undef': 'error',
            'no-redeclare': 'error',
            'no-duplicate-case': 'error',
            'no-unreachable': 'error',

            // ES6+
            'prefer-const': 'warn',
            'no-var': 'warn',
            'arrow-spacing': 'error',
            'template-curly-spacing': 'error'
        }
    }
];
