#!/usr/bin/env bash
# Kirim proyek ini ke https://github.com/ajiku-app/scan-wms.git
# Pakai:  bash push.sh
# Perlu login GitHub (SSH key, `gh auth login`, atau Personal Access Token saat diminta password).
set -u
REPO="https://github.com/ajiku-app/scan-wms.git"
git config core.autocrlf false 2>/dev/null || true
[ -d .git ] || git init -b main
git add -A
git commit -m "${1:-Update WMS Scan}" || echo "(tidak ada perubahan baru untuk di-commit)"
git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$REPO" || git remote add origin "$REPO"
git branch -M main
if ! git push -u origin main; then
  echo ">> Push ditolak (remote punya commit yang belum ada di sini). Menggabungkan lalu push ulang..."
  git pull origin main --no-rebase --no-edit --allow-unrelated-histories -X ours || { echo "Gagal menggabungkan. Kirim pesan error di atas ke asisten."; exit 1; }
  git push -u origin main || { echo "Push gagal. Kirim pesan error di atas ke asisten."; exit 1; }
fi
echo "Selesai. Build: https://github.com/ajiku-app/scan-wms/actions"
