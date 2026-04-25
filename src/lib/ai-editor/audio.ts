/**
 * Audio library manifest for the AI editor pipeline.
 *
 * All clips are royalty-free phonk loops sourced from Pixabay
 * (Pixabay Content License — free for commercial and non-commercial use,
 *  no attribution required). See `public/audio/README.md` for source URLs
 *  and per-track metadata.
 *
 * Each `src` is the public-relative path served by Next.js from `/public`.
 * BPM values are nominal targets per slot (the user-facing slot definition);
 * actual track BPMs are within the documented +/- range for each mood.
 */
export const AUDIO_LIBRARY = {
  phonk_hype:     { src: '/audio/phonk_hype.mp3',     bpm: 145, mood: ['hype'] },
  phonk_menacing: { src: '/audio/phonk_menacing.mp3', bpm: 120, mood: ['menacing', 'comeback'] },
  phonk_cocky:    { src: '/audio/phonk_cocky.mp3',    bpm: 135, mood: ['cocky'] },
} as const;

export type AudioKey = keyof typeof AUDIO_LIBRARY;
export type AudioEntry = (typeof AUDIO_LIBRARY)[AudioKey];
