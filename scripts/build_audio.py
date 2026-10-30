# -*- coding: utf-8 -*-
"""
Build narration, music, mix, SRT and timeline.json for the video.

  python scripts/build_audio.py --mode main   --out build/main
  python scripts/build_audio.py --mode shorts --out build/shorts

Needs: numpy, scipy, soundfile, kokoro-onnx, ffmpeg
Kokoro model files (kokoro-v1.0.onnx, voices-v1.0.bin) are downloaded
automatically from the kokoro-onnx GitHub release when missing.
"""
import argparse, hashlib, json, os, subprocess, sys, urllib.request
import numpy as np
import soundfile as sf
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import narration as N

SR = 48000
KOKORO_SR = 24000
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
VOICE = "bm_george"
LANG = "en-gb"


# ---------------------------------------------------------------- helpers
def ensure_models(cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    for f in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
        p = os.path.join(cache_dir, f)
        if not os.path.exists(p) or os.path.getsize(p) < 1_000_000:
            print("downloading", f)
            urllib.request.urlretrieve(MODEL_URL + f, p)
    return (os.path.join(cache_dir, "kokoro-v1.0.onnx"),
            os.path.join(cache_dir, "voices-v1.0.bin"))


def synth_sentences(plan, cache_dir, model_dir):
    """Return list (per scene) of lists of float32 arrays @48k (mono)."""
    from kokoro_onnx import Kokoro
    m, v = ensure_models(model_dir)
    k = Kokoro(m, v)
    os.makedirs(cache_dir, exist_ok=True)
    out = []
    for sc in plan["scenes"]:
        arrs = []
        for s in sc["sentences"]:
            spoken = s[1] if isinstance(s, tuple) else s
            key = hashlib.md5(f"{VOICE}|{plan['speed']}|{spoken}".encode()).hexdigest()
            fp = os.path.join(cache_dir, key + ".npy")
            if os.path.exists(fp):
                a = np.load(fp)
            else:
                a, sr = k.create(spoken, voice=VOICE, speed=plan["speed"], lang=LANG)
                a = signal.resample_poly(a.astype(np.float64), SR, sr).astype(np.float32)
                a = trim_silence(a)
                np.save(fp, a)
            arrs.append(a)
        out.append(arrs)
    return out


def trim_silence(a, thr=0.004, keep=0.04):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(keep * SR))
    e = min(len(a), idx[-1] + int(keep * 2 * SR))
    return a[s:e]


def lay_out(plan, voice):
    """Compute timeline (scene + sentence start/end) from spoken durations."""
    lead, tail_min, gap = plan["lead"], plan["tail_min"], plan["gap"]
    scenes = []
    cur = 0.0
    nat = []
    for si, sc in enumerate(plan["scenes"]):
        t = cur + lead
        sents = []
        for i, a in enumerate(voice[si]):
            d = len(a) / SR
            sents.append({"start": t, "end": t + d, "dur": d})
            t += d + gap
        end = t - gap + tail_min
        scenes.append({"start": cur, "end": end, "sents": sents})
        cur = end
    natural = cur
    extra = max(0.0, plan["target_total"] - natural)
    # distribute extra to scene tails (and half to leads) proportionally
    if extra > 0:
        n = len(scenes)
        per = extra / n
        shift = 0.0
        for sc in scenes:
            sc["start"] += shift
            for s in sc["sents"]:
                s["start"] += shift + per * 0.35
                s["end"] += shift + per * 0.35
            sc["end"] += shift + per
            shift += per
    return scenes, max(natural, plan["target_total"])


