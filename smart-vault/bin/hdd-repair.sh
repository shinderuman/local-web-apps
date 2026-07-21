#!/bin/bash

# fio によるディスク全域書込＋検証を行う修復ツール
# Smart/Fio のシェルで結果が芳しくなかった外付けディスクに対し、全域への CRC＋オフセット
# パターン書込と読戻し照合を行い、不良セクタの再割当てを促す。
# 成否は fio の終了状態・全域の書込/読込バイト数・I/Oおよび検証エラー数で判定。
# 進捗は fio のライブ表示（%・速度・eta）。詳細な状態確認は Smart/Fio のシェルで行う前提。
# Tab キーで任意ディスクをロック（実行禁止）でき、ロック状態は locks.txt へ永続化する。
# 終了コード: 0=成功 / 1=異常・JSON不正・対象変化など / 2=I/O・検証エラー検出

set -o pipefail

# スクリプトディレクトリを絶対パス化
SCRIPT_DIR=$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 &&
        pwd -P
) || exit 1

# ロック状態の保存先（スクリプトと同じ bin/ 配下）
LOCK_FILE="$SCRIPT_DIR/locks.txt"

# 必須コマンドを絶対パスで解決（エイリアス/関数を避け PATH 上の実体を取得）
FIO_BIN=$(type -P fio 2>/dev/null)
JQ_BIN=$(type -P jq 2>/dev/null)
if [ -z "$FIO_BIN" ] ||
   ! "$FIO_BIN" --version 2>/dev/null | grep -Eq '^fio-[0-9]'; then
    echo "エラー: Flexible I/O Tester の fio を確認できません。'brew install fio' で導入してください。"
    exit 1
fi
if [ -z "$JQ_BIN" ]; then
    echo "エラー: jq がインストールされていません。'brew install jq' で導入してください。"
    exit 1
fi

# 一時ファイルをまとめるディレクトリ（中断時クリーンアップ用）
TEMP_DIR=""

# メニュー構築・ロック永続化で共有するグローバル配列（動的スコープ依存を避けるため明示）
DISK_KEYS=()
LOCKED_FLAGS=()
SAVED_LOCKS=()

# 共通UI関数（read_key, select_menu, select_menu_lock）を読み込み
if [ ! -r "$SCRIPT_DIR/common.sh" ]; then
    echo "エラー: common.sh を読み込めません。"
    exit 1
fi
source "$SCRIPT_DIR/common.sh"

# 一時ファイル削除（EXIT で実行）
cleanup_files() {
    [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
}

# シグナル受信時は確実に終了コードを返して終了
handle_signal() {
    local exit_code="$1"
    trap - INT TERM
    exit "$exit_code"
}

trap cleanup_files EXIT
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

# ========================================
# ディスク情報収集
# ========================================

# 外付け物理ディスク（external physical）の識別子を標準出力へ1行1つ出力。
# diskutil list の絞り込みにより、内蔵・APFS synthesized・仮想ディスク・パーティションを除外。
# 失敗時は非0を返す（pipefail によりパイプ内の失敗を捕捉）。
collect_disks() {
    diskutil list -plist external physical 2>/dev/null \
        | plutil -convert json -o - -- - 2>/dev/null \
        | "$JQ_BIN" -r '.WholeDisks[]?'
}

# 人間が読みやすいサイズ表記（バイト数 → GB/TB）に変換
human_size() {
    local bytes="$1"
    awk -v b="$bytes" 'BEGIN {
        gb = b / 1000000000
        if (gb >= 1000) {
            printf "%.1fTB", gb / 1000
        } else {
            printf "%.0fGB", gb
        }
    }'
}

# 指定 plist ファイルからキーの値を抽出（plutil -extract の raw 出力を使用）
# 引数: キー名, plist ファイルパス
plist_value() {
    local key="$1"
    local plist="$2"
    plutil -extract "$key" raw -o - "$plist" 2>/dev/null
}

