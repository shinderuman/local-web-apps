// CSVデコード・解析の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.CSV_LOGIC にエクスポート
// Node: module.exports にエクスポート
((root, factory) => {
    const CSV_LOGIC = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = CSV_LOGIC;
    }

    if (root) {
        root.CSV_LOGIC = CSV_LOGIC;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    const CSV_FORMATS = {
        CONFIRMED: {
            columnCount: 7,
            amountIndex: 2,
            sourceType: 'confirmed'
        },
        PROVISIONAL: {
            columnCount: 13,
            amountIndex: 6,
            sourceType: 'provisional'
        }
    };

    // CSV文字列を引用符・改行・末尾空欄を維持した二次元配列へ変換する
    const parseCsvRows = (text) => {
        const rows = [];
        let row = [];
        let field = '';
        let insideQuotes = false;

        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            const nextCharacter = text[index + 1];

            if (character === '"' && insideQuotes && nextCharacter === '"') {
                field += '"';
                index += 1;
                continue;
            }

            if (character === '"') {
                insideQuotes = !insideQuotes;
                continue;
            }

            if (character === ',' && !insideQuotes) {
                row.push(field);
                field = '';
                continue;
            }

            if ((character === '\n' || character === '\r') && !insideQuotes) {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';

                if (character === '\r' && nextCharacter === '\n') {
                    index += 1;
                }

                continue;
            }

            field += character;
        }

        if (field !== '' || row.length > 0) {
            row.push(field);
            rows.push(row);
        }

        return rows;
    };

    // 日付文字列をYYYY-MM-DDへ正規化し、実在しない日付ならnullを返す
    const normalizeDate = (value) => {
        const match = String(value ?? '')
            .trim()
            .match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

        if (!match) {
            return null;
        }

        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const day = Number.parseInt(match[3], 10);
        const date = new Date(Date.UTC(year, month - 1, day));

        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            return null;
        }

        return [
            String(year).padStart(4, '0'),
            String(month).padStart(2, '0'),
            String(day).padStart(2, '0')
        ].join('-');
    };

    // 金額文字列を整数へ変換し、正の整数でなければnullを返す
    const parseAmount = (value) => {
        const normalizedValue = String(value ?? '')
            .replace(/[￥¥,\s]/g, '')
            .trim();

        if (!/^\d+$/.test(normalizedValue)) {
            return null;
        }

        const amount = Number.parseInt(normalizedValue, 10);

        if (!Number.isSafeInteger(amount) || amount <= 0) {
            return null;
        }

        return amount;
    };

    // 最初の明細行を探す
    const findFirstDetailRowIndex = (rows) => {
        return rows.findIndex((row) => normalizeDate(row[0]) !== null);
    };

    // 最初の明細行のカラム数からCSV形式を判定する
    const detectCsvFormat = (row) => {
        return Object.values(CSV_FORMATS).find(
            (format) => format.columnCount === row.length
        );
    };

    // CSV行を支出レコードへ変換する
    const parseDetailRow = (row, format, rowNumber) => {
        const usedAt = normalizeDate(row[0]);
        const merchant = String(row[1] ?? '').trim();
        const amount = parseAmount(row[format.amountIndex]);
        const errors = [];

        if (!usedAt) {
            errors.push('利用日を解析できません');
        }

        if (!merchant) {
            errors.push('利用店名が空です');
        }

        if (amount === null) {
            errors.push('金額を解析できません');
        }

        if (errors.length > 0) {
            return {
                error: `${rowNumber}行目: ${errors.join('、')}`,
                record: null
            };
        }

        return {
            error: null,
            record: {
                usedAt,
                merchant,
                amount,
                monthKey: usedAt.slice(0, 7),
                sourceType: format.sourceType
            }
        };
    };

    // CSV文字列から明細と行単位エラーを抽出する
    const parseExpenseCsv = (text) => {
        const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
        const detailStartIndex = findFirstDetailRowIndex(rows);

        if (detailStartIndex < 0) {
            throw new Error('明細行を検出できませんでした');
        }

        const format = detectCsvFormat(rows[detailStartIndex]);

        if (!format) {
            throw new Error(
                `未対応のCSV形式です。最初の明細行は${rows[detailStartIndex].length}カラムでした`
            );
        }

        const records = [];
        const errors = [];

        rows.slice(detailStartIndex).forEach((row, index) => {
            if (row.every((value) => String(value).trim() === '')) {
                return;
            }

            const parsed = parseDetailRow(
                row,
                format,
                detailStartIndex + index + 1
            );

            if (parsed.error) {
                errors.push(parsed.error);
                return;
            }

            records.push(parsed.record);
        });

        if (records.length === 0) {
            throw new Error('取り込める明細がありませんでした');
        }

        return {
            sourceType: format.sourceType,
            records,
            errors,
            discardedLeadingRowCount: detailStartIndex
        };
    };

    // ArrayBufferをUTF-8またはShift_JISとしてデコードする
    const decodeCsvBuffer = (arrayBuffer) => {
        const bytes = new Uint8Array(arrayBuffer);

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
            return new TextDecoder('shift_jis').decode(bytes);
        }
    };

    return {
        CSV_FORMATS,
        decodeCsvBuffer,
        detectCsvFormat,
        findFirstDetailRowIndex,
        normalizeDate,
        parseAmount,
        parseCsvRows,
        parseExpenseCsv
    };
});
