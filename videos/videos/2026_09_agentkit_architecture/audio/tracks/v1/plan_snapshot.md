# Audio Plan

## Plan

SFX-only track, no voiceover and no music. Four short functional stings placed at structural beats over an otherwise silent 575s runtime: a gate-confirm click at the two moments the pipeline diagram highlights a review gate (segment `pipeline` and segment `example`), and a mechanical latch close/open pair bracketing the FREEZE marker's entrance and exit in segment `freeze-unfreeze`. Track is padded with silence to exactly match the video's total runtime (575s = sum of all 15 segments' `advances`).

### Cue 1 -- Gate confirm (pipeline: RED TEAM reveal)
Source: audio/originals/sfx/gate_confirm/
Slice: full file
Place at: 66s
Volume: 70%
Fades: none (clip is 0.16s, too short to need fades)
Notes: Fires as the RED TEAM review-gate node lights up during the pipeline diagram's draw-in sequence (segment `pipeline` starts at track t=55s; this node lands ~11s into that segment).

ffmpeg snippet:
[0:a] asplit=2 [gsrc1][gsrc2];
[gsrc1] volume=0.7, adelay=66000:all=1 [sfx1]

### Cue 2 -- Gate confirm (example: PR GATES reveal)
Source: audio/originals/sfx/gate_confirm/
Slice: full file
Place at: 509s
Volume: 70%
Fades: none
Notes: Same asset as Cue 1, reused (shares input 0 via the asplit in Cue 1's snippet). Fires as the PR GATES node lights up in segment `example`'s pipeline strip (segment starts at track t=500s).

ffmpeg snippet:
[gsrc2] volume=0.7, adelay=509000:all=1 [sfx2]

### Cue 3 -- Freeze latch close
Source: audio/originals/sfx/freeze_latch/
Slice: full file
Place at: 441s
Volume: 80%
Fades: fade in 441.0-441.05s
Notes: Fires as the amber FREEZE bar slams down in segment `freeze-unfreeze` (segment starts at track t=430s; the slam lands ~11s in).

ffmpeg snippet:
[1:a] volume=0.8, afade=t=in:st=0:d=0.05, adelay=441000:all=1 [sfx3]

### Cue 4 -- Freeze latch open
Source: audio/originals/sfx/unfreeze_latch/
Slice: full file
Place at: 456s
Volume: 80%
Fades: fade in 456.0-456.05s
Notes: Fires as the FREEZE bar lifts away in segment `freeze-unfreeze` (~26s into that segment).

ffmpeg snippet:
[2:a] volume=0.8, afade=t=in:st=0:d=0.05, adelay=456000:all=1 [sfx4]

### Final mix command

```bash
ffmpeg -y \
  -i audio/originals/sfx/gate_confirm/audio.mp3 \
  -i audio/originals/sfx/freeze_latch/audio.mp3 \
  -i audio/originals/sfx/unfreeze_latch/audio.mp3 \
  -f lavfi -i anullsrc=r=44100:cl=mono:d=575 \
  -filter_complex "
    [0:a] asplit=2 [gsrc1][gsrc2];
    [gsrc1] volume=0.7, adelay=66000:all=1 [sfx1];
    [gsrc2] volume=0.7, adelay=509000:all=1 [sfx2];
    [1:a] volume=0.8, afade=t=in:st=0:d=0.05, adelay=441000:all=1 [sfx3];
    [2:a] volume=0.8, afade=t=in:st=0:d=0.05, adelay=456000:all=1 [sfx4];
    [sfx1][sfx2][sfx3][sfx4][3:a] amix=inputs=5:duration=longest:normalize=0 [out]
  " -map "[out]" -t 575 -c:a libmp3lame -q:a 2 {TRACK_OUT}
```

Runtime is fixed by the video's own segment durations (no VO to derive length from). A 4th input — `anullsrc` generating exactly 575s of silence — is mixed in alongside the 4 SFX streams so `amix`'s `duration=longest` naturally produces a 575s output; `-t 575` is kept as a safety trim. (First attempt used `apad`/`apad=whole_dur=575` instead of the silent-track approach — both silently failed to pad past the last cue's end time, ~509s. Root-caused before proceeding: `apad`'s `whole_dur` parses a bare integer as microseconds, not seconds, in this ffmpeg build, and without an explicit unit suffix it produced no meaningful pad at all. Kept the explicit `anullsrc` approach since it doesn't depend on that parsing behavior.)

