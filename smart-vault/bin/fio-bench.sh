#!/bin/bash

# fio テストファイル・一時ファイルのパス（中断時のクリーンアップ用グローバル変数）
FIO_TEST_FILE=""
FIO_SEQ_JSON=""
FIO_RAND_JSON=""
FIO_SEQ_ERR=""
FIO_RAND_ERR=""
FIO_MERGED_JSON=""

# 最新の測定結果JSON（再コピー用。初回は空）
LATEST_JSON=""

# スクリプト終了時（Ctrl-C 含む）に fio 関連ファイルを確実削除
cleanup_on_exit() {
    [ -n "$FIO_TEST_FILE" ] && rm -f "$FIO_TEST_FILE"
    [ -n "$FIO_SEQ_JSON" ] && rm -f "$FIO_SEQ_JSON"
    [ -n "$FIO_RAND_JSON" ] && rm -f "$FIO_RAND_JSON"
    [ -n "$FIO_SEQ_ERR" ] && rm -f "$FIO_SEQ_ERR"
    [ -n "$FIO_RAND_ERR" ] && rm -f "$FIO_RAND_ERR"
    [ -n "$FIO_MERGED_JSON" ] && rm -f "$FIO_MERGED_JSON"
}
trap cleanup_on_exit EXIT

# 共通UI関数（read_key, select_menu）を読み込み
source "$(dirname "$0")/common.sh"

# ========================================
# fio ベンチマーク処理
# ========================================

# fio 失敗時に stderr（警告・エラー）とJSON（compact形式）を表示
# 引数: jsonファイルパス, stderrファイルパス
print_fio_error() {
    local json_file="$1"
    local err_file="$2"
    if [ -s "$err_file" ]; then
        echo "--- fioメッセージ ---"
        cat "$err_file"
    fi
    if [ -s "$json_file" ]; then
        echo "--- fio出力(compact) ---"
        jq -c . "$json_file" 2>/dev/null || cat "$json_file"
    fi
    echo "-----------------------"
}

# 指定種類の seq/rand 用 fio パラメータを配列へ設定
# 引数: kind(hdd/sata/nvme), mode(seq/rand), filename, 結果を格納する配列名
build_fio_args() {
    local kind="$1"
    local mode="$2"
    local filename="$3"
    local out_var="$4"

    local rw bs size iodepth numjobs extra runtime
    if [ "$kind" = "hdd" ]; then
        runtime=60
    else
        runtime=30
    fi

    if [ "$mode" = "seq" ]; then
        rw="read"
        bs="1m"
    else
        rw="randread"
        bs="4k"
    fi

    case "$kind" in
        hdd)
            size="1G"
            if [ "$mode" = "seq" ]; then
                iodepth=1
                numjobs=1
            else
                iodepth=32
                numjobs=1
            fi
            ;;
        sata)
            size="2G"
            if [ "$mode" = "seq" ]; then
                iodepth=1
                numjobs=1
            else
                iodepth=32
                numjobs=1
            fi
            ;;
        nvme)
            size="4G"
            if [ "$mode" = "seq" ]; then
                iodepth=32
                numjobs=1
            else
                iodepth=128
                numjobs=4
                extra="--group_reporting"
            fi
            ;;
    esac

    local args=(
        --name="${kind}_${mode}"
        --rw="$rw"
        --bs="$bs"
        --size="$size"
        --runtime="$runtime"
        --time_based
        --direct=1
        --ioengine=posixaio
        --iodepth="$iodepth"
        --numjobs="$numjobs"
        --filename="$filename"
        --output-format=json
    )
    if [ -n "$extra" ]; then
        args+=("$extra")
    fi

    # 呼び出し元の配列へ設定
    eval "$out_var=(\"\${args[@]}\")"
}

