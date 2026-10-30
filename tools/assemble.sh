#!/usr/bin/env bash
# Join rendered chunks and mux the audio.
#   tools/assemble.sh <format: 1080p|4k|shorts> <parts_dir> <out.mp4> [audio_dir]
set -euo pipefail
FMT="$1"; PARTS="$2"; OUT="$3"
case "$FMT" in
  shorts) AUDIO="${4:-build/shorts}" ;;
  *)      AUDIO="${4:-build/main}" ;;
esac
LIST="$(mktemp)"
ls "$PARTS"/${FMT}_*.mp4 | sort | sed "s#^#file '$(pwd)/#; s#\$#'#" > "$LIST"
echo "parts:"; cat "$LIST"
SRC="$AUDIO/audio_master.flac"; [ -f "$SRC" ] || SRC="$AUDIO/audio.mp3"
TMP="$(mktemp -d)"
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$LIST" -c copy "$TMP/video.mp4"
ffmpeg -y -hide_banner -loglevel error -i "$TMP/video.mp4" -i "$SRC" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -ac 2 -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of default=nw=1 "$OUT"
rm -rf "$TMP" "$LIST"
