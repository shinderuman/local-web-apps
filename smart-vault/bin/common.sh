#!/bin/bash
# 共通UI関数（smart-vault.sh / fio-bench.sh / hdd-repair.sh から source で読み込まれる）
# read_key / select_menu / select_menu_lock を提供する

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

# 矢印キー選択 ＋ Tab キーによるロックトグル付きメニュー（select_menu のロック対応版）
# 引数:
#   $1: タイトル
#   $2: 各項目のロック状態配列の「変数名」（呼び出し元スコープの配列。0=非ロック/1=ロック）
#   $3以降: options 配列
# 戻り値: 選択された index を return
# Tab キーでカーソル位置のロックをトグルし、呼び出し元の配列へ反映した上でメニューを継続する。
select_menu_lock() {
    local title="$1"
    local locked_var="$2"
    shift 2
    local options=("$@")

    # ロック配列を間接参照
    local locked=()
    eval "locked=(\"\${$locked_var[@]}\")"
    # options の長さに合わせて不足分を 0 埋め
    while [ "${#locked[@]}" -lt "${#options[@]}" ]; do
        locked+=(0)
    done

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
        echo "（矢印キー [↑/↓] で選択、Tab でロック切替、Enter で決定）"
        echo "-------------------------------------"

        for i in "${!options[@]}"; do
            local lock_mark=""
            if [ "${locked[$i]}" = "1" ]; then
                lock_mark="[LOCKED] "
            fi
            if [ "$i" -eq "$cursor" ]; then
                printf "\r\033[K > \033[7m %s%s \033[0m\n" "$lock_mark" "${options[$i]}"
            else
                printf "\r\033[K   %s%s \n" "$lock_mark" "${options[$i]}"
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
            # Tab キー: カーソル位置のロックをトグル（メニューは継続）
            $'\x09')
                if [ "${locked[$cursor]}" = "1" ]; then
                    locked[$cursor]=0
                else
                    locked[$cursor]=1
                fi
                eval "$locked_var=(\"\${locked[@]}\")"
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
