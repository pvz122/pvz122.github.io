#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { printf 'ffmpeg is required to generate logo variants.\n' >&2; exit 1; }
mkdir -p images/logo-variants

for source in \
    images/logo-uwaterloo.png \
    images/logo-ucas.png \
    images/logo-whu.png \
    images/conference-logos/acm-ccs-2025.png
do
    stem="$(basename "$source" .png)"
    for width in 32 64 96; do
        destination="images/logo-variants/${stem}-${width}.webp"
        ffmpeg -hide_banner -loglevel error -nostdin -y -i "$source" \
            -vf "scale=${width}:-1:flags=lanczos,format=bgra" \
            -frames:v 1 -c:v libwebp -lossless 1 -compression_level 6 \
            "$destination"
        printf 'Generated %s\n' "$destination"
    done
done
