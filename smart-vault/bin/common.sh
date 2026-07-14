#!/bin/bash
# 共通UI関数（smart-vault.sh / fio-bench.sh から source で読み込まれる）
# read_key と select_menu を提供する

# 1文字のキー入力を読み取る（矢印キーはエスケープシーケンス込みで返す）
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

# 矢印キーで選択肢を移動する汎用メニュー（title と options 配列を受け取り、選択された index を返す）
select_menu() {
    local title="$1"
    shift
    local options=("$@")

    local cursor=0
    tput civis
    local menu_lines=$((3 + ${#options[@]} + 1))
    local first_draw=true

    while true; do
        if [ "$first_draw" = false ]; then
            printf "\033[%dA" "$menu_lines"
        fi
        first_draw=false

        echo "$title"
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

        local key
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
    return "$cursor"
}
