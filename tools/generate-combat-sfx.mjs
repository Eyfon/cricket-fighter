import { mkdir, writeFile } from "node:fs/promises";
import { SOUNDS, SAMPLE_RATE, renderSound } from "./combat-sound-design.mjs";
const directory = new URL("../assets/audio/combat/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const name of Object.keys(SOUNDS)) {
  for (let take = 0; take < 3; take++) {
    const samples = renderSound(name, take),
      wav = Buffer.alloc(44 + samples.length * 2);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(SAMPLE_RATE, 24);
    wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((sample, i) =>
      wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2),
    );
    await writeFile(new URL(`${name}-${take}.wav`, directory), wav);
  }
}
console.log("Generated 27 original arcade combat samples.");
