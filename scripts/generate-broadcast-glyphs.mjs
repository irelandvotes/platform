import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fontkit = require("fontkit");
const result = {};
for (const [weight, file] of [[400, "Regular"], [600, "Semibold"], [700, "Bold"]]) {
  const font = fontkit.openSync(`public/fonts/AvertaDemo-${file}.otf`);
  const symbols = "—–‘’“”•…↑↓→←✓★×−";
  const glyphs = {};
  for (const code of font.characterSet) {
    if (code < 32 || (code > 591 && !symbols.includes(String.fromCodePoint(code)))) continue;
    const glyph = font.glyphForCodePoint(code);
    glyphs[String.fromCodePoint(code)] = { advance: glyph.advanceWidth / font.unitsPerEm * 1000, path: glyph.path.scale(1000 / font.unitsPerEm).toSVG() };
  }
  // These UI symbols are absent from Averta Demo; keep them vector icons too.
  const icons = {
    "↑": "M300 0H400V510L535 375L605 445L350 700L95 445L165 375L300 510Z",
    "↓": "M300 700H400V190L535 325L605 255L350 0L95 255L165 325L300 190Z",
    "→": "M0 300H510L375 165L445 95L700 350L445 605L375 535L510 400H0Z",
    "←": "M700 300H190L325 165L255 95L0 350L255 605L325 535L190 400H700Z",
    "★": Array.from({ length: 10 }, (_, i) => {
      const angle = Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? 145 : 340;
      return `${i ? "L" : "M"}${(350 + Math.cos(angle) * radius).toFixed(2)} ${(350 + Math.sin(angle) * radius).toFixed(2)}`;
    }).join("") + "Z",
  };
  for (const [character, path] of Object.entries(icons)) glyphs[character] ??= { advance: 700, path };
  const kern = {};
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáéíóúÁÉÍÓÚ";
  for (const a of letters) for (const b of letters) {
    const run = font.layout(a + b);
    if (run.glyphs.length !== 2) continue;
    const adjustment = (run.positions[0].xAdvance - font.glyphForCodePoint(a.codePointAt(0)).advanceWidth) / font.unitsPerEm * 1000;
    if (adjustment) kern[a + b] = adjustment;
  }
  result[weight] = { glyphs, kern };
}
fs.writeFileSync("lib/broadcast/avertaGlyphs.json", JSON.stringify(result));
console.log("Generated broadcast Averta outlines for weights 400, 600 and 700.");
