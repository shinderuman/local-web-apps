# URL Vault（高密度タブマネージャー）

URLをサムネイル付きカードとして管理・整理するタブマネージャー。ブラウザのタブを大量に開きたくない場面で、URLを保存して視覚的に整理できます。

## 特徴

- **3階層の整理構造** — ウィンドウ → グループ → アイテム でURLを体系化
- **サムネイル付きカード表示** — クリップボードから画像を貼り付け（自動背景トリム・リサイズ・JPEG圧縮）
- **ドラッグ＆ドロップで並び替え** — 手動順のみドラッグ有効
- **ソート** — 手動順 / タイトル順 / 登録順（タイトル・登録順は昇順/降順トグル）
- **テキストフィルタ** — タイトルの部分一致でリアルタイム絞り込み
- **ウィンドウ・グループの管理** — フィルタボタン上で名前編集・削除（編集モード切替）
- **アイテム編集** — 編集モードでカードをクリックすると既存アイテムのタイトル・URL・画像を更新（sortOrder/createdAtは保持）
- **追加位置の切替** — 新規アイテムを先頭/末尾のいずれに追加するか切替可能（デフォルト先頭）
- **JSON形式のインポート/エクスポート** — データのバックアップと復元
- **2行ペースト対応** — タイトルとURLの2行テキストを一度に貼り付け
- **画像ペースト自動保存** — タイトル・URL入力済みの状態で画像を貼ると自動保存
- **あらすじ取得（漫画）** — Kindleドメインの漫画アイテムは楽天ブックスAPIからあらすじを自動取得（保存時および一括取得）
- **ダークテーマUI** — 高密度カードグリッドで最大表示領域を確保

## 使い方

### 基本フロー

1. 「① ウィンドウ枠作成」で大枠を作成（例：仕事、趣味）
2. 「② グループ作成」でウィンドウ内にグループを作成（例：ドキュメント、SNS）
3. 「③ アイテム登録」でタイトル・URLを入力して保存
4. カードをクリックすると新しいタブでURLを開きます

### 入力のショートカット

- **2行ペースト**: タイトル欄に `タイトル\nURL` を貼ると自動で分離される
- **Enterで保存**: タイトル・URL欄で Enter を押すと保存
- **画像ペースト**: タイトル・URL欄でも画像を貼り付け可能（テキストがある場合はテキスト優先）
- **保存後**: 自動でタイトル欄にフォーカスが戻る

### フィルタ・ソート

- 上部ナビのウィンドウ・グループボタンで絞り込み
- 「手動順 / タイトル順 / 登録順」で並び替え（再度押すと昇順/降順切替）
- 「検索」欄でタイトルの部分一致フィルタ
- フィルタ・ソート状態はリロード後も維持（タブごとに独立）

### ウィンドウ・グループ・アイテムの編集・削除

- ナビ右上の「✏ 編集」ボタンで編集モードをトグル
- 編集モードON時: フィルタボタンに ✏（名前変更）と ×（削除）アイコンが表示
- 編集モードON時: カードに ×（削除）ボタンが表示
- 編集モードON時: カードをクリックすると左ペインに既存アイテムの内容をロードして編集
- 削除はアイテムが0件の場合のみ可能（ウィンドウ・グループ削除はconfirm付き）

### あらすじ取得（漫画）

- **Kindleドメイン（`read.amazon.co.jp`）の漫画アイテム**を保存すると、自動で楽天ブックスAPIからあらすじを取得
- 保存する巻を起点に**前後を含む3巻分**のあらすじを取得（例: 5巻を保存 → 3,4,5巻 / 1巻を保存 → 1,2,3巻）
- カードを**右クリック**すると右ペインにあらすじを表示
  - 未取得/取得済みに関わらず、右ペイン内でタイトル・巻数を編集して再取得可能
  - Kindle以外のカードは赤いトーストで「あらすじ非対応」を表示
- 上部「📖 あらすじ全取得」: 表示中の未取得Kindleアイテムを一括取得（確認ダイアログ付き）
- 上部「📖 あらすじ全取得(上書き)」: 取得済みも含めて全件再取得（確認ダイアログ付き）
- あらすじ未取得のKindleカードは赤い点線枠＋`!?`マークで常時表示
- あらすじ取得済みのカードは右下に 📖 マーク表示
- **注意**: あらすじはデータ容量肥大化を避けるため**エクスポート対象外**。インポート後は再取得が必要

### 設定（認証情報）

あらすじ取得機能は楽天APIの認証情報が必要です。

1. `config.sample.js` を `config.js` としてコピー
2. `config.js` に楽天APIの `applicationId` と `accessKey` を設定
3. `config.js` は `.gitignore` でgit管理外

## ストレージ構成

| 保存先 | 用途 |
|--------|------|
| IndexedDB | 永続データ（アイテム・ウィンドウ・グループ、あらすじ） |
| sessionStorage | UI状態（トグル・フィルタ・ソート・追加位置、タブごとに独立） |

## ファイル構成

```
url-vault/
├── index.html              — HTML構造
├── css/style.css           — スタイル
├── js/app.js               — ロジック
├── js/title-parser.js      — タイトル解析（巻数・作品名抽出）
├── config.js               — 認証情報（git管理外・要作成）
├── config.sample.js        — 認証情報テンプレート
└── test/                   — Node組み込みテスト（依存追加なし）
    ├── title-parser.test.js
    └── real-titles.test.js (+ real-titles.json, real-titles.expected.json)
```

### テスト実行

タイトル解析（巻数・作品名の抽出）は実データ182件でスナップショットテストを保持しています。

```bash
cd url-vault
node --test test/title-parser.test.js test/real-titles.test.js
```

## ライセンス（サードパーティ）

本アプリのドラッグ＆ドロップ機能には [SortableJS](https://github.com/SortableJS/Sortable)（`js/lib/sortable.min.js`）を使用しています。

```
SortableJS 1.15.7
Copyright (c) 2017-2019 RubaXa <trash@rubaxa.org>
Copyright (c) 2019-present All contributors to SortableJS

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
