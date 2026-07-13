# WP Data Manager（系統・種牡馬データ管理）

競馬ゲーム（Winning Post）向けの系統・種牡馬データ管理ツール。系統の滅亡防止や血統保護のプレイを補助します。

## 特徴

- **系統の滅亡防止・血統保護の補助** — 系統データを一元管理し、どの系統が滅亡寸前か、どの種牡馬を保護すべきかを把握しやすくする
- **史実馬データの内蔵** — 年代別の史実馬マスターデータを搭載。ゲーム内年に応じて直近に誕生する史実馬を確認できる
- **年間スケジュールの進行管理** — チェックリスト形式の年間スケジュールで、系統保護に向けた定期作業の進行度を保存できる
- **馬のマーク定義の参照** — 競走馬・種牡馬・繁殖牝馬・幼駒それぞれのマーク（☆◎○△）の意味をメモとして参照できる

## 使い方

1. `index.html` をブラウザで開く
2. ゲーム内年を右上の入力欄に設定すると、年齢と年代別馬リストが連動して更新される
3. 系統データは下部の入力欄から追加。行のセルクリックでインライン編集、右端のボタンで削除
4. 上部のトグルボタンでスケジュール・年代別馬リスト・注記メモを表示切替
5. スケジュールのチェックリストで作業進行を管理（状態は自動保存）

## ファイル構成

```
wp-data-manager/
├── index.html              — HTML構造
├── css/style.css           — スタイル
└── js/
    ├── app.js              — メインロジック（DOM・localStorage・状態）
    ├── horse-logic.js      — 系統データの純粋関数
    └── lib/sortable.min.js — ドラッグ＆ドロップライブラリ
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
