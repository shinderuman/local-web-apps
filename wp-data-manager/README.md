# WP Data Manager（系統・種牡馬データ管理）

競馬ゲーム（Winning Post）向けの系統・種牡馬データ管理ツール。系統の滅亡防止や血統保護のプレイを補助します。

## 特徴

- **系統データのCRUD管理** — 系統名・生年・種牡馬名を追加・編集・削除
- **ゲーム内年齢の自動計算** — ゲーム内年を設定すると年齢が自動表示
- **ドラッグ＆ドロップで行並び替え** — 表示順序のカスタマイズ
- **列ヘッダークリックでソート** — 順序・系統名・生年・種牡馬名でソート
- **CSV入出力** — CSV形式でのデータインポート・エクスポート
- **年代別馬リスト** — 史実馬データを内蔵し、ゲーム内年に基づいて表示
- **スケジュール管理** — チェックリスト形式の年間スケジュール（進行度を保存）
- **注記メモ** — 馬のマーク（☆◎○△）の定義など参考情報を表示

## 内蔵史実馬データ

1963年〜2020年生まれの国内外の主要な競走馬・種牡馬データを搭載。ゲーム内年に応じて、直近に誕生する史実馬を確認できます。

## 使い方

1. ゲーム内年を右上の入力欄に設定
2. CSVから読み込み、または手動で系統データを追加
3. 上部のトグルボタンでスケジュール・年代別リスト・メモを表示
4. スケジュールのチェックリストで作業進行を管理

## ファイル構成

```
wp-data-manager/
├── index.html       — HTML構造
├── css/style.css    — スタイル
└── js/app.js        — ロジック
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
