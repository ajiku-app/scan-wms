// Dijalankan SETELAH `npx cap add ios`. Menambah teks izin kamera di Info.plist.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const p = "ios/App/App/Info.plist";
if (!existsSync(p)) { console.error("GAGAL: ios/ belum ada. Jalankan `npx cap add ios` dulu."); process.exit(1); }
let s = readFileSync(p, "utf8");
if (!s.includes("NSCameraUsageDescription")) {
  s = s.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>NSCameraUsageDescription</key>\n\t<string>Kamera dipakai untuk memindai barcode label barang dan kode rak.</string>\n</dict>\n</plist>\n`);
  writeFileSync(p, s);
}
s = readFileSync(p, "utf8").replace(/[ \t]*<string>UIInterfaceOrientationLandscape(Left|Right)<\/string>\r?\n/g, "");
writeFileSync(p, s);
console.log("OK  Info.plist (NSCameraUsageDescription, portrait)");
