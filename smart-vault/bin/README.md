# smart-vault/bin

外付けストレージの状態確認・ベンチマーク・修復・Time Machine クローンを行う、macOS 向け対話型シェルスクリプト集。

## 動作環境

- macOS（`/bin/bash` 3.2 対応。連想配列不使用）
- 各スクリプトは `common.sh` を同じディレクトリに置いて実行する
- スクリプト実行権限を付与して利用: `chmod +x *.sh`

## スクリプト一覧

### smart-vault.sh — SMART 状態確認

対象デバイスの S.M.A.R.T. 情報（`smartctl -a`）を取得し、JSON 形式でクリップボードへコピーする。

- 導入: `brew install smartmontools`
- 実行: `./smart-vault.sh`

### fio-bench.sh — fio ベンチマーク

マウントされているボリュームの Seq Read / Rand Read / 低キュー深度レイテンシを測定し、1つの JSON に統合してクリップボードへコピーする。ストレージ種類（HDD / SATA SSD / NVMe SSD）を選択して最適な測定パラメータを適用。

- 導入: `brew install fio jq`
- 実行: `./fio-bench.sh`
- 測定結果は `最新のJSONをコピー` で再取得可能

### hdd-repair.sh — ディスク修復（fio verify）

外付けディスク全体へ CRC ＋オフセットパターンの書込と読戻し照合を行い、不良セクタの再割当てを促す。`fio-bench.sh` / `smart-vault.sh` で結果が芳しくなかったディスクに対する修復用途。

- 導入: `brew install fio jq`
- 実行: `./hdd-repair.sh`
- 進捗は fio のライブ表示（%・速度・eta）。詳細な状態確認は Smart/Fio のシェルで行う前提
- Tab キーで任意ディスクをロック（実行禁止）。ロック状態は `locks.txt` へ永続化
- 終了コード: 0=成功 / 1=異常・JSON不正・対象変化など / 2=I/O・検証エラー検出

### timemachine-clone.sh — Time Machine クローン

Time Machine 用ストレージの APFS 構造（履歴・スナップショット・Backupロール）ごと別ディスクへクローンする。ddrescue でブロックコピーし、UUID 重複を避けるためコピー後に一度両方取り外してコピー先だけ再接続する。リサイズ失敗時は履歴を段階的に間引き（24時間/週次/月次/1件ずつ）、最終的に APFS 新規作成へフォールバック。コピー先がコピー元より小さい場合は、コピー元 APFS コンテナを一時的にコピー先へ収まるサイズへ縮小してからコピーし、完了後に元の最大容量へ戻す。

- 導入: `brew install ddrescue jq`
- 実行: `./timemachine-clone.sh`
- コピー元は APFS Container（synthesized diskN）を逆引きして ddrescue 入力にする。パーティション内に小さいコンテナがある場合はそのコンテナ分だけコピーする
- コピー先は選択デバイスへ APFS コンテナを直接ブロック書き込みする（GPT パーティションを作らず全面上書き）
- コピー先が小さい場合、コピー元 APFS コンテナをコピー先容量から 1GB 引いたサイズへ縮小してコピーする。完了後はコピー先・コピー元の順に取り外す間にコピー元を最大容量へ再拡張する
- コピー後はコピー元とコピー先の APFS UUID が重複するため、一度両方取り外してコピー先だけ再接続する（両方を同時にマウントしない）
- mapfile は中断・再開に対応（`timemachine-clone.map`）。ddrescue 完了時に未回収領域があれば停止する
- リサイズ失敗時のフォールバック: 履歴の段階的間引き → 全履歴削除でも直らなければ APFS 新規作成（**この場合、コピー先の Time Machine 履歴はすべて失われる**）
- 終了コード: 0=成功・メニューから終了 / 1=異常・確認後の中止

### common.sh — 共通ヘルパー（直接実行しない）

各スクリプトから `source` で読み込まれる共通関数を提供。

- UI: `read_key` / `select_menu` / `select_menu_lock`
- ディスク情報: `collect_disks`（外付け物理＋AppleRAID仮想ディスク、RAIDメンバー個別は除外）/ `fetch_disk_summary` / `plist_value` / `human_size` / `format_bytes_with_commas`
- ログ出力: `log` / `warn` / `die` / `play_result_sound`

## 共通仕様

- **対話型**: 矢印キー（↑/↓）でデバイス選択、Enter で決定。ディスク一覧には「再読込」「終了」を配置
- **選択対象**: 外付けディスクのみ。内蔵システムディスクは除外。AppleRAID（JBOD/RAID0）仮想ディスクも選択可能（メンバー個別ディスクは除外）
- **破壊的操作前の確認**: hdd-repair.sh / timemachine-clone.sh は実行前に y/N で最終確認
- **sudo**: 必要な処理は実行時に都度 sudo 認証

## 開発ルール

詳細は `CLAUDE.md`（同ディレクトリ）を参照。
