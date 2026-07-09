# local-web-apps リポジトリルール

このリポジトリ配下のすべてのディレクトリに適用するルール。

## テスト実行

- テストは `node --test` で実行する（vitest、jest等は使用しない）
- `npx vitest` 等で別のテストランナーをインストールしてはならない
- 実行時はディレクトリ指定ではなく **glob でファイルを指定**する（`node --test "test/*.test.js"`、対象ディレクトリ内で実行）
- テストは `node:test` + `node:assert` の標準ランナーのみ。`test()` を使い `describe`/`it` は使わない

## ESLint

- 設定ファイル：リポジトリルートの `eslint.config.mjs`（ESLint9 flat config）
- `eslint` と `globals` はリポジトリルートの `package.json`（devDependencies）で管理。`npm install` でローカル導入
- 環境組み込みグローバル（browser/node）は `globals` パッケージの `...globals.browser` / `...globals.node` で一括定義する（手書き列挙・ユーザーレベル設定は使わない）
- 実行は `npx eslint .`（設定ファイルは自動読込）。`--config ~/.eslint.config.mjs` 方式は廃止
- 編集後即 `--fix` → テスト実行前に `--fix` を当てる

## 純粋関数モジュールの分割

- 副作用のない入出力関数（DOM/localStorage/状態/Date.now に依存しない）のみ `js/*-logic.js` に切り出す
- DOM操作・イベント・共有状態・localStorage に依存する関数は `app.js` に置く
- モジュールは IIFE + UMD 構造（`module.exports` / `window.XXX_LOGIC` の両エクスポート）。先頭3行コメント、各関数上に1行コメント
- `app.js` は `const { ... } = window.XXX_LOGIC` で必要な関数のみ分割代入
- `index.html` で純粋関数モジュールを `app.js` より先に読み込む
- 依存する純粋関数は引数で注入（require順への依存を避ける）
