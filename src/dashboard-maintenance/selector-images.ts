import type { BatteryTileFeature, MaintenanceModuleId } from "./types";

const rect = (x: number, y: number, w: number, h: number, op: number, rx = 2) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="currentColor" fill-opacity="${op}"/>`;

const outline = (x: number, y: number, w: number, h: number, rx = 3) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" stroke="currentColor" stroke-opacity="0.48" stroke-width="2"/>`;

const dot = (x: number, y: number, r: number, op: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" fill-opacity="${op}"/>`;

const ring = (x: number, y: number, r: number, op: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" stroke="currentColor" stroke-opacity="${op}" stroke-width="2"/>`;

const line = (d: string, op: number) =>
  `<path d="${d}" stroke="currentColor" stroke-opacity="${op}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;

const area = (d: string, op: number) =>
  `<path d="${d}" fill="currentColor" fill-opacity="${op}"/>`;

const columns = (count: number, draw: (index: number) => string) =>
  Array.from({ length: count }, (_, index) => draw(index)).join("");

/** A small picture of what each module shows, in the style of HA's select box images. */
const MODULE_DRAWINGS: Record<MaintenanceModuleId, string> = {
  system: columns(
    3,
    (i) =>
      rect(10 + i * 26, 12, 22, 20, 0.12, 4) +
      rect(14 + i * 26, 25, 14, 3, 0.12, 1.5) +
      rect(14 + i * 26, 25, [10, 5, 12][i] ?? 8, 3, 0.48, 1.5) +
      rect(14 + i * 26, 17, 10, 3, 0.32, 1.5),
  ),
  batteries:
    outline(24, 11, 44, 22, 4) +
    rect(70, 18, 4, 8, 0.48, 1) +
    rect(28, 15, 10, 14, 0.48),
  repairs:
    area("M22 10 L33 30 L11 30 Z", 0.48) +
    rect(42, 13, 42, 4, 0.32) +
    rect(42, 21, 30, 4, 0.12) +
    rect(42, 29, 36, 4, 0.12),
  updates:
    area("M22 8 L32 20 L26 20 L26 34 L18 34 L18 20 L12 20 Z", 0.48) +
    rect(42, 13, 42, 4, 0.32) +
    rect(42, 21, 30, 4, 0.12) +
    rect(42, 29, 36, 4, 0.12),
  availability:
    dot(22, 22, 8, 0.48) +
    dot(47, 22, 8, 0.48) +
    ring(72, 22, 7, 0.32),
  stale:
    ring(47, 22, 13, 0.48) +
    line("M47 14 L47 22 L53 26", 0.72),
  integrations: columns(
    4,
    (i) =>
      i === 3
        ? outline(12 + i * 18, 14, 14, 16, 3)
        : rect(12 + i * 18, 14, 14, 16, 0.32, 3),
  ),
};

/** What a battery tile with each feature looks like. */
const TILE_FEATURE_DRAWINGS: Record<BatteryTileFeature, string> = {
  none: "",
  bar: rect(8, 32, 78, 6, 0.24, 3) + rect(8, 32, 46, 6, 0.48, 3),
  trend: line("M8 37 L20 33 L32 36 L46 30 L60 34 L72 29 L86 32", 0.72),
};

const TILE =
  dot(17, 15, 7, 0.12) + rect(30, 9, 30, 3, 0.48, 1.5) + rect(30, 16, 20, 3, 0.32, 1.5);

const image = (drawing: string, dark: boolean) => {
  const ink = dark ? "white" : "black";

  const svg =
    `<svg width="94" height="44" viewBox="0 0 94 44" fill="none" color="${ink}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="94" height="44" rx="8" fill="${dark ? "#1C1C1C" : "white"}"/>` +
    `<rect x="0.5" y="0.5" width="93" height="43" rx="7.5" stroke="${ink}" stroke-opacity="${dark ? 0.24 : 0.12}"/>` +
    `${drawing}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const moduleImage = (id: MaintenanceModuleId) => ({
  src: image(MODULE_DRAWINGS[id], false),
  src_dark: image(MODULE_DRAWINGS[id], true),
});

export const tileFeatureImage = (feature: BatteryTileFeature) => ({
  src: image(TILE + TILE_FEATURE_DRAWINGS[feature], false),
  src_dark: image(TILE + TILE_FEATURE_DRAWINGS[feature], true),
});
