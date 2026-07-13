# Price Vault（買い物価格メモ）

スーパーやネットスーパーでの買い物時に、商品ごとの価格（最安値・最高値）を記録・比較するWebアプリケーションです。商品単位で複数の購入履歴を蓄積し、どこでいくらで買ったかを一目で把握できます。

## 特徴

- **商品単位の価格比較** — 同一商品の全購入履歴から最安値（緑）と最高値（赤）を自動強調表示
- **購入店の一覧表示** — その商品を買ったことがある全店名を重複排除して一覧化
- **カテゴリタブ** — 「すべて」固定＋ユーザーが登録したカテゴリで絞り込み。商品が紐づかなくなったカテゴリは自動でタブから消える
- **アコーディオン履歴** — 商品行クリックで過去の全購入履歴（新しい順）を展開。履歴クリックで編集モーダル
- **完全ローカル動作** — データはブラウザの `IndexedDB` に保存され、外部通信は一切なし

## 使い方

### 商品の登録

1. `index.html` をブラウザで開く
2. 画面上部のフォームに入力
   - **商品名**（必須）— 例: `ピーマン1個`
   - **カテゴリ**（選択 or 新規追加）— 選択中タブのカテゴリがデフォルト。「すべて」タブ時は「未分類」
   - **値段**（必須）
   - **買った店**（任意）
   - **グラム単価**（任意）— 例: `98円/100g`
   - **日付**（必須、デフォルトはシステム日付）
3. 「商品を登録」ボタン（または Enter）で保存

同じ商品名で再度登録すると、既存商品の購入履歴として追加されます。最安値・最高値が変わると一覧に反映されます。

> **運用メモ:** 「ピーマン1個」と「ピーマン4個」のように数量や単位が異なる場合は、別々の商品名で登録してください（完全一致のみ同一商品と判定します）。

### 履歴の編集・削除

- 商品行をクリックすると購入履歴がアコーディオン展開（再クリックで閉じる）
- 履歴行をクリックすると編集モーダルが開く（商品名・値段・店・グラム単価・日付を編集）
- モーダル内の「この履歴を削除」で単一履歴を削除。履歴をすべて削除すると商品自体も削除
- 商品行右端の「×」ボタンで商品ごと削除（子履歴も一括削除）

### フィルタ・ソート・並び替え

- **カテゴリタブ**: 「すべて」固定＋登録済みカテゴリで絞り込み
- **ソート**: 商品名列ヘッダクリックで商品名順 / 登録順を切り替え
- **並び替え**: 商品行のドラッグ＆ドロップで手動順に変更

### バックアップと復元

| 操作 | 説明 |
|------|------|
| バックアップ保存 | 全データをJSONファイルとしてエクスポート |
| 復元 | JSONファイルを読み込み、既存データをすべて破棄して上書き |

## データ構造

`IndexedDB`（`PriceVaultDB` / `products` ストア）に商品1件＝1レコードで保存。購入履歴は商品レコード内の `children` 配列としてネスト保持します。

```
商品レコード
├── id, name, category, sortOrder, createdAt
└── children: [ { price, store, unitPrice, date }, ... ]   ← 購入履歴
```

最安値・最高値の判定は「値段」のみを基準とします（グラム単価は判定に使用しません）。

## ファイル構成

```
price-vault/
├── index.html                  — HTML構造
├── css/style.css               — スタイル
├── js/
│   ├── app.js                  — メインロジック（DOM・IndexedDB・状態）
│   ├── price-logic.js          — 価格計算・ソート・バリデーション（純粋関数）
│   ├── category-logic.js       — カテゴリ抽出・件数カウント（純粋関数）
│   ├── export-logic.js         — インポートデータ検証（純粋関数）
│   └── lib/sortable.min.js     — ドラッグ＆ドロップライブラリ
├── test/                       — 純粋関数のユニットテスト（node --test）
└── README.md
```

## テスト

純粋関数モジュールのテストは Node.js 標準の `node --test` で実行します。

```bash
cd price-vault
node --test "test/*.test.js"
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
