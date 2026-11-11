#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { printf 'ffmpeg is required to generate site icons.\n' >&2; exit 1; }

crop="1184:1184:36:32"

render_icon() {
    ffmpeg -hide_banner -loglevel error -nostdin -y -i images/image.png \
        -vf "crop=${crop},scale=${1}:${1}:flags=lanczos,format=rgba" \
        -frames:v 1 -c:v png -compression_level 9 "$2"
    printf 'Generated %s\n' "$2"
}

for size in 16 32 48; do
    render_icon "$size" "images/favicon-${size}x${size}.png"
done
for size in 192 512; do
    render_icon "$size" "images/android-chrome-${size}x${size}.png"
done
render_icon 144 images/mstile-144x144.png
render_icon 150 images/mstile-150x150.png

ffmpeg -hide_banner -loglevel error -nostdin -y \
    -f lavfi -i "color=c=white:s=180x180" -i images/image.png \
    -filter_complex "[1:v]crop=${crop},scale=180:180:flags=lanczos[icon];[0:v][icon]overlay=shortest=1:format=rgb,format=rgb24" \
    -frames:v 1 -c:v png -compression_level 9 images/apple-touch-icon.png
printf 'Generated images/apple-touch-icon.png\n'

ffmpeg -hide_banner -loglevel error -nostdin -y \
    -i images/favicon-16x16.png -i images/favicon-32x32.png -i images/favicon-48x48.png \
    -map 0:v -map 1:v -map 2:v -c:v bmp -pix_fmt bgra -frames:v 1 favicon.ico
printf 'Generated favicon.ico\n'
