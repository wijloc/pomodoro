#!/usr/bin/env bash
# Gera as capturas da loja (PNG 360x360, fundo transparente, textos em inglês) em store/screenshots/
# a partir de tools/screenshot.html, usando o Chrome em modo headless.
# Uso: bash tools/make-screenshots.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/store/screenshots"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p "$OUT"

shot() {
  local name="$1" query="$2"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size=360,360 \
    --screenshot="$OUT/$name.png" "file://$ROOT/tools/screenshot.html?$query" >/dev/null 2>&1
  echo "$OUT/$name.png"
}

shot 1-focus    'phase=focus&time=14:32&frac=0.58&done=1&btn=Pause'
shot 2-break    'phase=short&time=03:10&frac=0.63&done=2&btn=Pause'
shot 3-long     'phase=long&time=15:00&frac=1&done=4&btn=Start'
shot 4-alert    'phase=short&time=05:00&frac=1&done=3&btn=Start&overlay=1'
