# SMART Vault（S.M.A.R.T. ストレージ資産管理台帳）

常時接続しない手持ちの外付けストレージ（HDD、SSD、NVMe、eMMC等）のスペックや健康状態（S.M.A.R.T.情報）をブラウザ上で一元管理・記録するWebアプリケーションです。

## 特徴

- **ペーストで即座に登録** — `smartctl` のJSON出力を貼り付けるだけで自動パース・登録（S/Nで新規/更新を判定）
- **4段階の劣化度判定** — S.M.A.R.T.属性から L0(正常)/L1(注意)/L2(警告)/L3(要交換) を自動算出。`PASSED` でも保留中セクタやUNCエラーがあればL3として検出し、ジャンク品の危険度を一目で把握
- **デバイスタイプによるフィルタ** — NVMe / SATA SSD / SSHD / HDD / eMMC で絞り込み
- **完全ローカル動作** — データはブラウザの `localStorage` に保存され、外部通信は一切なし

## 使い方

### S.M.A.R.T. 情報の取得

対象ストレージをPCに接続し、添付のシェルスクリプトで対話的にディスクを選択してクリップボードにコピーします。

```bash
chmod +x bin/smart-vault.sh
bin/smart-vault.sh
```

操作手順:

1. 接続されている物理ディスクの一覧が表示される
2. 矢印キー（↑/↓）で対象ディスクを選択し、Enterで決定
3. 自動判別（auto）で取得を試行し、失敗した場合は sata / ata / nvme / scsi 等を順次リトライ
4. 取得成功でJSONがクリップボードにコピーされる
5. 終了を選ぶまで繰り返し可能

手動で取得する場合は、アプリ画面内のアコーディオンに表示されるコマンドを使用します。

```bash
sudo smartctl -a --json /dev/diskX | pbcopy
```

### 台帳への登録・更新

1. `index.html` をブラウザで開く
2. 画面上部のペーストエリアをクリックしてフォーカスを当てる
3. コピーしたJSONデータをペースト（`Cmd+V` / `Ctrl+V`）
4. S/Nで既存データを判定し、新規なら追加・既存なら最新状態に更新

### 編集・フィルタ・ソート

- **メーカー / 分類**: セルクリックでプルダウン表示（メーカーは自由入力にも対応）
- **メモ欄**: セルクリックでテキスト入力。Enter またはフォーカスを外すと保存
- **詳細表示**: 編集可能セル（メーカー・分類・メモ）以外の行をクリックすると詳細行を展開
- **消去**: 行右端の「消去」ボタンで削除
- **フィルタ**: デバイスタイプ別ボタンで絞り込み
- **ソート**: テーブルヘッダクリックで昇順/降順トグル
- **並び替え**: 行のドラッグ＆ドロップで手動順に変更

### バックアップと復元

| 操作 | 説明 |
|------|------|
| バックアップ保存 | 保存ダイアログで全データをJSONファイルとしてエクスポート |
| 復元 | エクスポートしたJSONファイルを読み込み、既存データとマージ |
| 全再読み込み | 蓄積された生JSONから台帳を一括再計算（手動編集項目は維持） |

## ファイル構成

```
smart-vault/
├── index.html              — HTML構造
├── css/style.css           — スタイル
├── js/app.js               — ロジック
├── bin/
│   └── smart-vault.sh      — S.M.A.R.T.情報取得スクリプト（macOS用）
└── README.md
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
