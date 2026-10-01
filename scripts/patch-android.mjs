// Dijalankan SETELAH `npx cap add android`. Menambah izin kamera/getar, versi, dan signing release.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const die = (m) => { console.error("GAGAL: " + m); process.exit(1); };

// 1) AndroidManifest
const mp = "android/app/src/main/AndroidManifest.xml";
if (!existsSync(mp)) die("android/ belum ada. Jalankan `npx cap add android` dulu.");
let m = readFileSync(mp, "utf8");
const add = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
].filter((l) => !m.includes(l.match(/android:name="([^"]+)"/)[1]));
if (add.length) {
  if (!m.includes("</manifest>")) die("AndroidManifest.xml tidak dikenali");
  m = m.replace("</manifest>", "    " + add.join("\n    ") + "\n</manifest>");
  writeFileSync(mp, m);
}
if (!m.includes("android:screenOrientation")) {
  m = m.replace(/<activity\b/, '<activity android:screenOrientation="portrait"');
  writeFileSync(mp, m);
}
console.log("OK  AndroidManifest (CAMERA, VIBRATE, portrait)");

// 2) build.gradle: versionCode/Name dari env + signing release dari env
const gp = "android/app/build.gradle";
let g = readFileSync(gp, "utf8");
const vc = process.env.VERSION_CODE || "1";
const vn = process.env.VERSION_NAME || "1.0.0";
g = g.replace(/versionCode\s*=?\s*\d+/, `versionCode ${vc}`).replace(/versionName\s*=?\s*"[^"]*"/, `versionName "${vn}"`);

if (!g.includes("signingConfigs")) {
  const block = `
    signingConfigs {
        release {
            def ks = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
`;
  if (!/\n\s*buildTypes\s*\{/.test(g)) die("blok buildTypes tidak ditemukan di build.gradle");
  g = g.replace(/\n(\s*)buildTypes\s*\{/, `${block}\n$1buildTypes {`);
  if (!/release\s*\{/.test(g)) die("blok release tidak ditemukan");
  g = g.replace(/(buildTypes\s*\{\s*release\s*\{)/, `$1\n            if (System.getenv("ANDROID_KEYSTORE_PATH")) { signingConfig signingConfigs.release }`);
}
writeFileSync(gp, g);
console.log(`OK  build.gradle (versionCode ${vc}, versionName ${vn}, signing via env)`);
