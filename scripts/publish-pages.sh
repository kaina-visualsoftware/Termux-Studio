#!/usr/bin/env bash
set -euo pipefail
# Publicação manual do build no branch gh-pages, sem GitHub Actions.
root="$(git rev-parse --show-toplevel)"
cd "$root"
VITE_BASE_PATH=/Termux-Studio/ npm run build
test -s dist/index.html
origin="$(git remote get-url origin)"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
git clone --quiet --no-checkout "$origin" "$temp"
if git -C "$temp" show-ref --verify --quiet refs/remotes/origin/gh-pages; then
  git -C "$temp" checkout -q -B gh-pages origin/gh-pages
else
  git -C "$temp" checkout -q --orphan gh-pages
fi
git -C "$temp" rm -rfq --ignore-unmatch . || true
find "$temp" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$root/dist/." "$temp/"
touch "$temp/.nojekyll"
git -C "$temp" add -A
if ! git -C "$temp" diff --cached --quiet; then
  git -C "$temp" commit -m 'deploy: publicar Termux Studio estático'
  git -C "$temp" push origin HEAD:gh-pages
fi
echo 'Pronto. Configure GitHub Pages: Deploy from a branch > gh-pages > /(root).'
