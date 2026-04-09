import Color, { type ColorInstance } from "color";
import iwanthue from "iwanthue";

const palette = iwanthue(100, {
  clustering: "k-means",
  seed: "without",
  quality: 50,
});
let paletteIndex = 0;

const valueColors: Record<string, string> = {};

export function getValueColor(value: string): ColorInstance {
  if (!valueColors[value]) valueColors[value] = palette[paletteIndex++];
  return Color(valueColors[value]);
}

/** @deprecated Use getValueColor instead */
export const getBackendColor = getValueColor;
