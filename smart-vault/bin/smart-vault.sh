#!/bin/bash

# smart-vault.sh — 外付けディスクの S.M.A.R.T. 情報を取得し JSON をクリップボードへコピー
# 詳細は README.md を参照。
# 導入: brew install smartmontools
# 終了コード: 0=成功・メニューから終了 / 1=異常

# 共通UI関数（read_key, select_menu）を読み込み
source "$(dirname "$0")/common.sh"

# ========================================
# smartctl 処理
# ========================================

# 対象デバイスの S.M.A.R.T. 情報を取得し JSON をクリップボードへコピー
run_smartctl() {
    local target_device="$1"

    # smartctl の存在確認
    if ! command -v smartctl >/dev/null 2>&1; then
        warn "smartctl がインストールされていません。'brew install smartmontools' で導入してください。"
        echo "-------------------------------------"
        echo ""
        return 1
    fi

    echo "$target_device の S.M.A.R.T. 情報を取得中..."

    # 一時ファイルの作成
    local tmp_file
    tmp_file=$(mktemp)
    local success=false

    # USB接続を想定した網羅的なデバイスタイプの配列
    local types=("auto" "sata" "ata" "nvme" "scsi" "usbcypress" "usbjmicron" "prolific" "sunplus")

    for type in "${types[@]}"; do
        if [ "$type" = "auto" ]; then
            echo "  → デバイスタイプ: 自動判別 (auto) で試行中..."
            smartctl -a --json "$target_device" > "$tmp_file" 2>&1
        else
            echo "  → デバイスタイプ: $type でリトライ中..."
            smartctl -a -d "$type" --json "$target_device" > "$tmp_file" 2>&1
        fi

        # serial_number または user_capacity が取得できていれば成功と判定
        if [ -s "$tmp_file" ] && grep -qE '"serial_number"|"user_capacity"' "$tmp_file"; then
            cat "$tmp_file" | pbcopy
            success=true
            echo "  ✓ $type での取得に成功しました。"
            break
        fi

        # JSONが取得できていれば標準出力に表示（デバッグ用）
        if [ -s "$tmp_file" ] && grep -q "{" "$tmp_file"; then
            echo "--- $type ---"
            jq -c < "$tmp_file"
        fi
    done

    # 一時ファイルの削除
    rm -f "$tmp_file"

    if [ "$success" = true ]; then
        echo "クリップボードにJSONをコピーしました！"
    else
        echo "スマート情報の取得に失敗しました。すべての接続タイプで取得できませんでした。"
    fi
    echo "-------------------------------------"
    echo ""
}

# ========================================
# メイン処理
# ========================================

while true; do
    dev_list=($(diskutil list physical | grep -E "^\/dev\/disk[0-9]+" | awk '{print $1}'))

    if [ ${#dev_list[@]} -eq 0 ]; then
        echo "物理ディスクが見つかりませんでした。"
        exit 1
    fi

    options=("接続情報を更新")
    for dev in "${dev_list[@]}"; do
        disk_info=$(diskutil info "$dev")
        size=$(echo "$disk_info" | grep "Disk Size:" | sed -E 's/.*Disk Size:[[:space:]]+([^[:space:]]+[[:space:]]+[^[:space:]]+).*/\1/')
        vol_name=$(echo "$disk_info" | grep "Volume Name:" | sed -E 's/.*Volume Name:[[:space:]]+(.*)/\1/')

        if [[ -z "$vol_name" || "$vol_name" == *"Not applicable"* ]]; then
            vol_name=$(diskutil list "$dev" | grep -E "[:\s]" | grep -v -E "(TYPE|GUID_partition_scheme|EFI|Container)" | awk -F'[^[:space:]][[:space:]]{2,}' '{print $2}' | grep -v -E "(^$|Not applicable)" | head -n 1)
        fi

        if [ -z "$vol_name" ]; then
            vol_name="なし"
        fi

        options+=("$dev (サイズ: $size / ボリューム名: $vol_name)")
    done

    options+=("終了")

    select_menu "=== 接続されている物理ディスク一覧 ===" "${options[@]}"
    cursor=$?

    if [ "$cursor" -eq $((${#options[@]} - 1)) ]; then
        echo "プログラムを終了します。"
        exit 0
    fi

    if [ "$cursor" -eq 0 ]; then
        echo "接続情報を更新します..."
        echo "-------------------------------------"
        echo ""
        continue
    fi

    target_device="${dev_list[$((cursor - 1))]}"
    run_smartctl "$target_device"
done
