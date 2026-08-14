#!/bin/bash

# timemachine-clone.sh — Time Machine 用ストレージの APFS 構造ごと別ディスクへ ddrescue でクローン
# 導入: brew install ddrescue jq
# 終了コード: 0=成功・メニューから終了 / 1=異常・確認後の中止

set -o pipefail

SCRIPT_DIR=$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 &&
        pwd -P
) || exit 1

JQ_BIN=$(type -P jq 2>/dev/null)
DDRESCUE_BIN=$(type -P ddrescue 2>/dev/null)
if [ -z "$JQ_BIN" ]; then
    echo "エラー: jq がインストールされていません。'brew install jq' で導入してください。"
    exit 1
fi
if [ -z "$DDRESCUE_BIN" ]; then
    echo "エラー: ddrescue がインストールされていません。'brew install ddrescue' で導入してください。"
    exit 1
fi
for cmd in diskutil tmutil plutil caffeinate; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "エラー: 必須コマンドがありません: $cmd"
        exit 1
    fi
done

DDRESCUE_RETRY_COUNT=3

TEMP_DIR=""

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

read_line() {
    local var="$1"
    IFS= read -r "$var"
}

device_size() {
    local size
    size=$(diskutil info -plist "/dev/$1" 2>/dev/null | plutil -extract TotalSize raw -o - -- - 2>/dev/null)
    if [ -z "$size" ]; then
        size=$(diskutil info -plist "/dev/$1" 2>/dev/null | plutil -extract Size raw -o - -- - 2>/dev/null)
    fi
    printf '%s' "$size"
}

# MinimumSizeNoGuard は実データ制約の hard floor（推奨値 MinimumSizePreferred ではない）
get_apfs_minimum_resize_size() {
    local container="$1"
    local min_size
    min_size=$(diskutil apfs resizeContainer "/dev/$container" limits -plist 2>/dev/null |
        plutil -extract MinimumSizeNoGuard raw -o - -- - 2>/dev/null)
    if ! [[ "$min_size" =~ ^[0-9]+$ ]] || [ "$min_size" -le 0 ]; then
        return 1
    fi
    printf '%s' "$min_size"
}

show_device() {
    printf '\n--- /dev/%s ---\n' "$1"
    diskutil info "/dev/$1" 2>/dev/null |
        grep -E 'Device Identifier|Device Node|Whole|Part of Whole|Disk Size|Container Total Space|Volume Name|Mount Point|APFS.*Role' || true
}

# diskutil apfs list は行頭に "+--" 等が付くため行頭限定せず "Container disk" を含む行の $3 から diskN を取る
find_apfs_container_ref() {
    local device="$1"
    diskutil apfs list 2>/dev/null |
        awk -v dev="$device" '
            /Container disk/ { container = $3 }
            $0 ~ "Container Reference:[[:space:]]+" dev "$" { print container; exit }
            $0 ~ "Physical Store " dev " " { print container; exit }
            $0 ~ "Physical Store Disk:[[:space:]]+" dev "$" { print container; exit }
        '
}

find_backup_volume() {
    local container="$1"
    diskutil apfs list "$container" 2>/dev/null |
        awk '
            /APFS Volume Disk \(Role\):/ && /\(Backup\)/ {
                for (i = 1; i <= NF; i++) {
                    if ($i ~ /^disk[0-9]+s[0-9]+$/) {
                        print $i
                        exit
                    }
                }
            }
        '
}

# ddrescue 入力(SOURCE_STORE)は Container(synthesized)にしパーティション内の小さいコンテナだけコピーする
resolve_source() {
    local selected="$1"
    local container tm_volume

    container=$(find_apfs_container_ref "$selected")
    [ -n "$container" ] && tm_volume=$(find_backup_volume "$container")

    printf '\n--- コピー元のAPFS構造（自動判定） ---\n'
    printf '選択ディスク: %s\n' "$selected"
    printf 'Container:    %s\n' "${container:-(未検出)}"
    printf 'Backup Volume:%s\n' "${tm_volume:-(未検出)}"

    if [ -z "$container" ] || [ -z "$tm_volume" ]; then
        warn "コピー元のAPFS構造を自動判定できませんでした。diskutil apfs list を参考に入力してください。"
        diskutil apfs list 2>/dev/null | sed -n '1,40p'
        printf '\nコピー元の synthesized APFS Container を入力（例: disk15）: '
        read_line container
        printf 'コピー元の Backup ロール Time Machine Volume を入力（例: disk15s2）: '
        read_line tm_volume
    fi

    SOURCE_STORE="$container"
    SOURCE_CONTAINER="$container"
    SOURCE_TM_VOLUME="$tm_volume"
    SOURCE_EJECT_DISK="$selected"
}