# 対象ボリュームの seq/rand リードを測定し、1つのJSONに統合してクリップボードへコピー
run_fio_bench() {
    local target_device="$1"
    local mount_point="$2"
    local kind="$3"

    # fio と jq の存在確認
    if ! command -v fio >/dev/null 2>&1; then
        echo "エラー: fio がインストールされていません。'brew install fio' で導入してください。"
        echo "-------------------------------------"
        echo ""
        return 1
    fi
    if ! command -v jq >/dev/null 2>&1; then
        echo "エラー: jq がインストールされていません。'brew install jq' で導入してください。"
        echo "-------------------------------------"
        echo ""
        return 1
    fi

    local test_file="${mount_point}/fio_test"
    seq_json=$(mktemp)
    rand_json=$(mktemp)
    seq_err=$(mktemp)
    rand_err=$(mktemp)

    # 中断時のクリーンアップ用にグローバル変数へ保持
    FIO_TEST_FILE="$test_file"
    FIO_SEQ_JSON="$seq_json"
    FIO_RAND_JSON="$rand_json"
    FIO_SEQ_ERR="$seq_err"
    FIO_RAND_ERR="$rand_err"

    # seq read 測定
    local seq_args=()
    build_fio_args "$kind" "seq" "$test_file" "seq_args"
    echo "$target_device でシーケンシャルリード測定を開始..."
    echo "  fio ${seq_args[*]}"
    if ! fio "${seq_args[@]}" > "$seq_json" 2> "$seq_err"; then
        echo "エラー: シーケンシャルリード測定に失敗しました。"
        print_fio_error "$seq_json" "$seq_err"
        rm -f "$test_file" "$seq_json" "$rand_json" "$seq_err" "$rand_err"
        FIO_TEST_FILE=""
        FIO_SEQ_JSON=""
        FIO_RAND_JSON=""
        FIO_SEQ_ERR=""
        FIO_RAND_ERR=""
        return 1
    fi

    # rand read 測定
    local rand_args=()
    build_fio_args "$kind" "rand" "$test_file" "rand_args"
    echo "$target_device でランダムリード測定を開始..."
    echo "  fio ${rand_args[*]}"
    if ! fio "${rand_args[@]}" > "$rand_json" 2> "$rand_err"; then
        echo "エラー: ランダムリード測定に失敗しました。"
        print_fio_error "$rand_json" "$rand_err"
        rm -f "$test_file" "$seq_json" "$rand_json" "$seq_err" "$rand_err"
        FIO_TEST_FILE=""
        FIO_SEQ_JSON=""
        FIO_RAND_JSON=""
        FIO_SEQ_ERR=""
        FIO_RAND_ERR=""
        return 1
    fi

    # seq/rand を1つのJSONに統合（jq の成否を確実に判定するため一時ファイルへ出力）
    local merged_json
    merged_json=$(mktemp)
    FIO_MERGED_JSON="$merged_json"
    if ! jq -n --slurpfile seq "$seq_json" --slurpfile rand "$rand_json" '{seq:$seq[0], rand:$rand[0]}' > "$merged_json" 2>/dev/null; then
        echo "エラー: 測定結果JSONの統合に失敗しました。fio出力が不正な可能性があります。"
        echo "--- seqメッセージ ---"
        cat "$seq_err" 2>/dev/null
        echo "--- seq出力(compact) ---"
        jq -c . "$seq_json" 2>/dev/null || cat "$seq_json"
        echo "--- randメッセージ ---"
        cat "$rand_err" 2>/dev/null
        echo "--- rand出力(compact) ---"
        jq -c . "$rand_json" 2>/dev/null || cat "$rand_json"
        echo "---------------------------"
        rm -f "$test_file" "$seq_json" "$rand_json" "$seq_err" "$rand_err" "$merged_json"
        FIO_TEST_FILE=""
        FIO_SEQ_JSON=""
        FIO_RAND_JSON=""
        FIO_SEQ_ERR=""
        FIO_RAND_ERR=""
        FIO_MERGED_JSON=""
        return 1
    fi
    # 統合JSONを最新結果として保持（再コピー用）
    LATEST_JSON=$(cat "$merged_json")
    rm -f "$test_file" "$seq_json" "$rand_json" "$seq_err" "$rand_err" "$merged_json"
    FIO_TEST_FILE=""
    FIO_SEQ_JSON=""
    FIO_RAND_JSON=""
    FIO_SEQ_ERR=""
    FIO_RAND_ERR=""
    FIO_MERGED_JSON=""
    echo "ベンチマーク測定が完了しました。"
    echo "-------------------------------------"
    echo ""
    return 0
}