# ディスク容量と論理ブロックサイズから、容量を割り切れるブロックサイズを選ぶ。
# デフォルト 64KiB から始め、割り切れない場合は半減し、論理ブロックサイズ未満にならない範囲で選ぶ。
# 引数: 容量（bytes）, 論理ブロックサイズ（bytes）
choose_io_bs() {
    local disk_size="$1"
    local logical_block_size="$2"
    local bs=65536

    if [[ ! "$logical_block_size" =~ ^[0-9]+$ ]] ||
       [ "$logical_block_size" -le 0 ] ||
       [ "$((disk_size % logical_block_size))" -ne 0 ]; then
        return 1
    fi

    while [ "$bs" -gt "$logical_block_size" ] &&
          [ "$((disk_size % bs))" -ne 0 ]; do
        bs=$((bs / 2))
    done

    if [ "$((bs % logical_block_size))" -ne 0 ] ||
       [ "$((disk_size % bs))" -ne 0 ]; then
        return 1
    fi
    printf '%s\n' "$bs"
}

# diskutil info の plist を1回取得し、主要情報を Unit Separator 区切りで出力。
# 抜き差し中の情報混在を防ぐため1回の取得から全項目を読み取る。
# 項目のいずれかが取得不能・不正、または内蔵ディスクなら失敗（return 1）。
# 引数: デバイス（diskN）, 出力先 plist ファイルパス
# 標準出力: "モデル<US>容量<US>プロトコル<US>論理ブロックサイズ"
fetch_disk_summary() {
    local device="$1"
    local plist="$2"
    if ! diskutil info -plist "/dev/$device" > "$plist" 2>/dev/null; then
        return 1
    fi
    local model size internal protocol block_size
    model=$(plist_value "IORegistryEntryName" "$plist")
    size=$(plist_value "TotalSize" "$plist")
    internal=$(plist_value "Internal" "$plist")
    protocol=$(plist_value "BusProtocol" "$plist")
    block_size=$(plist_value "DeviceBlockSize" "$plist")

    # いずれかが不正、または内蔵ディスクなら判定不能として除外
    if [ -z "$model" ] ||
       [[ ! "$size" =~ ^[0-9]+$ ]] ||
       [ "$size" -le 0 ] ||
       [ "$internal" != "false" ] ||
       [ -z "$protocol" ] ||
       [[ ! "$block_size" =~ ^[0-9]+$ ]] ||
       [ "$block_size" -le 0 ]; then
        return 1
    fi

    printf '%s\x1f%s\x1f%s\x1f%s\n' "$model" "$size" "$protocol" "$block_size"
}

# ロック識別キー（モデル名＋総容量＋プロトコル）を生成
# 引数: モデル名, 容量, プロトコル（いずれも fetch_disk_summary で非空・正の整数を保証済み）
make_lock_key() {
    printf '%s|%s|%s\n' "$1" "$2" "$3"
}

# 修復結果の通知音を鳴らす（失敗しても結果へ影響させない）
play_result_sound() {
    afplay /System/Library/Sounds/Glass.aiff >/dev/null 2>&1 || true
}

# ========================================
# ロック状態の永続化
# ========================================

# locks.txt からロック済みキーを標準出力へ1行1つ出力
load_locks() {
    [ -f "$LOCK_FILE" ] || return 0
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        printf '%s\n' "$line"
    done < "$LOCK_FILE"
}

# ロック済みキーを locks.txt へ原子的に上書き保存（一時ファイル経由で mv）
# 引数: キーのリスト（残り全引数）
save_locks() {
    local tmp item
    tmp=$(mktemp "${LOCK_FILE}.tmp.XXXXXX") || return 1
    for item in "$@"; do
        printf '%s\n' "$item" >> "$tmp" || {
            rm -f "$tmp"
            return 1
        }
    done
    if ! mv -f "$tmp" "$LOCK_FILE"; then
        rm -f "$tmp"
        return 1
    fi
}

# 配列内に指定キーが含まれるか（含まれれば 0、無ければ 1）
# 引数: キー, 配列要素（残り全引数）
contains_key() {
    local target="$1"
    shift
    local item
    for item in "$@"; do
        if [ "$item" = "$target" ]; then
            return 0
        fi
    done
    return 1
}

# ロック状態を locks.txt へ永続化。
# 接続されていないディスクの既存ロックは維持し、接続中ディスクの状態だけ更新する。
persist_locks() {
    local final_locks=()
    local item i

    # 現在接続されていないディスクの既存ロックを維持
    for item in "${SAVED_LOCKS[@]}"; do
        if ! contains_key "$item" "${DISK_KEYS[@]}"; then
            final_locks+=("$item")
        fi
    done

    # 現在接続中のロック状態を反映
    for i in "${!DISK_KEYS[@]}"; do
        if [ "${LOCKED_FLAGS[$i]}" = "1" ]; then
            final_locks+=("${DISK_KEYS[$i]}")
        fi
    done

    save_locks "${final_locks[@]}"
}

