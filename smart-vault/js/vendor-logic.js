// ベンダー名判定の純粋関数（ブラウザ/Node両方で利用）
// ブラウザ: window.VENDOR_LOGIC にエクスポート
// Node: module.exports にエクスポート

((root, factory) => {

    // PCI Vendor ID とモデル名からベンダー名を推定
    const detectVendor = (data, modelName) => {
        const upper = modelName.toUpperCase();
        const vId = data.nvme_pci_vendor?.id;
        if (vId === 4203 || upper.includes('APPLE')) return 'Apple';
        if (vId === 5197 || upper.includes('SAMSUNG')) return 'Samsung';
        if (vId === 4158 || upper.includes('CRUCIAL') || upper.includes('MICRON') || /^CT\d/.test(upper)) return 'Crucial';
        if (vId === 7474 || upper.includes('INTEL')) return 'Intel';
        if (upper.includes('WDC') || upper.includes('WESTERN DIGITAL') || upper.includes('WD')) return 'Western Digital';
        if (upper.includes('HGST')) return 'HGST';
        if (upper.includes('HITACHI')) return 'HITACHI';
        // Seagateモデル名は ST + 数字 で始まる（"HGST"のST誤判定を避けるため境界チェック）
        if (upper.includes('SEAGATE') || /\bST\d/.test(upper)) return 'Seagate';
        if (upper.includes('TOSHIBA')) return 'Toshiba';
        if (upper.includes('KIOXIA')) return 'Kioxia';
        if (upper.includes('SANDISK')) return 'SanDisk';
        if (upper.includes('KINGSTON')) return 'Kingston';

        if (modelName) {
            const firstWord = modelName.split(/[\s_-]/)[0];
            if (firstWord && firstWord.length > 1) return firstWord;
        }
        return '不明';
    };

    const VENDOR_LOGIC = { detectVendor };

    factory(root, VENDOR_LOGIC);
})(typeof globalThis !== 'undefined' ? globalThis : this, (root, mod) => {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = mod;
    }
    if (typeof window !== 'undefined') {
        window.VENDOR_LOGIC = mod;
    }
});