# ========================================
# メイン処理
# ========================================

# fio と jq の存在確認（起動時）
if ! command -v fio >/dev/null 2>&1; then
    echo "エラー: fio がインストールされていません。'brew install fio' で導入してください。"
    exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
    echo "エラー: jq がインストールされていません。'brew install jq' で導入してください。"
    exit 1
fi

while true; do
    # マウントされているボリューム一覧を取得（nobrowse付きのシステムボリュームは除外）
    # mount出力は「/dev/diskX on /mount path (opts)」形式。マウントポイントに空白が含まれうるため
    # 「 on 」と「 (」を区切りにdevとマウントポイントを抽出する
    vol_list=()
    mp_list=()
    while IFS=$'\t' read -r dev mp; do
        [ -z "$dev" ] && continue
        vol_list+=("$dev")
        mp_list+=("$mp")
    done < <(mount | grep "^/dev/disk" | grep -v "nobrowse" | sed -E 's|^(/dev/[^ ]+) on (.*) \(.*$|\1\t\2|')

    if [ ${#vol_list[@]} -eq 0 ]; then
        echo "マウントされているボリュームが見つかりませんでした。"
        exit 1
    fi

    options=("接続情報を更新" "最新のJSONをコピー")
    for i in "${!vol_list[@]}"; do
        dev="${vol_list[$i]}"
        mp="${mp_list[$i]}"
        disk_info=$(diskutil info "$dev")
        size=$(echo "$disk_info" | grep "Disk Size:" | sed -E 's/.*Disk Size:[[:space:]]+([^[:space:]]+[[:space:]]+[^[:space:]]+).*/\1/')
        vol_name=$(echo "$disk_info" | grep "Volume Name:" | sed -E 's/.*Volume Name:[[:space:]]+(.*)/\1/')
        if [ -z "$vol_name" ] || [[ "$vol_name" == *"Not applicable"* ]]; then
            vol_name="なし"
        fi
        options+=("$dev (サイズ: $size / ボリューム名: $vol_name)")
    done

    options+=("終了")

    select_menu "=== マウントされているボリューム一覧 ===" "${options[@]}"
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

    # 最新のJSONを再コピー
    if [ "$cursor" -eq 1 ]; then
        if [ -z "$LATEST_JSON" ]; then
            echo "コピーできる測定結果がありません。先にベンチマークを実行してください。"
        else
            echo "$LATEST_JSON" | pbcopy
            echo "最新のベンチマーク結果JSONをクリップボードにコピーしました！"
        fi
        echo "-------------------------------------"
        echo ""
        continue
    fi

    target_device="${vol_list[$((cursor - 2))]}"
    target_mount="${mp_list[$((cursor - 2))]}"

    # ストレージ種類選択: HDD / SATA SSD / NVMe SSD / 戻る
    kind_options=("HDD" "SATA SSD" "NVMe SSD" "戻る")
    select_menu "=== $target_device のストレージ種類を選択 ===" "${kind_options[@]}"
    kind_choice=$?

    if [ "$kind_choice" -eq 3 ]; then
        continue
    fi

    case "$kind_choice" in
        0) kind="hdd" ;;
        1) kind="sata" ;;
        2) kind="nvme" ;;
    esac

    if run_fio_bench "$target_device" "$target_mount" "$kind"; then
        echo "$LATEST_JSON" | pbcopy
        echo "クリップボードにベンチマーク結果JSONをコピーしました！"
        echo "-------------------------------------"
        echo ""
    fi
done
