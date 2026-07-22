# smart-vault/bin 配下の sh スクリプトルール

このディレクトリ配下のシェルスクリプト（`*.sh`）に適用するルール。
ここまでの作業（common.sh 共通化、対話型ツール整備）で確立した指針。

## 対象スクリプト

- `smart-vault.sh`：SMART 状態確認
- `fio-bench.sh`：fio ベンチマーク
- `hdd-repair.sh`：dd 以外の不良セクタ修復（fio verify）
- `timemachine-clone.sh`：Time Machine クローン（ddrescue）
- `common.sh`：共通ヘルパー（他スクリプトから source される、直接実行しない）

## 共通ヘルパー（common.sh）

各スクリプトは `source "$SCRIPT_DIR/common.sh"` で読み込み、以下を重複定義しない。

- UI：`read_key` / `select_menu` / `select_menu_lock`
- ディスク情報：`collect_disks` / `fetch_disk_summary` / `plist_value` / `human_size` / `format_bytes_with_commas`
- ログ出力：`log` / `warn` / `die` / `play_result_sound`

`collect_disks` は外付け物理ディスク＋AppleRAID仮想ディスクを列挙し、RAIDメンバー個別ディスク（`Apple_RAID` パーティションを持つ物理ディスク）は除外する（メンバーを直接選ぶとRAID構成を破壊するため）。

## 構造・規約

- shebang は `#!/bin/bash`。`set -o pipefail` を使用（`set -u` は使わない）
- `SCRIPT_DIR` を絶対パス化（`cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P`）
- 必須コマンドは `type -P` で絶対パス解決、存在確認＋種別確認（`--version` の grep 等）
- 起動時の必須コマンドチェックは common.sh source 前のため `echo "エラー:..." ; exit 1`。source 後は `die`
- macOS 標準 bash は 3.2 のため連想配列（`declare -A`）を使わず `case` 文で代替
- `trap cleanup_files EXIT` で一時ディレクトリ削除、INT/TERM で確実終了（終了コード 130/143）
- 1行1処理、関数は原則30行以内（ユーザーレベル CLAUDE.md のコーディング規約準拠）

## 対話型ルール

- `select_menu`（common.sh）で矢印キー選択。メニュー表示が stdout へ出るため**コマンド置換で呼ばず** `cursor=$?` で index を受け取り配列から値を引く
- メニュー末尾に「終了」、ディスク一覧系は「再読込」と「終了」を配置
- 表示は `diskN (容量 / モデル名 / プロトコル)` 形式
- 破壊的操作前の最終確認は y/N（`[Yy]` 判定）
- 実行直前の再照合（モデル・容量・プロトコル一致）、raw デバイス存在確認（`[ -c "$raw_device" ]`）

## 安全策

- 外付けディスクのみ選択対象（内蔵は除外）。`collect_disks` が `Internal=false` で絞り込み
- 強制アンマウント（`diskutil unmountDisk force`）
- 破壊的ツールのヘッダは他コマンド同様の粒度（機能・終了コード・導入方法のみ）。引き継ぎ用の長大な説明は書かない

## macOS 固有の落とし穴（実測で確認済み）

- `diskutil` 系コマンドの出力は行頭に記号（`+--` 等）が付くため、awk/grep で行頭マッチ（`^`）を使うと取りこぼす。`/Container disk/` のように部分一致で探す
- `diskutil apfs list` の Volume 行は `APFS Volume Disk (Role):   diskNsM (Backup)` 形式。小文字 `Volume disk` ではマッチしない
- raw デバイスへ `fsync` をかけると ENOTTY になる（`end_fsync` を付けない）
- `awk` の `%d` は大きな整数で実装依存のため、桁区切り等の文字列処理では数値変換せず `ARGV` 経由で文字列として処理する
- `echo "$var"` は変数が `-n` 等で始まるとオプション誤認識するため、安全側は `printf '%s\n' "$var"` を使う
