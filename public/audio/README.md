# Audio loops

Three royalty-free phonk loops used by the AI editor pipeline (TikTok-style
Brawl Stars highlight edits). Each clip is a 30-second excerpt trimmed with
ffmpeg from a longer Pixabay track.

All sources are licensed under the **Pixabay Content License**
(<https://pixabay.com/service/license-summary/>): free for commercial and
non-commercial use, no attribution required, no payment required. We credit
the uploaders below as a courtesy.

## Tracks

### `phonk_hype.mp3` — fast / aggressive (target ~145 BPM, big drops)
- **Slot:** triple kills, victory blow
- **Source track:** "Hard Phonk - Phonk Music" by **watermello** (Pixabay)
- **Source page:** <https://pixabay.com/music/phonk-hard-phonk-phonk-music-484666/>
- **Source mp3:** <https://cdn.pixabay.com/download/audio/2026/02/13/audio_66ff20def1.mp3?filename=watermello-hard-phonk-phonk-music-484666.mp3>
- **Original duration:** 1:04 — clip is the first 30s
- **License:** Pixabay Content License (no attribution required)

### `phonk_menacing.mp3` — slower / dark (target ~120 BPM, heavy 808s)
- **Slot:** clutch / comeback moments
- **Source track:** "Phonk Music - Phonk Aura" by **xxxdolm** (Pixabay)
- **Source page:** <https://pixabay.com/music/phonk-phonk-music-phonk-aura-471166/>
- **Source mp3:** <https://cdn.pixabay.com/download/audio/2026/01/22/audio_a291586e7b.mp3?filename=xxxdolm-phonk-music-phonk-aura-471166.mp3>
- **Original duration:** 2:35 — clip is 30s starting at 0:30 (skips the intro for an immediate dark groove)
- **License:** Pixabay Content License (no attribution required)

### `phonk_cocky.mp3` — medium / swagger (target ~135 BPM)
- **Slot:** routine kills, "ez dub" energy
- **Source track:** "Phonk" by **alexgrohl** (Pixabay)
- **Source page:** <https://pixabay.com/music/phonk-phonk-505963/>
- **Source mp3:** <https://cdn.pixabay.com/download/audio/2026/03/20/audio_28db178a30.mp3?filename=alexgrohl-phonk-505963.mp3>
- **Original duration:** 1:36 — clip is 30s starting at 0:15 (lands on the main hook)
- **License:** Pixabay Content License (no attribution required)

## Re-generating

The clips were trimmed with ffmpeg (via `ffmpeg-static`):

```bash
# 30s, 160 kbps stereo
ffmpeg -y -i <full.mp3> -ss <start> -t 30 -b:a 160k -ac 2 <slot>.mp3
```

Output specs: 30.0s, 160 kbps CBR, stereo, ~588 KB each. Total folder ≈ 1.8 MB.

## Manifest

The typed manifest consumed by the editor lives at
`src/lib/ai-editor/audio.ts`.
