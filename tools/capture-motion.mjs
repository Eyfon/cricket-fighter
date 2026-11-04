import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  await page.addInitScript(() => {
    let callback,
      now = 1000;
    window.requestAnimationFrame = (f) => ((callback = f), 1);
    window.advance = (n) => {
      for (let i = 0; i < n; i++) {
        now += 1000 / 60;
        const f = callback;
        callback = null;
        f?.(now);
      }
    };
  });
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5174/");
  await page.waitForFunction(
    async () => (await import("./js/arena.js")).snapshot().visualsReady,
  );
  await page.evaluate(() => {
    document.getElementById("play").click();
    document.querySelector('[data-mode="local"]').click();
  });
  const advance = (n) => page.evaluate((n) => advance(n), n);
  const start = async () => {
    await page.evaluate(() => {
      document.getElementById("characters-next").click();
      document.getElementById("start").click();
    });
    await advance(145);
  };
  await mkdir("artifacts/motion", { recursive: true });
  let index = 0;
  const capture = async () => {
    const png = await page.evaluate(
      () =>
        document.querySelector("#arena").toDataURL("image/png").split(",")[1],
    );
    await writeFile(
      `artifacts/motion/frame${String(index++).padStart(3, "0")}.png`,
      Buffer.from(png, "base64"),
    );
  };
  await start();
  await page.keyboard.down("d");
  for (let i = 0; i < 30; i++) {
    await advance(2);
    await capture();
  }
  await page.keyboard.up("d");
  await page.keyboard.down("s");
  await page.keyboard.down("j");
  for (let i = 0; i < 35; i++) {
    await advance(2);
    await capture();
    if (i === 0) {
      await page.keyboard.up("j");
      await page.keyboard.up("s");
    }
  }
  await page.evaluate(() => {
    document.getElementById("pause").click();
    document.getElementById("battle-return").click();
  });
  await page.selectOption("#p1", "prototype-b");
  await page.selectOption("#p2", "prototype-a");
  await start();
  await page.keyboard.down("d");
  await page.keyboard.down("ArrowLeft");
  for (let i = 0; i < 25; i++) {
    await advance(2);
    await capture();
    if (i === 21) {
      await page.keyboard.up("d");
      await page.keyboard.up("ArrowLeft");
    }
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const energy = await page.evaluate(
      async () =>
        (await import("./js/arena.js")).snapshot().fighters[0].energyPoints,
    );
    if (energy >= 1) break;
    await page.keyboard.down("d");
    await advance(35);
    await page.keyboard.up("d");
    await page.keyboard.down("j");
    await advance(1);
    await page.keyboard.up("j");
    await advance(32);
  }
  await page.keyboard.down("d");
  await advance(18);
  await page.keyboard.up("d");
  await page.keyboard.down("u");
  for (let i = 0; i < 55; i++) {
    await advance(2);
    await capture();
    if (i === 0) await page.keyboard.up("u");
  }
  console.log(`Captured ${index} gameplay frames.`);
} finally {
  await browser.close();
}
