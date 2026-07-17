# local-web-apps リポジトリルール

このリポジトリ配下のすべてのディレクトリに適用するルール。

## テスト実行

- テストは `node --test` で実行する（vitest、jest等は使用しない）
- `npx vitest` 等で別のテストランナーをインストールしてはならない
- 実行時はディレクトリ指定ではなく **glob でファイルを指定**する（`node --test "test/*.test.js"`、対象ディレクトリ内で実行）
- テストは `node:test` + `node:assert` の標準ランナーのみ。`test()` を使い `describe`/`it` は使わない

## 手動並び順のテスト

- `sortOrder` や `order` を計算・更新する純粋関数には、連番だけでなく欠番を含む入力のテストを追加する

## ESLint / Prettier

- 設定ファイル：リポジトリルートの `eslint.config.mjs`（ESLint9 flat config）、`.prettierrc.json`、`.prettierignore`
- `eslint` / `globals` / `prettier` / `eslint-config-prettier` はリポジトリルートの `package.json`（devDependencies）で管理。`npm install` でローカル導入
- 環境組み込みグローバル（browser/node）は `globals` パッケージの `...globals.browser` / `...globals.node` で一括定義する（手書き列挙・ユーザーレベル設定は使わない）
- 整形は Prettier に一任（スタイルルールは `eslint-config-prettier` で無効化）。ESLint は構文・バグ検出に専念
- Prettier は JS/CSS/HTML/JSON/MD など対応する全拡張子に適用する（JS限定ではない）
- 実行は `npx eslint .`（設定ファイルは自動読込）。`--config ~/.eslint.config.mjs` 方式は廃止
- ファイル編集後は `npx prettier --write <file>` → `npx eslint <file>`（JSのみ）→ テスト実行。テスト実行前に prettier/eslint を当てる

## 純粋関数モジュールの分割

- 副作用のない入出力関数（DOM/localStorage/状態/Date.now に依存しない）のみ `js/*-logic.js` に切り出す
- DOM操作・イベント・共有状態・localStorage に依存する関数は `app.js` に置く
- モジュールは IIFE + UMD 構造（`module.exports` / `window.XXX_LOGIC` の両エクスポート）。先頭3行コメント、各関数上に1行コメント
- `app.js` は `const { ... } = window.XXX_LOGIC` で必要な関数のみ分割代入
- `index.html` で純粋関数モジュールを `app.js` より先に読み込む
- 依存する純粋関数は引数で注入（require順への依存を避ける）

## ストレージ層（localStorage / IndexedDB）

- 新規アプリ作成時は、データの規模・内容に応じて都度判断する（どちらかに固定しない）
    - `localStorage`: 同期APIで実装が単純。設定値・フラグ・小規模なテキストデータ向け。容量上限約5MB・JSONシリアライズコスト・部分更新不可の制約あり
    - `IndexedDB`: 非同期APIで定形コード（open/onupgradeneeded/transaction）が必要。画像（Blob/Base64）・長期蓄積データ・親子ストア構造向け。容量・構造化データで優位
- 既存アプリの採用実績（判断の参照元）
    - `localStorage`: smart-vault, wp-data-manager（テキスト中心の小規模データ）
    - `IndexedDB`: url-vault, price-vault（複数ストア構造 / 親子ネストデータの永続蓄積）
- 判断は仕様書・ユーザー指示を最優先する（既存アプリの傾向から自動決定しない）