resolve_target_pre() {
    local selected="$1"
    TARGET_STORE="$selected"
    TARGET_UNMOUNT_DISK="$selected"
    TARGET_EJECT_DISK="$selected"
    printf '\n--- コピー先（コピー前） ---\n'
    printf ' ddrescue 出力デバイス: %s\n' "$TARGET_STORE"
}

resolve_target_post() {
    local selected="$1"
    local container tm_volume

    container=$(find_apfs_container_ref "$selected")
    [ -n "$container" ] && tm_volume=$(find_backup_volume "$container")

    printf '\n--- コピー先(再接続後)のAPFS構造（自動判定） ---\n'
    printf '選択ディスク: %s\n' "$selected"
    printf 'Container:    %s\n' "${container:-(未検出)}"
    printf 'Backup Volume:%s\n' "${tm_volume:-(未検出)}"

    if [ -z "$container" ] || [ -z "$tm_volume" ]; then
        warn "コピー先のAPFS構造を自動判定できませんでした。diskutil apfs list を参考に入力してください。"
        diskutil apfs list 2>/dev/null | sed -n '1,40p'
        printf '\nコピー先の synthesized APFS Container を入力（例: disk15）: '
        read_line container
        printf 'コピー先の Backup ロール Time Machine Volume を入力（例: disk15s2）: '
        read_line tm_volume
    fi

    TARGET_STORE="$selected"
    TARGET_CONTAINER="$container"
    TARGET_TM_VOLUME="$tm_volume"
}

list_external_disks() {
    local d summary
    while IFS= read -r d; do
        [ -n "$d" ] || continue
        if summary=$(fetch_disk_summary "$d" "$TEMP_DIR/info-$d.plist"); then
            local model size protocol _block
            IFS=$'\x1f' read -r model size protocol _block <<< "$summary"
            printf '%s\x1f%s\x1f%s\x1f%s\n' "$d" "$model" "$size" "$protocol"
        fi
    done < <(collect_disks)
}