def build_timeline(plan, scenes, total):
    tl = {"title": plan["title"], "mode": plan["mode"], "total": total, "scenes": [],
          "cards": [], "captions": []}
    card_slots = []  # active card ends
    for si, (sc, lay) in enumerate(zip(plan["scenes"], scenes)):
        tl["scenes"].append({"id": sc["id"], "title": sc["title"], "start": lay["start"], "end": lay["end"]})
        for ci, c in enumerate(sc["cards"]):
            idx, label, value = c[0], c[1], c[2]
            idx = min(idx, len(lay["sents"]) - 1)
            start = lay["sents"][idx]["start"]
            end = min(start + max(lay["sents"][idx]["dur"] + 1.2, 4.2), lay["end"] - 0.25)
            # lowest free slot (cards keep their slot until they have faded out)
            busy = {sl: e for sl, e in card_slots if e + 0.15 > start}
            slot = 0
            while slot in busy:
                slot += 1
            card_slots = [(sl, e) for sl, e in card_slots if e + 0.15 > start] + [(slot, end)]
            tl["cards"].append({"start": start, "end": end, "label": label, "value": value, "slot": slot})
        for i, s in enumerate(sc["sentences"]):
            shown = s[0] if isinstance(s, tuple) else s
            lay_s = lay["sents"][i]
            tl["captions"].extend(split_caption(shown, lay_s["start"], lay_s["end"], plan["mode"]))
    return tl


