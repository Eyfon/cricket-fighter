"""Trim TTS silence and master built-in announcer takes. Python standard library only."""
from pathlib import Path
import array
import math
import wave
import sys

audio_dir = Path(__file__).resolve().parent.parent / "assets/audio/announcer"
paths = [audio_dir / (key + ".wav") for key in sys.argv[1:]] if len(sys.argv) > 1 else audio_dir.glob("*.wav")
for path in paths:
    with wave.open(str(path), "rb") as source:
        params = source.getparams()
        assert params.nchannels == 1 and params.sampwidth == 2
        samples = array.array("h", source.readframes(params.nframes))
    peak = max(map(abs, samples), default=1)
    audible = [i for i, value in enumerate(samples) if abs(value) > peak * 0.018]
    if not audible:
        raise ValueError(f"Silent recording: {path}")
    pad = int(params.framerate * 0.018)
    samples = samples[max(0, audible[0] - pad):min(len(samples), audible[-1] + pad)]
    # Keep K and O close together even if the speech engine inserts a long pause.
    if path.stem == "ko":
        quiet = int(params.framerate * 0.01)
        spans = []
        start = None
        for i in range(0, len(samples), quiet):
            silent = max(map(abs, samples[i:i + quiet]), default=0) < peak * 0.018
            if silent and start is None:
                start = i
            if not silent and start is not None:
                if i - start > params.framerate * 0.09:
                    spans.append((start, i))
                start = None
        for start, end in reversed(spans):
            keep = int(params.framerate * 0.06)
            del samples[start + keep:end]
    # Gentle saturation increases body and intelligibility under loud effects.
    mastered = array.array("h", (int(28000 * math.tanh(2.1 * value / peak) / math.tanh(2.1)) for value in samples))
    fade = int(params.framerate * 0.005)
    for i in range(fade):
        mastered[i] = int(mastered[i] * i / fade)
        mastered[-i - 1] = int(mastered[-i - 1] * i / fade)
    with wave.open(str(path), "wb") as output:
        output.setparams(params)
        output.writeframes(mastered.tobytes())
    print(path.name, round(len(mastered) / params.framerate, 2))
