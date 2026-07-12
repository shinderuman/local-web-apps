// 画像処理ヘルパ（状態非依存の純粋関数。ブラウザ/Node両方で利用）
// ブラウザ: window.IMAGE_HELPERS にエクスポート
// Node: module.exports にエクスポート
// ※ canvas 要素を生成するが、状態に依存せず引数のみから結果を導出する純粋関数
// ※ IMAGE 定数（最大サイズ・JPEG品質）は本モジュールに固有の設定として持たせる

((root, factory) => {

    // 画像処理設定
    const IMAGE = {
        MAX_W: 440,
        MAX_H: 620,
        JPEG_QUALITY: 0.7
    };

    // 指定座標のピクセル色を RGB 整数で返す
    const sampleColor = (data, width, x, y) => {
        const i = (y * width + x) * 4;
        return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    };

    // 画像左右の背景色を検出してトリム範囲（左オフセット・幅・高さ）を返す
    const trimBackground = (img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const { data, width } = ctx.getImageData(0, 0, img.width, img.height);
        const midY = Math.floor(img.height / 2);
        const margin = Math.max(1, Math.floor(width * 0.01));

        const bgColorLeft = sampleColor(data, width, margin, midY);
        const bgColorRight = sampleColor(data, width, width - 1 - margin, midY);

        let trimLeft = margin;
        let trimRight = margin;
        while (trimLeft < width - 1) {
            if (sampleColor(data, width, trimLeft, midY) !== bgColorLeft) break;
            trimLeft++;
        }
        while (trimRight < width - trimLeft - 1) {
            if (sampleColor(data, width, width - 1 - trimRight, midY) !== bgColorRight) break;
            trimRight++;
        }

        return { trimLeft, trimmedW: width - trimLeft - trimRight, trimmedH: img.height };
    };

    // トリム範囲を最大サイズに収めて JPEG の DataURL に変換
    const resizeToJpeg = (img, trimLeft, trimW, trimH) => {
        let w = trimW;
        let h = trimH;

        if (w > IMAGE.MAX_W || h > IMAGE.MAX_H) {
            const ratio = Math.min(IMAGE.MAX_W / w, IMAGE.MAX_H / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, trimLeft, 0, trimW, trimH, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', IMAGE.JPEG_QUALITY);
    };

    const IMAGE_HELPERS = {
        IMAGE,
        sampleColor,
        trimBackground,
        resizeToJpeg
    };

    factory(root, IMAGE_HELPERS);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.IMAGE_HELPERS = mod;
    }
});