# ========================================
# 修復（fio による全域書込＋検証）
# ========================================

# 指定ディスクへ fio で全域書込＋CRC検証を行い、不良セクタの再割当てを促す
# 1回の fio 実行で「CRC＋オフセットパターン書込 → 読戻し照合」を完結する。
# 成否は fio の終了状態・全域の書込/読込バイト数・最初のエラー・総エラー数で判定。
# 引数:
#   $1 デバイス（diskN）
#   $2 選択時のモデル名（実行直前の再照合用）
#   $3 選択時の総容量（実行直前の再照合用）
#   $4 選択時のプロトコル（実行直前の再照合用）
# 戻り値: 0=成功 / 1=異常・対象変化など / 2=I/O・検証エラー検出
run_repair() {
    local device="$1"
    local sel_model="$2"
    local sel_size="$3"
    local sel_protocol="$4"
    local raw_device="/dev/r$device"
    local block_device="/dev/$device"

    local info_plist="$TEMP_DIR/disk-info.plist"
    local fio_output="$TEMP_DIR/fio-output.txt"
    local fio_prefix="$TEMP_DIR/fio-prefix.log"
    local fio_json="$TEMP_DIR/fio.json"
    local fio_err="$TEMP_DIR/fio.stderr"

    # 実行直前の再照合（モデル・容量・プロトコルが選択時から変わっていないか）
    local summary now_model now_size now_protocol now_block_size
    if ! summary=$(fetch_disk_summary "$device" "$info_plist"); then
        echo "対象ディスクの情報を取得できませんでした。中止します。"
        return 1
    fi
    IFS=$'\x1f' read -r now_model now_size now_protocol now_block_size <<< "$summary"
    if [ "$now_model" != "$sel_model" ] ||
       [ "$now_size" != "$sel_size" ] ||
       [ "$now_protocol" != "$sel_protocol" ]; then
        echo "対象ディスクの情報が選択時から変化しています（抜き差しの可能性）。中止します。"
        echo "  選択時: $sel_model ($sel_size bytes / $sel_protocol)"
        echo "  現在  : $now_model ($now_size bytes / $now_protocol)"
        return 1
    fi

    local disk_size="$now_size"
    local io_bs
    if ! io_bs=$(choose_io_bs "$disk_size" "$now_block_size"); then
        echo "ブロックサイズを決定できませんでした（容量=$disk_size / 論理block=$now_block_size）"
        return 1
    fi

    # ディスク全体を強制アンマウント（使用中でも解除。書込失敗を防ぐ）
    if ! sudo diskutil unmountDisk force "$block_device" >/dev/null 2>&1; then
        echo "ディスク全体をアンマウントできませんでした: $block_device"
        return 1
    fi

    # アンマウント後に raw デバイスが存在することを確認
    if [ ! -c "$raw_device" ]; then
        echo "raw デバイスが存在しません: $raw_device"
        return 1
    fi

    echo "disk size:    $disk_size bytes ($(human_size "$disk_size"))"
    echo "io block:     $io_bs bytes (logical block=$now_block_size)"
    echo "target(raw):  $raw_device"
    echo "-------------------------------------"

    # fio は root 権限で動くため、結果ファイルをユーザー権限で事前作成しておく。
    # fio は既存ファイルへ書き込むため所有者・権限が維持され、後続の awk/jq が確実に読める。
    : > "$fio_output" || {
        echo "fio 出力ファイルを作成できませんでした"
        return 1
    }

    # fio 実行（フォアグラウンド。1回で書込＋CRC検証を完結）
    # --time_based/--runtime は verify フェーズが走らなくなるため使わない
    # --direct=1 で直接書込するため fsync 不要。end_fsync は raw デバイスで ENOTTY を起こすため付けない
    # --allow_file_create=0 で raw デバイス消失時に新規ファイル作成を防ぐ
    # --verify_state_save=0 で中断時の verify state ファイル（再利用しない）を出さない
    # --output=<file> で結果JSONを別ファイルへ出すと、stdout へ ETA 進捗
    # （%・速度・IOPS・残り時間・フェーズ）が同一行を更新して表示される
    local fio_args=(
        --name=surface-repair
        --filename="$raw_device"
        --allow_file_create=0
        --rw=write
        --ioengine=psync
        --iodepth=1
        --direct=1
        --bs="$io_bs"
        --size="$disk_size"
        --verify=crc32c
        --verify_pattern=%o
        --do_verify=1
        --verify_fatal=0
        --verify_state_save=0
        --continue_on_error=all
        --output-format=json
        --output="$fio_output"
        --eta=always
    )
    local fio_status
    LC_ALL=C sudo "$FIO_BIN" "${fio_args[@]}" 2>"$fio_err"
    fio_status=$?

    # fio の警告・エラーを表示（verify/io_u error 等は stderr へ分離されている）
    if [ -s "$fio_err" ]; then
        echo "--- fio メッセージ ---"
        cat "$fio_err" >&2
    fi

    # fio はエラー発生時に結果JSONの先頭へ平文メッセージを書くことがある。
    # 最初の JSON 開始行 "{" 以降を抽出して jq 解析可能な JSON を得る。
    # 壊れかけディスクではエラー行が大量になるため、JSON前方出力は変数ではなく一時ファイルへ切り出す。
    awk '
        /^[[:space:]]*\{/ { exit }
        { print }
    ' "$fio_output" > "$fio_prefix"
    if [ -s "$fio_prefix" ]; then
        echo "--- fio 出力（JSON前方・先頭100行） ---"
        sed -n '1,100p' "$fio_prefix" >&2
    fi
    awk '
        /^[[:space:]]*\{/ { in_json = 1 }
        in_json { print }
    ' "$fio_output" > "$fio_json"

    # 結果JSONが完成しており、必要な数値フィールドが存在するか確認。
    # continue_on_error=all を常に指定するため total_err は必ず記録される。
    # 欠落時は JSON不正として終了コード1にする。
    if ! "$JQ_BIN" -e '
        (.jobs | type) == "array" and
        (.jobs | length) == 1 and
        (.jobs[0].error | type) == "number" and
        (.jobs[0].total_err | type) == "number" and
        (.jobs[0].write.io_bytes | type) == "number" and
        (.jobs[0].read.io_bytes | type) == "number"
    ' "$fio_json" >/dev/null 2>&1; then
        echo "repair failed: fio の結果JSONを取得できませんでした"
        echo "fio exit: $fio_status"
        play_result_sound
        return 1
    fi

    local first_error total_errors write_bytes read_bytes
    first_error=$("$JQ_BIN" -r '.jobs[0].error' "$fio_json")
    total_errors=$("$JQ_BIN" -r '.jobs[0].total_err' "$fio_json")
    write_bytes=$("$JQ_BIN" -r '.jobs[0].write.io_bytes' "$fio_json")
    read_bytes=$("$JQ_BIN" -r '.jobs[0].read.io_bytes' "$fio_json")

    echo "fio exit:       $fio_status"
    echo "first error:    $first_error"
    echo "total errors:   $total_errors"
    echo "written bytes:  $write_bytes / $disk_size"
    echo "verified bytes: $read_bytes / $disk_size"

    # 最初のエラーまたは総エラー数があれば I/O・検証エラー検出（書込/検証の到達状況で表示切り分け）
    if [ "$first_error" -gt 0 ] || [ "$total_errors" -gt 0 ]; then
        if [ "$write_bytes" -eq "$disk_size" ] && [ "$read_bytes" -eq "$disk_size" ]; then
            echo "repair pass completed with errors: I/O・検証エラーを検出しました"
        elif [ "$read_bytes" -eq 0 ]; then
            echo "repair pass ended with errors: 書込後にエラー発生、検証フェーズへ到達できませんでした"
        else
            echo "repair pass ended with errors: I/O・検証エラーと転送量不足を検出しました"
        fi
        echo "→ Smart/Fio のシェルで詳細な状態確認を行ってください"
        play_result_sound
        return 2
    fi

    # 全域書込・読戻しがエラーなく完了
    if [ "$fio_status" -eq 0 ] &&
       [ "$first_error" -eq 0 ] &&
       [ "$total_errors" -eq 0 ] &&
       [ "$write_bytes" -eq "$disk_size" ] &&
       [ "$read_bytes" -eq "$disk_size" ]; then
        echo "repair pass succeeded: 全域書込・読戻し照合がエラーなく完了しました"
        play_result_sound
        return 0
    fi

    # 上記以外: fio が全域処理を完遂していない
    echo "repair failed: fio が全域処理を完遂していません"
    play_result_sound
    return 1
}

# ========================================
# メインループ
# ========================================

main() {
    TEMP_DIR=$(mktemp -d) || {
        echo "一時ディレクトリを作成できませんでした"
        return 1
    }

    # 外付けディスク一覧を取得（失敗と0件を区別）
    local disk_list
    if ! disk_list=$(collect_disks); then
        echo "外付けディスク一覧の取得に失敗しました。"
        return 1
    fi
    local disks=()
    if [ -n "$disk_list" ]; then
        while IFS= read -r line; do
            [ -n "$line" ] && disks+=("$line")
        done <<< "$disk_list"
    fi
    if [ "${#disks[@]}" -eq 0 ]; then
        echo "対象となる外付けディスクが見つかりませんでした。"
        return 1
    fi

    # 保存済みロックを読み込み
    SAVED_LOCKS=()
    while IFS= read -r line; do
        SAVED_LOCKS+=("$line")
    done < <(load_locks)

    # 情報取得に成功したディスクだけを表示対象へ集める（disks と表示用配列のインデックスを一致させる）
    local selectable_disks=()
    local options=()
    DISK_KEYS=()
    LOCKED_FLAGS=()
    local disk_models=()
    local disk_sizes=()
    local disk_protocols=()
    local d
    for d in "${disks[@]}"; do
        local summary model size protocol _block_size key display
        if ! summary=$(fetch_disk_summary "$d" "$TEMP_DIR/info-$d.plist"); then
            continue
        fi
        IFS=$'\x1f' read -r model size protocol _block_size <<< "$summary"

        selectable_disks+=("$d")
        disk_models+=("$model")
        disk_sizes+=("$size")
        disk_protocols+=("$protocol")

        key=$(make_lock_key "$model" "$size" "$protocol")
        DISK_KEYS+=("$key")

        display="$d ($(human_size "$size") / $model / $protocol)"
        options+=("$display")

        if contains_key "$key" "${SAVED_LOCKS[@]}"; then
            LOCKED_FLAGS+=(1)
        else
            LOCKED_FLAGS+=(0)
        fi
    done
    if [ "${#selectable_disks[@]}" -eq 0 ]; then
        echo "情報を正常に取得できる外付けディスクがありませんでした。"
        return 1
    fi
    options+=("終了")
    LOCKED_FLAGS+=(0)

    # メニュー（Tab でロックトグルしつつ継続、Enter で決定）
    local cursor=0
    local last_index=$((${#options[@]} - 1))
    local repair_status=1
    while true; do
        select_menu_lock "=== 外付けディスク一覧（Tab=ロック切替） ===" "LOCKED_FLAGS" "${options[@]}"
        cursor=$?

        # メニュー確定ごとにロック状態を保存（「終了」選択時も保存される）
        if ! persist_locks; then
            echo "ロック状態を保存できませんでした。"
            return 1
        fi

        # 終了
        if [ "$cursor" -eq "$last_index" ]; then
            echo "プログラムを終了します。"
            return 0
        fi

        # 選択したディスクがロック中か判定
        if [ "${LOCKED_FLAGS[$cursor]}" = "1" ]; then
            echo "このディスクはロックされています。Tab キーでロックを解除してください。"
            echo "-------------------------------------"
            continue
        fi

        # 実行確認
        echo "対象: ${options[$cursor]}"
        echo "このディスク全体のデータは全て失われます。よろしいですか？ [y/N]"
        local confirm
        read -r confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo "キャンセルしました。"
            echo "-------------------------------------"
            continue
        fi

        # sudo 認証を事前に取得
        if ! sudo -v; then
            echo "sudo 認証に失敗したため中断します。"
            echo "-------------------------------------"
            continue
        fi

        # 修復実行（selectable_disks を使うため表示と実行対象が一致）
        run_repair \
            "${selectable_disks[$cursor]}" \
            "${disk_models[$cursor]}" \
            "${disk_sizes[$cursor]}" \
            "${disk_protocols[$cursor]}"
        repair_status=$?
        echo "-------------------------------------"
        break
    done

    return "$repair_status"
}

main
