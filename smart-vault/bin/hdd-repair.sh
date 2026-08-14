#!/bin/bash

# hdd-repair.sh — 外付けディスク全体へ fio で CRC＋オフセットパターン書込と読戻し照合を行い不良セクタの再割当てを促す
# 導入: brew install fio jq
# 終了コード: 0=成功 / 1=異常・JSON不正・対象変化など / 2=I/O・検証エラー検出

set -o pipefail

SCRIPT_DIR=$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 &&
        pwd -P
) || exit 1

LOCK_FILE="$SCRIPT_DIR/locks.txt"

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

TEMP_DIR=""

DISK_KEYS=()
LOCKED_FLAGS=()
SAVED_LOCKS=()

if [ ! -r "$SCRIPT_DIR/common.sh" ]; then
    echo "エラー: common.sh を読み込めません。"
    exit 1
fi
source "$SCRIPT_DIR/common.sh"

cleanup_files() {
    [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
}

handle_signal() {
    local exit_code="$1"
    trap - INT TERM
    exit "$exit_code"
}

trap cleanup_files EXIT
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

BS_OPTIONS=("64k" "256k" "1m" "4m")

bs_write_mibps() {
    case "$1" in
        64k) echo 5 ;;
        256k) echo 25 ;;
        1m) echo 36 ;;
        4m) echo 36 ;;
        *) return 1 ;;
    esac
}

bs_verify_mibps() {
    case "$1" in
        64k) echo 5 ;;
        256k) echo 20 ;;
        1m) echo 20 ;;
        4m) echo 20 ;;
        *) return 1 ;;
    esac
}

bs_to_bytes() {
    case "$1" in
        64k) echo 65536 ;;
        256k) echo 262144 ;;
        1m) echo 1048576 ;;
        4m) echo 4194304 ;;
        *) return 1 ;;
    esac
}

format_duration() {
    local total="$1"
    local days=$(( total / 86400 ))
    local h=$(( (total % 86400) / 3600 ))
    local m=$(( (total % 3600) / 60 ))
    local s=$(( total % 60 ))
    if [ "$days" -gt 0 ]; then
        printf '%d日 %02d:%02d:%02d' "$days" "$h" "$m" "$s"
    else
        printf '%02d:%02d:%02d' "$h" "$m" "$s"
    fi
}

estimate_runtime_sec() {
    local disk_size="$1"
    local bs_str="$2"
    local write_mibps verify_mibps
    write_mibps=$(bs_write_mibps "$bs_str") || return 1
    verify_mibps=$(bs_verify_mibps "$bs_str") || return 1
    awk -v size="$disk_size" -v w="$write_mibps" -v v="$verify_mibps" \
        'BEGIN { printf "%.0f", size / (w * 1048576) + size / (v * 1048576) }'
}

make_lock_key() {
    printf '%s|%s|%s\n' "$1" "$2" "$3"
}

load_locks() {
    [ -f "$LOCK_FILE" ] || return 0
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        printf '%s\n' "$line"
    done < "$LOCK_FILE"
}

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

persist_locks() {
    local final_locks=()
    local item i

    # 接続されていないディスクの既存ロックは維持
    for item in "${SAVED_LOCKS[@]}"; do
        if ! contains_key "$item" "${DISK_KEYS[@]}"; then
            final_locks+=("$item")
        fi
    done

    for i in "${!DISK_KEYS[@]}"; do
        if [ "${LOCKED_FLAGS[$i]}" = "1" ]; then
            final_locks+=("${DISK_KEYS[$i]}")
        fi
    done

    save_locks "${final_locks[@]}"
}

