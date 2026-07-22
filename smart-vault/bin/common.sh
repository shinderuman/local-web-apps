#!/bin/bash
# 共通UI関数（smart-vault.sh / fio-bench.sh / hdd-repair.sh から source で読み込まれる）
# read_key / select_menu / select_menu_lock を提供する

# 1文字のキー入力を読み取る（矢印キーはエスケープシーケンス込みで返す）
read_key() {
    local key
    local old_stty_cfg
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

# ========================================
# ディスク情報ヘルパー（hdd-repair.sh / timemachine-clone.sh で共有）
# 呼び出し元は JQ_BIN を定義しておくこと。
# ========================================

# 外付けディスク（物理＋AppleRAID仮想）の識別子を標準出力へ1行1つ出力。
# 内蔵・APFS synthesized・パーティション（diskNsM）は除外。
# AppleRAID メンバー個別ディスクは除外し、RAID Device Node のみ出す
# （メンバーを直接選ぶとRAID構成を破壊するため）。
collect_disks() {
    local seen physical raid_disks d internal

    # 外付け物理ディスク
    physical=$(diskutil list -plist external physical 2>/dev/null \
        | plutil -convert json -o - -- - 2>/dev/null \
        | "$JQ_BIN" -r '.WholeDisks[]?')

    # AppleRAID 仮想ディスク（Device Node: diskN）。内蔵は除外。
    raid_disks=$(diskutil appleRAID list 2>/dev/null \
        | awk '/Device Node:/ { print $3 }')

    # 単体の外付け物理ディスクを出力。
    # Apple_RAID（Offline含む）パーティションを持つディスクはRAIDメンバーのため除外する。
    while IFS= read -r d; do
        [ -n "$d" ] || continue
        if diskutil list "/dev/$d" 2>/dev/null | grep -qE 'Apple_RAID(_Offline)?'; then
            continue
        fi
        seen="$seen $d "
        printf '%s\n' "$d"
    done <<< "$physical"

    # AppleRAID 仮想ディスクを追記（重複・内蔵除外）
    while IFS= read -r d; do
        [ -n "$d" ] || continue
        case "$seen" in *" $d "*) continue ;; esac
        internal=$(diskutil info -plist "/dev/$d" 2>/dev/null \
            | plutil -extract Internal raw -o - -- - 2>/dev/null)
        [ "$internal" = "false" ] || continue
        printf '%s\n' "$d"
    done <<< "$raid_disks"
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

# バイト数を3桁ごとにカンマ区切りへ整形（数値変換せず文字列として処理）
format_bytes_with_commas() {
    awk 'BEGIN {
        s = ARGV[1]
        result = ""
        while (length(s) > 3) {
            result = "," substr(s, length(s) - 2) result
            s = substr(s, 1, length(s) - 3)
        }
        print s result
        exit
    }' "$1"
}

# 指定 plist ファイルからキーの値を抽出（plutil -extract の raw 出力を使用）
# 引数: キー名, plist ファイルパス
plist_value() {
    local key="$1"
    local plist="$2"
    plutil -extract "$key" raw -o - "$plist" 2>/dev/null
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

# 通知音を鳴らす（失敗しても結果へ影響させない）
play_result_sound() {
    afplay /System/Library/Sounds/Glass.aiff >/dev/null 2>&1 || true
}

# タイムスタンプ付きログ出力
log() {
    printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

# 警告出力（標準エラー）
warn() {
    printf '\n警告: %s\n' "$*" >&2
}

# エラー出力後、通知音を鳴らして終了コード1で終了
die() {
    printf '\nエラー: %s\n' "$*" >&2
    play_result_sound
    exit 1
}