def split_caption(text, start, end, mode, max_chars=None):
    max_chars = max_chars or (34 if mode == "shorts" else 78)
    words = text.split()
    chunks, cur = [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > max_chars:
            chunks.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        chunks.append(cur)
    # merge tiny tail chunk
    if len(chunks) > 1 and len(chunks[-1]) < 12:
        chunks[-2] += " " + chunks[-1]
        chunks.pop()
    tot = sum(len(c) for c in chunks)
    out, t = [], start
    for c in chunks:
        d = (end - start) * len(c) / tot
        out.append({"start": t, "end": t + d, "text": c})
        t += d
    return out


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(captions, path, mode):
    lines = []
    for i, c in enumerate(captions, 1):
        text = c["text"]
        if mode != "shorts" and len(text) > 42:
            mid = text.rfind(" ", 0, len(text) // 2 + 8)
            if mid > 0:
                text = text[:mid] + "\n" + text[mid + 1:]
        lines.append(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{text}\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ---------------------------------------------------------------- DSP
def midi(n):
    return 440.0 * 2 ** ((np.asarray(n, dtype=np.float64) - 69) / 12.0)


def lp(x, fc, order=4):
    sos = signal.butter(order, fc, "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def bp(x, f1, f2, order=2):
    sos = signal.butter(order, [f1, f2], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def saw(freq, n, phase0=0.0):
    ph = (phase0 + np.cumsum(np.full(n, freq / SR))) % 1.0
    return 2 * ph - 1


def make_ir(seconds, rng, decay=3.0):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    env = np.exp(-decay * t)
    ir = np.stack([rng.standard_normal(n) * env, rng.standard_normal(n) * env])
    ir = lp(ir, 7000)
    ir[:, : int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True)) * 0.9


def reverb(x_stereo, ir, wet=0.35):
    out = np.stack([signal.oaconvolve(x_stereo[c], ir[c])[: x_stereo.shape[1]] for c in range(2)])
    return x_stereo * (1 - wet) + out * wet * 3.0


def env_ad(n, a, d_pow=3.0):
    t = np.arange(n) / SR
    an = int(a * SR)
    e = np.ones(n)
    if an > 0:
        e[:an] = np.linspace(0, 1, an)
    e[an:] = np.exp(-d_pow * (t[an:] - t[an]) / max(t[-1] - t[an], 1e-3) * 2)
    return e


# Scene moods -------------------------------------------------------------
# chords: list of lists of midi notes, each held `bar` seconds.
MOODS = {
    "hook":       dict(chords=[[50, 57, 62, 65], [46, 53, 57, 62], [48, 55, 60, 64], [45, 52, 57, 60]], bar=8, bright=1400, sub=38, bells=0.6, level=0.9),
    "voyager":    dict(chords=[[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]], bar=8, bright=1100, sub=33, bells=1.0, level=0.8),
    "distance":   dict(chords=[[50, 57, 60, 64], [46, 53, 57, 60], [41, 48, 52, 57], [43, 50, 53, 57]], bar=8, bright=1600, sub=38, bells=1.3, level=0.85),
    "system":     dict(chords=[[53, 57, 60, 64], [55, 59, 62, 66], [50, 57, 60, 64], [48, 55, 59, 64]], bar=7, bright=2200, sub=41, bells=1.0, level=0.9),
    "proxima":    dict(chords=[[52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 61], [47, 51, 54, 59]], bar=7, bright=1500, sub=40, bells=0.8, pulse=70, level=0.9),
    "speed":      dict(chords=[[45, 52, 57], [45, 52, 58], [43, 50, 55, 58], [44, 51, 56, 59]], bar=6, bright=1200, sub=33, pulse=100, level=0.9),
    "starshot":   dict(chords=[[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], bar=6, bright=2600, sub=36, pulse=112, arp=True, level=1.0),
    "dust":       dict(chords=[[38, 45, 50, 53], [38, 45, 51, 54]], bar=9, bright=700, sub=31, impacts=0.22, level=0.9, dark=True),
    "radiation":  dict(chords=[[46, 53, 58, 62], [44, 51, 56, 60]], bar=9, bright=900, sub=34, ticks=0.7, shimmer=True, level=0.85, dark=True),
    "relativity": dict(chords=[[43, 50, 55, 59], [45, 52, 57, 61], [47, 54, 59, 63], [50, 57, 62, 66]], bar=7, bright=1800, sub=31, rise=True, level=1.0),
    "arrival":    dict(chords=[[40, 47, 52, 55], [40, 47, 53, 56]], bar=9, bright=700, sub=28, impacts=0.06, level=0.85, dark=True, swell=True),
    "finale":     dict(chords=[[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], bar=8, bright=2400, sub=38, bells=1.1, level=1.0, warm=True),
}


def render_scene_music(mood_id, dur, rng):
    m = MOODS[mood_id]
    n = int(dur * SR)
    out = np.zeros((2, n))
    t = np.arange(n) / SR

    # --- pad
    bar = m["bar"]
    nb = int(np.ceil(dur / bar)) + 1
    pad = np.zeros((2, n))
    for b in range(nb):
        chord = m["chords"][b % len(m["chords"])]
        s0 = int(b * bar * SR)
        s1 = min(n, int((b + 1) * bar * SR + 2.5 * SR))
        if s0 >= n:
            break
        L = s1 - s0
        seg = np.zeros((2, L))
        for note in chord:
            f = float(midi(note))
            for det, pan in ((-0.07, 0.25), (0.0, 0.5), (0.09, 0.75)):
                w = saw(f * (1 + det * 0.01 * 3), L, rng.random())
                seg[0] += w * (1 - pan)
                seg[1] += w * pan
        e = np.minimum(1, np.arange(L) / (1.8 * SR)) * np.minimum(1, (L - np.arange(L)) / (2.5 * SR))
        pad[:, s0:s1] += seg * e
    pad = lp(pad, m["bright"], 2)
    if m.get("warm"):
        pad = pad * 1.15
    pad *= 0.035
    out += pad

    # --- sub drone
    f = float(midi(m["sub"]))
    sub = np.sin(2 * np.pi * f * t) * 0.5 + np.sin(2 * np.pi * f * 2 * t) * 0.12
    sub *= (0.65 + 0.35 * np.sin(2 * np.pi * t / 11.0))
    out += sub * 0.10

    # --- bells / arpeggio (pentatonic sines with long decay)
    if m.get("bells") or m.get("arp"):
        density = m.get("bells", 1.0) if not m.get("arp") else 2.0
        step = (60.0 / m.get("pulse", 72)) * (0.5 if m.get("arp") else 2.0) / max(density, 0.3)
        tt = 0.5
        k = 0
        while tt < dur - 1.5:
            chord = m["chords"][int(tt // bar) % len(m["chords"])]
            note = chord[(k * 2 + (k // 3)) % len(chord)] + 12 * (1 + (k % 3 == 2))
            f = float(midi(note))
            L = int(3.2 * SR)
            L = min(L, n - int(tt * SR))
            if L <= 0:
                break
            tb = np.arange(L) / SR
            env = np.exp(-tb * (3.2 if m.get("arp") else 1.5))
            tone = (np.sin(2 * np.pi * f * tb) + 0.3 * np.sin(2 * np.pi * f * 2.76 * tb) * np.exp(-tb * 4)) * env
            pan = 0.25 + 0.5 * rng.random()
            i0 = int(tt * SR)
            amp = 0.05 * (1.0 if not m.get("arp") else 0.7)
            out[0, i0:i0 + L] += tone * amp * (1 - pan)
            out[1, i0:i0 + L] += tone * amp * pan
            tt += step * (0.9 + 0.2 * rng.random())
            k += 1

    # --- pulse (rhythmic low plucks)
    if m.get("pulse") and not m.get("arp"):
        beat = 60.0 / m["pulse"]
        tt = 0.0
        k = 0
        while tt < dur - 0.5:
            chord = m["chords"][int(tt // bar) % len(m["chords"])]
            f = float(midi(chord[0] - 12))
            L = int(0.5 * SR)
            L = min(L, n - int(tt * SR))
            if L <= 0:
                break
            tb = np.arange(L) / SR
            tone = np.sin(2 * np.pi * f * tb) * np.exp(-tb * 7)
            out[:, int(tt * SR):int(tt * SR) + L] += tone * 0.09 * (1.0 if k % 4 == 0 else 0.55)
            tt += beat
            k += 1
    if m.get("arp"):
        beat = 60.0 / m["pulse"]
        tt = 0.0
        k = 0
        while tt < dur - 0.5:
            chord = m["chords"][int(tt // bar) % len(m["chords"])]
            f = float(midi(chord[0] - 12))
            L = min(int(0.6 * SR), n - int(tt * SR))
            if L <= 0:
                break
            tb = np.arange(L) / SR
            tone = np.sin(2 * np.pi * f * tb) * np.exp(-tb * 5)
            out[:, int(tt * SR):int(tt * SR) + L] += tone * 0.12 * (1.0 if k % 4 == 0 else 0.5)
            tt += beat
            k += 1

    # --- impacts (distant thuds)
    if m.get("impacts"):
        rate = m["impacts"]
        tt = 1.0
        while tt < dur - 1:
            L = min(int(2.2 * SR), n - int(tt * SR))
            if L <= 0:
                break
            tb = np.arange(L) / SR
            noise = lp(rng.standard_normal(L), 180, 2)
            tone = (np.sin(2 * np.pi * (50 * np.exp(-tb * 3) + 28) * tb) + 0.5 * noise * 8) * np.exp(-tb * 3.5)
            amp = 0.16 * (0.5 + rng.random())
            out[:, int(tt * SR):int(tt * SR) + L] += tone * amp
            tt += 1.0 / rate * (0.4 + 1.2 * rng.random())

    # --- geiger-like ticks
    if m.get("ticks"):
        tt = 0.5
        while tt < dur - 0.3:
            L = int(0.012 * SR)
            i0 = int(tt * SR)
            if i0 + L >= n:
                break
            click = rng.standard_normal(L) * np.exp(-np.arange(L) / (0.002 * SR))
            click = hp(click, 1500)
            pan = rng.random()
            out[0, i0:i0 + L] += click * 0.07 * (1 - pan)
            out[1, i0:i0 + L] += click * 0.07 * pan
            tt += rng.exponential(1.0 / (6.0 * m["ticks"] + 0.1))

    # --- shimmer (high filtered noise swell)
    if m.get("shimmer"):
        nz = bp(rng.standard_normal((2, n)), 3500, 9000)
        mod = 0.5 + 0.5 * np.sin(2 * np.pi * t / 6.5)
        out += nz * mod * 0.012

    # --- riser for relativity
    if m.get("rise"):
        f0, f1 = 80.0, 1400.0
        fr = f0 * (f1 / f0) ** (t / dur)
        ph = 2 * np.pi * np.cumsum(fr) / SR
        r = (np.sin(ph) + 0.4 * np.sin(2 * ph)) * (t / dur) ** 2
        r = lp(r, 4000)
        out[0] += r * 0.05
        out[1] += r * 0.05
        nz = bp(rng.standard_normal((2, n)), 400, 6000) * (t / dur) ** 3
        out += nz * 0.03

    # --- slow swell (arrival)
    if m.get("swell"):
        out *= (0.55 + 0.45 * np.sin(np.pi * 0.5 * t / dur) ** 2)

    out *= m["level"]
    # scene edge fades (the mixer crossfades by overlapping)
    return out


def make_whoosh(rng, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = rng.standard_normal((2, n))
    sweep = np.zeros((2, n))
    # time-varying bandpass by blockwise filtering
    blocks = 16
    bl = n // blocks
    for b in range(blocks):
        c = 300 + 5500 * np.sin(np.pi * (b + 0.5) / blocks) ** 1.5
        seg = bp(nz[:, b * bl:(b + 1) * bl], max(100, c * 0.6), min(c * 1.4, SR / 2 - 200))
        sweep[:, b * bl:(b + 1) * bl] = seg
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return sweep * env * 0.12


def make_boom(rng):
    n = int(3.5 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * (46 * np.exp(-t * 1.2) + 24) * t) * np.exp(-t * 1.5)
    nz = lp(rng.standard_normal(n), 220, 2) * np.exp(-t * 2.5)
    x = tone + nz * 1.5
    return np.stack([x, x]) * 0.35


def make_blip(f=1500.0):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 22) + 0.4 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 35)
    return np.stack([x, x]) * 0.05


def place(buf, clip, t0, gain=1.0):
    i0 = int(t0 * SR)
    if i0 >= buf.shape[-1]:
        return
    L = min(clip.shape[-1], buf.shape[-1] - i0)
    buf[..., i0:i0 + L] += clip[..., :L] * gain


# ---------------------------------------------------------------- main
def loudnorm_two_pass(in_wav, out_wav, target=-14.0, tp=-1.5, lra=9):
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-i", in_wav, "-af",
           f"loudnorm=I={target}:TP={tp}:LRA={lra}:print_format=json", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    txt = r.stderr
    js = txt[txt.rfind("{"): txt.rfind("}") + 1]
    try:
        d = json.loads(js)
        af = (f"loudnorm=I={target}:TP={tp}:LRA={lra}:measured_I={d['input_i']}:measured_TP={d['input_tp']}"
              f":measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}"
              ":linear=true:print_format=summary")
    except Exception:
        af = f"loudnorm=I={target}:TP={tp}:LRA={lra}"
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", in_wav, "-af", af + ",alimiter=limit=0.89",
                    "-ar", str(SR), "-c:a", "pcm_s24le", out_wav], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["main", "shorts"], default="main")
    ap.add_argument("--out", default=None)
    ap.add_argument("--model-dir", default=os.environ.get("KOKORO_DIR", os.path.expanduser("~/.cache/kokoro")))
    ap.add_argument("--voice-only", action="store_true", help="only report narration durations")
    ap.add_argument("--timeline-only", action="store_true", help="only (re)write timeline.json + subtitles.srt")
    a = ap.parse_args()
    plan = N.MAIN if a.mode == "main" else N.SHORTS
    out = a.out or f"build/{a.mode}"
    os.makedirs(out, exist_ok=True)
    cache = os.path.join(os.path.dirname(out.rstrip("/")) or ".", "tts_cache")

    voice = synth_sentences(plan, cache, a.model_dir)
    spoken_total = sum(len(x) for sc in voice for x in sc) / SR
    words = sum(len((s[1] if isinstance(s, tuple) else s).split()) for sc in plan["scenes"] for s in sc["sentences"])
    print(f"[{a.mode}] words={words} spoken={spoken_total:.1f}s")
    scenes, total = lay_out(plan, voice)
    print(f"[{a.mode}] timeline total={total:.1f}s natural-end-of-last-scene={scenes[-1]['end']:.1f}s")
    for sc, lay in zip(plan["scenes"], scenes):
        print(f"   {sc['id']:<11} {lay['start']:7.1f} -> {lay['end']:7.1f}  ({lay['end']-lay['start']:.1f}s)")
    if a.voice_only:
        return

    tl = build_timeline(plan, scenes, total)
    total = tl["total"] = max(total, scenes[-1]["end"])
    if a.timeline_only:
        write_srt(tl["captions"], os.path.join(out, "subtitles.srt"), a.mode)
        with open(os.path.join(out, "timeline.json"), "w", encoding="utf-8") as f:
            json.dump(tl, f, ensure_ascii=False, indent=1)
        print("timeline written ->", out)
        return
    N_SAMP = int(total * SR) + SR
    rng = np.random.default_rng(7)

    # narration track (mono)
    nar = np.zeros(N_SAMP)
    for si, lay in enumerate(scenes):
        for arr, s in zip(voice[si], lay["sents"]):
            place(nar, arr.astype(np.float64), s["start"])
    # voice polish: hp + gentle presence + soft compression
    nar = hp(nar, 70)
    pres = bp(nar, 2500, 5200, 1) * 0.12
    nar = nar + pres
    peak = np.max(np.abs(nar)) + 1e-9
    nar = np.tanh(nar / peak * 1.6) / np.tanh(1.6) * 0.9
    sf.write(os.path.join(out, "narration.wav"), nar, SR, subtype="PCM_24")

    # music
    music = np.zeros((2, N_SAMP))
    fade = 1.6
    for sc, lay in zip(plan["scenes"], scenes):
        mood = sc["id"]
        d = lay["end"] - lay["start"] + fade
        seg = render_scene_music(mood, d, rng)
        n = seg.shape[1]
        e = np.ones(n)
        fi, fo = int(fade * SR), int(fade * SR)
        e[:fi] = np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
        e[-fo:] = np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
        seg *= e
        place(music, seg, lay["start"] - (fade * 0.5 if lay["start"] > 0 else 0) + (fade * 0.5 if lay["start"] <= 0 else 0) * 0)
    ir = make_ir(3.8, rng, 2.4)
    music = reverb(music, ir, wet=0.38)
    music = hp(music, 28)

    # sidechain duck from narration envelope
    env = np.abs(nar)
    env = lp(env, 4.0, 1)
    env = np.clip(env / (np.percentile(env, 99) + 1e-9), 0, 1)
    duck = 1.0 - 0.62 * env
    duck = lp(duck, 6.0, 1)
    music *= duck

    # sfx
    sfx = np.zeros((2, N_SAMP))
    for si, lay in enumerate(scenes):
        if si > 0:
            place(sfx, make_whoosh(rng), lay["start"] - 0.9, 0.9)
    place(sfx, make_boom(rng), 0.0, 0.9)
    for c in tl["cards"]:
        place(sfx, make_blip(1400 + 200 * (c["slot"] % 3)), c["start"], 1.0)
    if a.mode == "main":
        # dust hit stingers
        for sc, lay in zip(plan["scenes"], scenes):
            if sc["id"] == "dust":
                place(sfx, make_boom(rng), lay["sents"][4]["start"], 0.8)
            if sc["id"] == "arrival":
                place(sfx, make_boom(rng), lay["sents"][1]["start"] + 0.2, 0.6)

    # vocal reverb send (subtle)
    nar_st = np.stack([nar, nar])
    ir_v = make_ir(1.4, rng, 5.0)
    nar_wet = reverb(nar_st, ir_v, wet=0.12)

    mix = nar_wet * 1.0 + music * 0.60 + sfx * 0.8
    # fade in/out
    fi = int(0.8 * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi)
    fo = int(2.5 * SR)
    end_i = int(total * SR)
    mix = mix[:, : end_i + int(0.5 * SR)]
    mix[:, end_i - fo:end_i] *= np.linspace(1, 0, fo)
    mix[:, end_i:] = 0
    mix = mix[:, :end_i]

    raw = os.path.join(out, "_mix_raw.wav")
    sf.write(raw, mix.T, SR, subtype="PCM_24")
    final_wav = os.path.join(out, "audio_master.wav")
    loudnorm_two_pass(raw, final_wav)
    os.remove(raw)

    # lossless + lossy deliverables
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", final_wav, "-c:a", "flac",
                    os.path.join(out, "audio_master.flac")], check=True)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", final_wav, "-c:a", "libmp3lame",
                    "-b:a", "320k", os.path.join(out, "audio.mp3")], check=True)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", os.path.join(out, "narration.wav"),
                    "-c:a", "flac", os.path.join(out, "narration.flac")], check=True)
    os.remove(final_wav)
    os.remove(os.path.join(out, "narration.wav"))

    write_srt(tl["captions"], os.path.join(out, "subtitles.srt"), a.mode)
    with open(os.path.join(out, "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(tl, f, ensure_ascii=False, indent=1)
    print("done ->", out)


if __name__ == "__main__":
    main()
