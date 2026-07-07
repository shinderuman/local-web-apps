#!/bin/bash

# ========================================
# キー入力・UI関連の関数
# ========================================

read_key() {
    local key
    old_stty_cfg=$(stty -g)
    stty raw -echo
    key=$(dd bs=1 count=1 2>/dev/null)
    stty "$old_stty_cfg"

    if [ "$key" = $'\x1b' ]; then
        stty raw -echo
        local next_char=$(dd bs=1 count=2 2>/dev/null)
        stty "$old_stty_cfg"
        key="${key}${next_char}"
    fi
    echo -n "$key"
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

    options=()
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

    cursor=0
    tput civis
    menu_lines=$((3 + ${#options[@]} + 1))
    first_draw=true

    while true; do
        if [ "$first_draw" = false ]; then
            printf "\033[%dA" "$menu_lines"
        fi
        first_draw=false

        echo "=== 接続されている物理ディスク一覧 ==="
        echo "（矢印キー [↑/↓] で選択し、Enter で決定してください）"
        echo "-------------------------------------"

        for i in "${!options[@]}"; do
            if [ "$i" -eq "$cursor" ]; then
                printf "\r\033[K > \033[7m %s \033[0m\n" "${options[$i]}"
            else
                printf "\r\033[K   %s \n" "${options[$i]}"
            fi
        done
        echo "-------------------------------------"

        key=$(read_key)
        case "$key" in
            $'\x1b\x5b\x41')
                if [ "$cursor" -gt 0 ]; then cursor=$((cursor - 1)); fi
                ;;
            $'\x1b\x5b\x42')
                if [ "$cursor" -lt $((${#options[@]} - 1)) ]; then cursor=$((cursor + 1)); fi
                ;;
            ""|$'\x0a'|$'\x0d')
                break
                ;;
        esac
    done

    tput cnorm
    echo ""

    if [ "$cursor" -eq $((${#options[@]} - 1)) ]; then
        echo "プログラムを終了します。"
        exit 0
    fi

    target_device="${dev_list[$cursor]}"
    echo "$target_device の S.M.A.R.T. 情報を取得中..."

    # 一時ファイルの作成
    tmp_file=$(mktemp)
    success=false

    # USB接続を想定した網羅的なデバイスタイプの配列
    types=("auto" "sata" "ata" "nvme" "scsi" "usbcypress" "usbjmicron" "prolific" "sunplus")

    for type in "${types[@]}"; do
        if [ "$type" = "auto" ]; then
            echo "  → デバイスタイプ: 自動判別 (auto) で試行中..."
            smartctl -a --json "$target_device" > "$tmp_file" 2>&1
        else
            echo "  → デバイスタイプ: $type でリトライ中..."
            smartctl -a -d "$type" --json "$target_device" > "$tmp_file" 2>&1
        fi

        # ファイルが空でなく、かつJSONの開始文字「{」が含まれているか判定
        if [ -s "$tmp_file" ] && grep -q "{" "$tmp_file"; then
            cat "$tmp_file" | pbcopy
            success=true
            echo "  ✓ $type での取得に成功しました。"
            break
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
done