# select_menu は stdout へ出すためコマンド置換せず $? で受けて配列から引く
select_disk_menu() {
    local label="$1"
    local exclude="$2"
    SELECTED_DISK=""
    while true; do
        local disk_list disk _model size protocol
        disk_list=$(list_external_disks)
        local options=()
        local selectable=()
        while IFS= read -r line; do
            [ -n "$line" ] || continue
            IFS=$'\x1f' read -r disk _model size protocol <<< "$line"
            [ "$disk" = "$exclude" ] && continue
            selectable+=("$disk")
            options+=("$disk ($(human_size "$size") / $_model / $protocol)")
        done <<< "$disk_list"

        options+=("再読込")
        options+=("終了")

        select_menu "=== $labelディスクを選択 ===" "${options[@]}"
        local choice=$?
        local last_index=$((${#options[@]} - 1))
        local reload_index=$((last_index - 1))

        if [ "$choice" -eq "$last_index" ]; then
            printf '%s\n' "$label選択を終了します。"
            return 1
        fi
        if [ "$choice" -eq "$reload_index" ]; then
            continue
        fi
        SELECTED_DISK="${selectable[$choice]}"
        return 0
    done
}

stop_time_machine() {
    sudo tmutil stopbackup >/dev/null 2>&1 || true
    sudo tmutil disable >/dev/null 2>&1 || true
}

unmount_tm_snapshot_mounts() {
    local tm_volume="$1"
    local mount_point
    while IFS= read -r mount_point; do
        [ -n "$mount_point" ] || continue
        printf 'スナップショットをアンマウント: %s\n' "$mount_point"
        sudo diskutil unmount force "$mount_point" || true
    done < <(mount | sed -nE "s#^.*@/dev/${tm_volume} on (.*) \\(apfs.*#\\1#p")
}

mounts_remain_for_tm_volume() {
    mount | grep -q "@/dev/${1} on "
}

ensure_target_mounted() {
    sudo diskutil mount "/dev/$1" >/dev/null 2>&1 || true
    TM_MOUNT_PATH=$(diskutil info -plist "/dev/$1" 2>/dev/null | plutil -extract MountPoint raw -o - -- - 2>/dev/null)
    [ -n "$TM_MOUNT_PATH" ] || return 1
    [ -d "$TM_MOUNT_PATH" ] || return 1
    return 0
}

list_backups() {
    local output_file="$1"
    local tm_volume="$2"
    local raw_file="$WORK_LISTBACKUPS_RAW"

    : > "$output_file"
    ensure_target_mounted "$tm_volume" || return 1

    if ! sudo tmutil listbackups -d "$TM_MOUNT_PATH" -t > "$raw_file" 2>/dev/null; then
        return 1
    fi
    grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{6}$' "$raw_file" | sort -u > "$output_file" || true
    return 0
}

backup_count() {
    awk 'END { print NR + 0 }' "$1"
}

timestamp_to_epoch() {
    /bin/date -j -f '%Y-%m-%d-%H%M%S' "$1" '+%s' 2>/dev/null
}

delete_backups_from_file() {
    local input_file="$1"
    local tm_volume="$2"
    local count
    local -a delete_command

    count=$(backup_count "$input_file")
    [ "$count" -gt 0 ] || return 0

    ensure_target_mounted "$tm_volume" || die "Time Machineボリュームをマウントできませんでした"

    log "Time Machine履歴を${count}件削除"
    cat "$input_file"

    delete_command=(sudo tmutil delete -d "$TM_MOUNT_PATH")
    local timestamp
    while IFS= read -r timestamp; do
        [ -n "$timestamp" ] || continue
        delete_command+=( -t "$timestamp" )
    done < "$input_file"

    "${delete_command[@]}" || return 1
    sync
    return 0
}

build_recent_24h_delete_list() {
    local input_file="$1"
    local output_file="$2"
    local latest now_epoch cutoff_epoch timestamp timestamp_epoch

    : > "$output_file"
    latest=$(tail -n 1 "$input_file")
    [ -n "$latest" ] || return 0

    now_epoch=$(date '+%s')
    cutoff_epoch=$((now_epoch - 86400))

    while IFS= read -r timestamp; do
        [ -n "$timestamp" ] || continue
        [ "$timestamp" = "$latest" ] && continue
        timestamp_epoch=$(timestamp_to_epoch "$timestamp")
        [ -n "$timestamp_epoch" ] || continue
        if [ "$timestamp_epoch" -ge "$cutoff_epoch" ]; then
            printf '%s\n' "$timestamp" >> "$output_file"
        fi
    done < "$input_file"
}

build_weekly_delete_list() {
    local input_file="$1"
    local output_file="$2"
    local first_timestamp first_epoch timestamp timestamp_epoch bucket last_bucket=""

    : > "$output_file"
    first_timestamp=$(head -n 1 "$input_file")
    [ -n "$first_timestamp" ] || return 0

    first_epoch=$(timestamp_to_epoch "$first_timestamp")
    [ -n "$first_epoch" ] || return 1

    while IFS= read -r timestamp; do
        [ -n "$timestamp" ] || continue
        timestamp_epoch=$(timestamp_to_epoch "$timestamp")
        [ -n "$timestamp_epoch" ] || continue
        bucket=$(((timestamp_epoch - first_epoch) / 604800))
        if [ "$bucket" != "$last_bucket" ]; then
            last_bucket="$bucket"
            continue
        fi
        printf '%s\n' "$timestamp" >> "$output_file"
    done < "$input_file"
}

build_monthly_delete_list() {
    local input_file="$1"
    local output_file="$2"
    local timestamp month last_month=""

    : > "$output_file"
    while IFS= read -r timestamp; do
        [ -n "$timestamp" ] || continue
        month="${timestamp:0:7}"
        if [ "$month" != "$last_month" ]; then
            last_month="$month"
            continue
        fi
        printf '%s\n' "$timestamp" >> "$output_file"
    done < "$input_file"
}

prepare_target_offline() {
    local container="$1"
    local tm_volume="$2"

    stop_time_machine
    unmount_tm_snapshot_mounts "$tm_volume"
    sudo diskutil unmountDisk force "/dev/$container" >/dev/null 2>&1 || true
    # 1度目で別履歴マウントが見えることがあるため再実行
    unmount_tm_snapshot_mounts "$tm_volume"
    sudo diskutil unmountDisk force "/dev/$container" >/dev/null 2>&1 || true

    if mounts_remain_for_tm_volume "$tm_volume"; then
        mount | grep "@/dev/${tm_volume} on " >&2 || true
        return 1
    fi
    return 0
}

run_apfs_repair() {
    local container="$1"
    log "fsck_apfs でAPFSコンテナを自動修復"
    sudo /sbin/fsck_apfs -y -o -T -D -s "/dev/r$container" || true
}

try_resize_without_repair() {
    local container="$1"
    local tm_volume="$2"
    prepare_target_offline "$container" "$tm_volume" || return 1

    log "APFSコンテナを最大容量まで拡張"
    if sudo diskutil apfs resizeContainer "/dev/$container" 0; then
        ensure_target_mounted "$tm_volume" || true
        return 0
    fi
    ensure_target_mounted "$tm_volume" || true
    return 1
}

repair_and_try_resize() {
    local stage_name="$1"
    local container="$2"
    local tm_volume="$3"

    log "$stage_name"
    prepare_target_offline "$container" "$tm_volume" || {
        warn "Time Machineスナップショットを完全にアンマウントできませんでした"
        ensure_target_mounted "$tm_volume" || true
        return 1
    }

    run_apfs_repair "$container"

    log "修復後にAPFSコンテナを最大容量まで拡張"
    if sudo diskutil apfs resizeContainer "/dev/$container" 0; then
        ensure_target_mounted "$tm_volume" || true
        return 0
    fi
    ensure_target_mounted "$tm_volume" || true
    return 1
}

# 履歴全喪失の最終フォールバック
recreate_target_apfs() {
    local store="$1"
    local container="$2"
    local tm_volume="$3"
    local recreate_name whole

    recreate_name=$(diskutil info -plist "/dev/$tm_volume" 2>/dev/null | plutil -extract VolumeName raw -o - -- - 2>/dev/null)
    [ -n "$recreate_name" ] || recreate_name="Time Machine"

    warn "履歴の段階的な削除とAPFS修復でも拡張できませんでした"
    warn "コピー先APFSを新規作成します。コピー先のTime Machine履歴はすべて失われます"

    prepare_target_offline "$container" "$tm_volume" || true

    whole=$(diskutil info -plist "/dev/$store" 2>/dev/null | plutil -extract Whole raw -o - -- - 2>/dev/null)
    if [ "$whole" = "true" ] || [ "$whole" = "Yes" ]; then
        sudo diskutil eraseDisk APFS "$recreate_name" GPT "/dev/$store" || return 1
    else
        sudo diskutil eraseVolume APFS "$recreate_name" "/dev/$store" || return 1
    fi

    printf '\ndiskutil apfs list で新規作成後の Container / Volume を確認してください\n'
    diskutil apfs list 2>/dev/null | sed -n '1,40p'
    printf '\n新規作成後の synthesized APFS Container を入力（例: disk15）: '
    read_line container
    printf '新規作成後の Time Machine Volume を入力（例: disk15s1）: '
    read_line tm_volume

    TARGET_CONTAINER="$container"
    TARGET_TM_VOLUME="$tm_volume"

    [ -e "/dev/$container" ] || return 1
    [ -e "/dev/$tm_volume" ] || return 1

    ensure_target_mounted "$tm_volume" || return 1

    sudo diskutil apfs changeVolumeRole "/dev/$tm_volume" T ||
        warn "Backupロールを設定できませんでした。tmutil setdestination時に再確認してください"
    return 0
}

main() {
    TEMP_DIR=$(mktemp -d) || {
        echo "一時ディレクトリを作成できませんでした"
        exit 1
    }
    WORK_LISTBACKUPS_RAW="$TEMP_DIR/listbackups.raw"

    log "コピー元ディスクを選択"
    select_disk_menu "コピー元" "" || exit 0
    local source_disk="$SELECTED_DISK"
    resolve_source "$source_disk"

    log "コピー先ディスクを選択"
    select_disk_menu "コピー先" "$source_disk" || exit 0
    local target_disk="$SELECTED_DISK"
    resolve_target_pre "$target_disk"

    local source_size target_size
    local source_was_shrunk=0
    local source_shrink_size=""
    local shrink_free_margin_bytes=5000000000
    local target_end_margin_bytes=1000000000
    source_size=$(device_size "$SOURCE_STORE")
    target_size=$(device_size "$TARGET_STORE")

    show_device "$SOURCE_STORE"
    show_device "$SOURCE_CONTAINER"
    show_device "$SOURCE_TM_VOLUME"
    show_device "$TARGET_STORE"
    show_device "$TARGET_UNMOUNT_DISK"

    if [ -n "$source_size" ] && [ -n "$target_size" ]; then
        printf '\nコピー元サイズ: %s bytes (%s)\n' "$(format_bytes_with_commas "$source_size")" "$(human_size "$source_size")"
        printf 'コピー先サイズ: %s bytes (%s)\n' "$(format_bytes_with_commas "$target_size")" "$(human_size "$target_size")"
        if [ "$target_size" -lt "$source_size" ]; then
            local source_minimum_size desired_shrink_size target_max_size
            source_minimum_size=$(get_apfs_minimum_resize_size "$SOURCE_CONTAINER") ||
                die "コピー元APFSコンテナの縮小可能な最小サイズを取得できませんでした"

            desired_shrink_size=$((source_minimum_size + shrink_free_margin_bytes))
            target_max_size=$((target_size - target_end_margin_bytes))

            [ "$target_max_size" -gt 0 ] ||
                die "コピー先容量から有効な最大コピーサイズを算出できませんでした"

            if [ "$desired_shrink_size" -gt "$target_max_size" ]; then
                printf 'APFS最小縮小サイズ: %s bytes (%s)\n' \
                    "$(format_bytes_with_commas "$source_minimum_size")" "$(human_size "$source_minimum_size")"
                printf '安全余白:            %s bytes (%s)\n' \
                    "$(format_bytes_with_commas "$shrink_free_margin_bytes")" "$(human_size "$shrink_free_margin_bytes")"
                printf '縮小予定サイズ:     %s bytes (%s)\n' \
                    "$(format_bytes_with_commas "$desired_shrink_size")" "$(human_size "$desired_shrink_size")"
                printf 'コピー先容量:      %s bytes (%s)\n' \
                    "$(format_bytes_with_commas "$target_size")" "$(human_size "$target_size")"
                die "コピー元APFSコンテナの最小必要サイズは$(human_size "$source_minimum_size")です。5GBの安全余白を含めるとコピー先へ収まらないため、コピーを開始しません。"
            fi

            source_was_shrunk=1
            source_shrink_size="${desired_shrink_size}B"
            printf 'APFS最小縮小サイズ: %s bytes (%s)\n' \
                "$(format_bytes_with_commas "$source_minimum_size")" "$(human_size "$source_minimum_size")"
            printf '安全余白:            %s bytes (%s)\n' \
                "$(format_bytes_with_commas "$shrink_free_margin_bytes")" "$(human_size "$shrink_free_margin_bytes")"
            printf '縮小予定サイズ:     %s bytes (%s)\n' \
                "$(format_bytes_with_commas "$desired_shrink_size")" "$(human_size "$desired_shrink_size")"
            printf 'コピー先容量:      %s bytes (%s)\n' \
                "$(format_bytes_with_commas "$target_size")" "$(human_size "$target_size")"
            printf 'コピー先に残す余裕: %s bytes (%s)\n' \
                "$(format_bytes_with_commas "$target_end_margin_bytes")" "$(human_size "$target_end_margin_bytes")"
            warn "コピー先が小さいため、コピー元APFSコンテナを一時的に${source_shrink_size}へ縮小します"
        else
            log "コピー先容量はコピー元APFSコンテナ以上です"
        fi
    else
        warn "サイズを自動取得できませんでした。コピー先がコピー元以上か手動確認してください"
    fi

    if [ "$source_was_shrunk" -eq 1 ]; then
        cat <<EOF_CONFIRM

コピー元: /dev/$SOURCE_STORE
コピー先: /dev/$TARGET_STORE

コピー先がコピー元より小さいため、コピー元APFSコンテナを一時的に${source_shrink_size}へ縮小します。
縮小に失敗した場合はコピーを開始しません。
コピー完了後、コピー元コンテナを最大容量へ戻します。

処理を途中で中断した場合、コピー元が縮小されたまま残ることがあります。
その場合は diskutil apfs resizeContainer 対象コンテナ 0 で元に戻せます。

コピー先の内容は完全に失われます。
APFS修復に失敗した場合は履歴を段階的に削除し、最終的にコピー先APFSを新規作成する可能性があります。
EOF_CONFIRM
    else
        cat <<EOF_CONFIRM

コピー元: /dev/$SOURCE_STORE
コピー先: /dev/$TARGET_STORE

コピー先の内容は完全に失われます。
APFS修復に失敗した場合は履歴を段階的に削除し、最終的にコピー先APFSを新規作成する可能性があります。
EOF_CONFIRM
    fi

    printf '\nこのディスク全体のデータは全て失われます。よろしいですか？ [y/N] '
    local confirm
    read_line confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || die "中止しました"

    sudo -v || die "sudo認証に失敗しました"

    log "Time Machineを停止"
    stop_time_machine

    if [ "$source_was_shrunk" -eq 1 ]; then
        log "コピー元APFSコンテナを一時的に縮小: $source_shrink_size"

        unmount_tm_snapshot_mounts "$SOURCE_TM_VOLUME"

        sudo diskutil apfs resizeContainer \
            "/dev/$SOURCE_CONTAINER" \
            "$source_shrink_size" ||
            die "コピー元APFSコンテナを${source_shrink_size}へ縮小できませんでした"

        source_size=$(device_size "$SOURCE_STORE")

        [ -n "$source_size" ] ||
            die "縮小後のコピー元サイズを取得できませんでした"

        [ "$source_size" -le "$target_size" ] ||
            die "縮小後もコピー元がコピー先より大きいためコピーできません"

        printf '縮小後のコピー元サイズ: %s bytes (%s)\n' \
            "$(format_bytes_with_commas "$source_size")" \
            "$(human_size "$source_size")"
    fi

    log "コピー元のTime Machineスナップショットの個別マウントを解除"
    unmount_tm_snapshot_mounts "$SOURCE_TM_VOLUME"
    sudo diskutil unmountDisk force "/dev/$SOURCE_CONTAINER" ||
        die "コピー元APFSコンテナをアンマウントできませんでした"
    unmount_tm_snapshot_mounts "$SOURCE_TM_VOLUME"
    sudo diskutil unmountDisk force "/dev/$SOURCE_CONTAINER" >/dev/null 2>&1 || true
    if mounts_remain_for_tm_volume "$SOURCE_TM_VOLUME"; then
        mount | grep "@/dev/${SOURCE_TM_VOLUME} on " >&2 || true
        die "コピー元のTime Machineスナップショットがまだマウントされています"
    fi

    log "コピー先をアンマウント"
    sudo diskutil unmountDisk force "/dev/$TARGET_UNMOUNT_DISK" ||
        die "コピー先をアンマウントできませんでした"

    # mapfile は中断・再開に備え永続パスへ。誤再利用を防ぐため再利用確認を取る
    local mapfile="$SCRIPT_DIR/timemachine-clone.map"
    if [ -f "$mapfile" ]; then
        cat <<EOF

既存のddrescue mapfileがあります。
  $mapfile
前回と同じコピー元・コピー先の続きなら再利用、別の組み合わせなら削除して最初から開始します。
EOF
        printf '既存mapfileを再利用しますか？ [y/N] '
        local reuse_mapfile
        read_line reuse_mapfile
        if [[ ! "$reuse_mapfile" =~ ^[Yy]$ ]]; then
            rm -f "$mapfile" || die "既存mapfileを削除できませんでした"
        fi
    fi

    log "ddrescue開始: /dev/r$SOURCE_STORE → /dev/r$TARGET_STORE"
    printf 'mapfile: %s\n' "$mapfile"

    # 第1パス: 読める領域を優先し難しい領域は後回しにする（-n）
    sudo caffeinate -im "$DDRESCUE_BIN" \
        -f -n \
        "/dev/r$SOURCE_STORE" \
        "/dev/r$TARGET_STORE" \
        "$mapfile" || die "ddrescue第1パスが異常終了しました"

    if [ "$DDRESCUE_RETRY_COUNT" -gt 0 ]; then
        log "ddrescue再試行パス"
        sudo caffeinate -im "$DDRESCUE_BIN" \
            -f -r"$DDRESCUE_RETRY_COUNT" \
            "/dev/r$SOURCE_STORE" \
            "/dev/r$TARGET_STORE" \
            "$mapfile" || die "ddrescue再試行パスが異常終了しました"
    fi

    sync
    log "ブロックコピー完了"

    # ddrescue 終了コード0は正常終了を意味するだけで全ブロック回収完了とは限らない。
    # bad-sector 残りでも正常終了するため ddrescuelog --delete-if-done で全領域回収済みか確認する。
    # 未回収領域があるまま後続へ進むと、後から mapfile で再開した際に修復後データを
    # 元ディスクブロックで上書きする危険があるため停止する。
    local ddrescuelog_bin
    ddrescuelog_bin=$(type -P ddrescuelog 2>/dev/null)
    if [ -z "$ddrescuelog_bin" ]; then
        die "ddrescuelog が見つからないため、全領域を回収できたか確認できません"
    fi
    if "$ddrescuelog_bin" --delete-if-done "$mapfile"; then
        log "全領域を回収できたためmapfileを削除しました"
    else
        die "未回収領域が残っています。同じコピー元・コピー先とmapfileで再実行してください: $mapfile"
    fi

    # UUID重複解消のため From を外して To だけ再接続
    log "コピー元とコピー先を取り出す"
    # eject 失敗時は物理切断前の安全確保のため中止する
    if [ -n "$TARGET_EJECT_DISK" ]; then
        sudo diskutil eject "/dev/$TARGET_EJECT_DISK" ||
            die "コピー先をejectできませんでした。物理切断前に安全な状態へできません"
    fi

    # コピー先が接続されたままコピー元をリサイズしないこと（同一APFS UUIDのため）
    if [ "$source_was_shrunk" -eq 1 ]; then
        log "コピー元APFSコンテナを最大容量へ戻す"

        if sudo diskutil apfs resizeContainer "/dev/$SOURCE_CONTAINER" 0; then
            log "コピー元APFSコンテナを最大容量へ戻しました"
        else
            warn "コピー元APFSコンテナを最大容量へ戻せませんでした"
            warn "コピー元は縮小された状態ですが、APFSデータ自体はそのままです"
            warn "後で次のコマンドを実行してください:"
            warn "sudo diskutil apfs resizeContainer /dev/$SOURCE_CONTAINER 0"
        fi
    fi

    if [ -n "$SOURCE_EJECT_DISK" ]; then
        sudo diskutil eject "/dev/$SOURCE_EJECT_DISK" ||
            die "コピー元をejectできませんでした。アンマウント状況を確認してください"
    fi

    cat <<'EOF_RECONNECT'

次の操作を行ってください。

1. コピー元を物理的に切断する
2. コピー先も一度切断する
3. コピー先だけを再接続する
4. コピー先がmacOSに認識されるまで待つ

コピー元とコピー先は同じAPFS UUIDを持つため、両方を同時にマウントしません。
EOF_RECONNECT

    printf 'コピー先だけを再接続したらEnterを押してください: '
    read_line _

    log "再接続後のデバイス一覧"
    diskutil list
    diskutil apfs list

    log "再接続後のコピー先ディスクを選択"
    select_disk_menu "コピー先(再接続後)" "" || die "コピー先の再選択に失敗しました"
    local target_disk_after="$SELECTED_DISK"
    resolve_target_post "$target_disk_after"

    log "コピー先のTime Machineボリュームをマウント"
    ensure_target_mounted "$TARGET_TM_VOLUME" || die "コピー先のTime Machineボリュームをマウントできませんでした"

    local backups_file="$TEMP_DIR/backups.txt"

    log "コピー直後のTime Machine履歴を確認"
    if list_backups "$backups_file" "$TARGET_TM_VOLUME"; then
        printf '履歴数: %s\n' "$(backup_count "$backups_file")"
        cat "$backups_file"
    else
        warn "コピー直後のTime Machine履歴を列挙できませんでした"
    fi

    # 登録できていない状態でバックアップを走らせると別の保存先へ書き込む危険があるため
    # setdestination 失敗時は startbackup をスキップする。
    # 縮小コピー時は空きが少ないため保存先登録前にコピー先全体へ拡張する。
    local resize_succeeded=0
    local allow_initial_backup=1

    if [ "$source_was_shrunk" -eq 1 ]; then
        log "縮小コピーしたAPFSコンテナをコピー先全体へ拡張"
        if try_resize_without_repair "$TARGET_CONTAINER" "$TARGET_TM_VOLUME"; then
            resize_succeeded=1
        else
            warn "コピー先APFSコンテナを直ちに拡張できませんでした"
            warn "空き容量が少ない可能性があるため、最初のバックアップをスキップします"
            allow_initial_backup=0
        fi
    fi

    log "コピー先をTime Machineの保存先として設定"
    if sudo tmutil setdestination "$TM_MOUNT_PATH"; then
        if [ "$allow_initial_backup" -eq 1 ]; then
            log "Time Machineを1回実行して自動整理を試す"
            sudo tmutil enable || true
            sudo tmutil startbackup --auto --block ||
                warn "最初のバックアップは失敗しました。履歴修復処理は継続します"
        else
            warn "コピー先を拡張できていないため、最初のバックアップをスキップします"
        fi
    else
        warn "Time Machine保存先として登録できなかったため、最初のバックアップをスキップします"
    fi

    stop_time_machine

    if list_backups "$backups_file" "$TARGET_TM_VOLUME"; then
        printf 'Time Machine実行後の履歴数: %s\n' "$(backup_count "$backups_file")"
    fi

    local delete_file

    # 第0段階: 削除せず修復・リサイズのみ
    if [ "$resize_succeeded" -eq 0 ]; then
        if try_resize_without_repair "$TARGET_CONTAINER" "$TARGET_TM_VOLUME"; then
            resize_succeeded=1
        elif repair_and_try_resize "第0段階: Time Machine実行後の履歴を維持したまま修復・リサイズ" \
                 "$TARGET_CONTAINER" "$TARGET_TM_VOLUME"; then
            resize_succeeded=1
        fi
    fi

    # 第1段階: 直近24時間を最新1件だけ残す
    if [ "$resize_succeeded" -eq 0 ]; then
        log "第1段階: 直近24時間以内の履歴を最新1件だけ残す"
        if list_backups "$backups_file" "$TARGET_TM_VOLUME"; then
            delete_file="$TEMP_DIR/delete-recent.txt"
            build_recent_24h_delete_list "$backups_file" "$delete_file"
            if [ "$(backup_count "$delete_file")" -gt 0 ]; then
                delete_backups_from_file "$delete_file" "$TARGET_TM_VOLUME" ||
                    warn "直近24時間分の一括削除に失敗しました"
                if repair_and_try_resize "第1段階の削除後に修復・リサイズ" \
                         "$TARGET_CONTAINER" "$TARGET_TM_VOLUME"; then
                    resize_succeeded=1
                fi
            else
                log "削除対象の直近24時間履歴はありません"
            fi
        else
            warn "履歴を列挙できないため第1段階をスキップします"
        fi
    fi

    # 第2段階: 7日区間ごとに1件だけ残す
    if [ "$resize_succeeded" -eq 0 ]; then
        log "第2段階: 7日区間ごとに1件だけ残す"
        if list_backups "$backups_file" "$TARGET_TM_VOLUME"; then
            delete_file="$TEMP_DIR/delete-weekly.txt"
            build_weekly_delete_list "$backups_file" "$delete_file"
            if [ "$(backup_count "$delete_file")" -gt 0 ]; then
                delete_backups_from_file "$delete_file" "$TARGET_TM_VOLUME" ||
                    warn "週次間引きの一括削除に失敗しました"
                if repair_and_try_resize "第2段階の削除後に修復・リサイズ" \
                         "$TARGET_CONTAINER" "$TARGET_TM_VOLUME"; then
                    resize_succeeded=1
                fi
            else
                log "履歴はすでに7日区間ごとに1件以下です"
            fi
        else
            warn "履歴を列挙できないため第2段階をスキップします"
        fi
    fi

    # 第3段階: 月ごとに1件だけ残す
    if [ "$resize_succeeded" -eq 0 ]; then
        log "第3段階: 月ごとに1件だけ残す"
        if list_backups "$backups_file" "$TARGET_TM_VOLUME"; then
            delete_file="$TEMP_DIR/delete-monthly.txt"
            build_monthly_delete_list "$backups_file" "$delete_file"
            if [ "$(backup_count "$delete_file")" -gt 0 ]; then
                delete_backups_from_file "$delete_file" "$TARGET_TM_VOLUME" ||
                    warn "月次間引きの一括削除に失敗しました"
                if repair_and_try_resize "第3段階の削除後に修復・リサイズ" \
                         "$TARGET_CONTAINER" "$TARGET_TM_VOLUME"; then
                    resize_succeeded=1
                fi
            else
                log "履歴はすでに月ごとに1件以下です"
            fi
        else
            warn "履歴を列挙できないため第3段階をスキップします"
        fi
    fi

    # 第4段階: 残った履歴を最古から1件ずつ削除
    if [ "$resize_succeeded" -eq 0 ]; then
        log "第4段階: 残った履歴を最古から1件ずつ削除"
        local remaining oldest one_delete_file
        # 履歴一覧すら取得できない状態で APFS新規作成へ進まないよう停止する
        while true; do
            list_backups "$backups_file" "$TARGET_TM_VOLUME" ||
                die "Time Machine履歴を列挙できないため、APFS新規作成には進みません"
            remaining=$(backup_count "$backups_file")
            [ "$remaining" -gt 0 ] || break
            oldest=$(head -n 1 "$backups_file")
            one_delete_file="$TEMP_DIR/delete-one.txt"
            printf '%s\n' "$oldest" > "$one_delete_file"

            log "残り${remaining}件。最古を削除: $oldest"
            # 履歴削除に失敗した場合は全履歴消去へ進まないよう停止する
            delete_backups_from_file "$one_delete_file" "$TARGET_TM_VOLUME" ||
                die "履歴を1件削除できなかったため、APFS新規作成には進みません: $oldest"
            if repair_and_try_resize "履歴1件削除後に修復・リサイズ" \
                     "$TARGET_CONTAINER" "$TARGET_TM_VOLUME"; then
                resize_succeeded=1
                break
            fi
        done
    fi

    if [ "$resize_succeeded" -eq 0 ]; then
        if recreate_target_apfs "$TARGET_STORE" "$TARGET_CONTAINER" "$TARGET_TM_VOLUME"; then
            resize_succeeded=1
        else
            die "コピー先APFSの新規作成にも失敗しました"
        fi
    fi

    [ "$resize_succeeded" -eq 1 ] || die "APFSを修復・リサイズできませんでした"

    ensure_target_mounted "$TARGET_TM_VOLUME" ||
        die "最終処理前にTime Machineボリュームをマウントできませんでした"

    log "最終状態"
    diskutil apfs list "/dev/$TARGET_CONTAINER" || true

    if list_backups "$backups_file" "$TARGET_TM_VOLUME"; then
        printf '残っている履歴数: %s\n' "$(backup_count "$backups_file")"
        cat "$backups_file"
    else
        warn "最終状態で既存履歴を列挙できませんでした"
    fi

    local current_name new_name
    current_name=$(diskutil info -plist "/dev/$TARGET_TM_VOLUME" 2>/dev/null | plutil -extract VolumeName raw -o - -- - 2>/dev/null)
    printf '\n現在のボリューム名: %s\n' "$current_name"
    printf '新しいボリューム名を入力（空欄で維持）: '
    read_line new_name
    if [ -n "$new_name" ] && [ "$new_name" != "$current_name" ]; then
        log "Time Machineボリュームを改名: $new_name"
        sudo diskutil renameVolume "/dev/$TARGET_TM_VOLUME" "$new_name" ||
            die "ボリューム名の変更に失敗しました"
        ensure_target_mounted "$TARGET_TM_VOLUME" || true
    fi

    log "コピー先をTime Machineの保存先として再設定"
    sudo tmutil setdestination "$TM_MOUNT_PATH" ||
        die "Time Machine保存先として登録できませんでした"

    sudo tmutil enable || warn "Time Machineの自動バックアップを有効に戻せませんでした"
    sudo tmutil destinationinfo || true

    play_result_sound
    log "完了"
    cat <<'EOF_DONE'

自動処理は完了しました。
Time Machine画面からバックアップを手動で行ってください。
EOF_DONE
    return 0
}

main