# 戻り値: 0=成功 / 1=異常・対象変化 / 2=I/O・検証エラー検出
run_repair() {
    local device="$1"
    local sel_model="$2"
    local sel_size="$3"
    local sel_protocol="$4"
    local io_bs="$5"
    local raw_device="/dev/r$device"
    local block_device="/dev/$device"

    local info_plist="$TEMP_DIR/disk-info.plist"
    local fio_output="$TEMP_DIR/fio-output.txt"
    local fio_prefix="$TEMP_DIR/fio-prefix.log"
    local fio_json="$TEMP_DIR/fio.json"
    local fio_err="$TEMP_DIR/fio.stderr"

    # 実行直前の再照合（抜き差しで対象が変わっていないか）
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

    # bs が論理ブロックサイズの倍数であることを確認
    local io_bs_bytes
    if ! io_bs_bytes=$(bs_to_bytes "$io_bs"); then
        echo "不正なブロックサイズです: $io_bs"
        return 1
    fi
    if [ $((io_bs_bytes % now_block_size)) -ne 0 ]; then
        echo "選択したブロックサイズが論理ブロックサイズの倍数ではありません。"
        echo "  bs=$io_bs_bytes / logical=$now_block_size"
        return 1
    fi

    echo "disk size:    $(format_bytes_with_commas "$disk_size") bytes ($(human_size "$disk_size"))"
    echo "io block:     $io_bs ($(format_bytes_with_commas "$io_bs_bytes") bytes / logical block=$(format_bytes_with_commas "$now_block_size") bytes)"
    echo "target(raw):  $raw_device"
    echo "-------------------------------------"

    if ! sudo diskutil unmountDisk force "$block_device" >/dev/null 2>&1; then
        echo "ディスク全体をアンマウントできませんでした: $block_device"
        return 1
    fi

    if [ ! -c "$raw_device" ]; then
        echo "raw デバイスが存在しません: $raw_device"
        return 1
    fi

    # fio は root 権限で動くためユーザー権限で事前作成し、所有者・権限を維持して後続の awk/jq が読めるようにする
    : > "$fio_output" || {
        echo "fio 出力ファイルを作成できませんでした"
        return 1
    }

    # --time_based/--runtime は verify フェーズが走らなくなるため使わない
    # end_fsync は macOS の raw デバイスで ENOTTY になるため付けない
    # --allow_file_create=0 で raw デバイス消失時にファイル新規作成を防ぐ
    # --verify_state_save=0 で再利用しない verify state ファイルを出さない
    # --output=<file> でJSONを別ファイルへ出すと stdout へ ETA 進捗が同一行更新される
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

    if [ -s "$fio_err" ]; then
        echo "--- fio メッセージ ---"
        cat "$fio_err" >&2
    fi

    # fio はエラー時に結果JSONの先頭へ平文メッセージを書くことがある。最初の "{" 以降を抽出する。
    # 壊れかけディスクではエラー行が大量になるため JSON前方出力は一時ファイルへ切り出す
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

    # continue_on_error=all で total_err は必ず記録される。欠落時は JSON 不正
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
    echo "written bytes:  $(format_bytes_with_commas "$write_bytes") / $(format_bytes_with_commas "$disk_size")"
    echo "verified bytes: $(format_bytes_with_commas "$read_bytes") / $(format_bytes_with_commas "$disk_size")"

    if [ "$first_error" -gt 0 ] || [ "$total_errors" -gt 0 ]; then
        if [ "$write_bytes" -eq "$disk_size" ] && [ "$read_bytes" -eq "$disk_size" ]; then
            echo "repair pass completed with errors: I/O・検証エラーを検出しました"
        elif [ "$write_bytes" -eq "$disk_size" ] && [ "$read_bytes" -eq 0 ]; then
            echo "repair pass ended with errors: 全域書込後にエラーが発生し、検証フェーズへ到達できませんでした"
        elif [ "$read_bytes" -eq 0 ]; then
            echo "repair pass ended with errors: 書込中にエラーが発生し、検証フェーズへ到達できませんでした"
        else
            echo "repair pass ended with errors: I/O・検証エラーと転送量不足を検出しました"
        fi
        echo "→ Smart/Fio のシェルで詳細な状態確認を行ってください"
        play_result_sound
        return 2
    fi

    if [ "$fio_status" -eq 0 ] &&
       [ "$first_error" -eq 0 ] &&
       [ "$total_errors" -eq 0 ] &&
       [ "$write_bytes" -eq "$disk_size" ] &&
       [ "$read_bytes" -eq "$disk_size" ]; then
        echo "repair pass succeeded: 全域書込・読戻し照合がエラーなく完了しました"
        play_result_sound
        return 0
    fi

    echo "repair failed: fio が全域処理を完遂していません"
    play_result_sound
    return 1
}

main() {
    TEMP_DIR=$(mktemp -d) || {
        echo "一時ディレクトリを作成できませんでした"
        return 1
    }

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

    SAVED_LOCKS=()
    while IFS= read -r line; do
        SAVED_LOCKS+=("$line")
    done < <(load_locks)

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

    local cursor=0
    local last_index=$((${#options[@]} - 1))
    local repair_status=1
    while true; do
        select_menu_lock "=== 外付けディスク一覧（Tab=ロック切替） ===" "LOCKED_FLAGS" "${options[@]}"
        cursor=$?

        if ! persist_locks; then
            echo "ロック状態を保存できませんでした。"
            return 1
        fi

        if [ "$cursor" -eq "$last_index" ]; then
            echo "プログラムを終了します。"
            return 0
        fi

        if [ "${LOCKED_FLAGS[$cursor]}" = "1" ]; then
            echo "このディスクはロックされています。Tab キーでロックを解除してください。"
            echo "-------------------------------------"
            continue
        fi

        local target_size="${disk_sizes[$cursor]}"
        local bs_options=()
        local b
        for b in "${BS_OPTIONS[@]}"; do
            local eta
            eta=$(estimate_runtime_sec "$target_size" "$b")
            bs_options+=("$b (概算: $(format_duration "$eta"))")
        done
        bs_options+=("戻る")
        select_menu "=== ブロックサイズを選択（大きいほど高速になりやすいが、エラー粒度は粗くなる） ===" "${bs_options[@]}"
        local bs_choice=$?
        if [ "$bs_choice" -eq $((${#bs_options[@]} - 1)) ]; then
            echo "キャンセルしました。"
            echo "-------------------------------------"
            continue
        fi
        local sel_bs="${BS_OPTIONS[$bs_choice]}"

        echo "対象: ${options[$cursor]}"
        echo "ブロックサイズ: $sel_bs"
        echo "このディスク全体のデータは全て失われます。よろしいですか？ [y/N]"
        local confirm
        read -r confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo "キャンセルしました。"
            echo "-------------------------------------"
            continue
        fi

        if ! sudo -v; then
            echo "sudo 認証に失敗したため中断します。"
            echo "-------------------------------------"
            continue
        fi

        run_repair \
            "${selectable_disks[$cursor]}" \
            "${disk_models[$cursor]}" \
            "${disk_sizes[$cursor]}" \
            "${disk_protocols[$cursor]}" \
            "$sel_bs"
        repair_status=$?
        echo "-------------------------------------"
        break
    done

    return "$repair_status"
}

main
