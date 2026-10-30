# The Terrifying Journey to Alpha Centauri

An 8-minute YouTube video made entirely from **Three.js / WebGL simulations**, with narration, music, subtitles and a
GitHub Actions pipeline that renders **1080p**, **4K** and a vertical **Shorts** version.

Channel: Technical Talk India

## What is in the zip

```
build/
  main/audio.mp3            320 kbps mix of narration + music (8:00)       <- listen / upload to YouTube
  (audio_master.flac / narration.flac are not in this zip for size; the video uses audio.mp3 320k. Run `npm run audio` to rebuild the lossless masters.)
  main/subtitles.srt        captions for the 8-minute video                <- upload as YouTube subtitles
  main/timeline.json        scene / caption / fact-card timing used by the renderer
  shorts/...                same files for the 56-second Shorts version
scripts/
  narration.py              the full script + scene plan (edit text here)
  build_audio.py            rebuilds voice (Kokoro TTS), music, mix, SRT, timeline
web/                        Three.js scenes + overlays (src/scenesA.js, src/scenesB.js, src/main.js)
tools/render.mjs            deterministic frame renderer (headless Chromium -> ffmpeg)
tools/assemble.sh           joins chunks + adds audio
.github/workflows/render.yml
```

## Render on GitHub (no setup needed)

1. Create a new GitHub repository and upload the *contents* of this folder (keep `.github/workflows/render.yml`).
2. Open **Actions -> Render Alpha Centauri video -> Run workflow**.
3. Choose quality:
   * `1080p` – 1920x1080, 30 fps (recommended first test, about 10 minutes)
   * `4k` – 3840x2160, 30 fps (raise *chunks* to 40 or more)
   * `shorts` – 1080x1920, 56 s, captions burned in
   * `all` – everything at once
4. When it finishes, download the artifact **FINAL-1080p / FINAL-4k / FINAL-shorts**. Each contains the MP4, the SRT and the MP3.

Inputs: `fps` (24/30/60), `chunks` (parallel jobs, each renders a slice of the timeline), `burn_captions`, `crf` (quality).
Rendering uses CPU WebGL (SwiftShader) so it works on free runners; the video is split into slices that render in
parallel and are joined losslessly at the end, then the lossless audio master is encoded to AAC 320 kbps.

## Render locally

```bash
npm install
npx playwright install chromium
python3 -m venv .venv && . .venv/bin/activate && pip install numpy scipy soundfile kokoro-onnx   # only to rebuild audio
npm run preview                         # a few still frames in build/stills
node tools/render.mjs --format 1080p --chunks 1 --out build/parts/1080p_000.mp4
tools/assemble.sh 1080p build/parts out/video_1080p.mp4
```

## Changing the content

* Edit text / facts in `scripts/narration.py`, then `npm run audio` (downloads the Kokoro voice model ~330 MB once).
  This regenerates the voice, music, SRT and `timeline.json`.
* Scene visuals live in `web/src/scenesA.js` and `web/src/scenesB.js`; each scene is a pure function of time.

## Facts and sources

Distance 4.37 ly (Proxima 4.24 ly), Voyager 1 about 75,000 years at 17 km/s, Proxima b (11.2 day orbit, habitable zone),
ALMA flare of 24 March 2017 (about x1000 in 10 s), JWST candidate planet around Alpha Centauri A (about 2 AU, seen Aug 2024,
not re-detected in 2025, still unconfirmed), Breakthrough Starshot (2016, $100M, ~100 GW laser, gram-scale probes, 0.2 c,
~20 years, ~1e9 dust hits per sail), interstellar dust and cosmic-ray hazards, and the 1 g flip-and-burn relativity numbers
(about 3.6 ship-years vs about 6 Earth-years, peak about 0.95 c).
