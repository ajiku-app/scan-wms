// Salin ZXing dari node_modules ke www/vendor agar scan jalan OFFLINE di dalam APK/IPA.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
const src = "node_modules/@zxing/library/umd/index.min.js";
if (!existsSync(src)) { console.error("ZXing belum terpasang. Jalankan: npm install"); process.exit(1); }
mkdirSync("www/vendor", { recursive: true });
copyFileSync(src, "www/vendor/zxing.min.js");
console.log("OK  www/vendor/zxing.min.js");
