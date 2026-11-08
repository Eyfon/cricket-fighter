// Keep the entire combat width visible and leave room for jumps on wide phones.
// Physics stays in 960 × 540 coordinates; only presentation moves with the view.
export function battleViewport(displayWidth, displayHeight) {
  const aspect = Math.max(1, displayWidth) / Math.max(1, displayHeight);
  const width = Math.max(960, 420 * aspect);
  const height = width / aspect;
  return { width, height, worldX: (width - 960) / 2, worldY: height - 540 };
}
