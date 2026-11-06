"use client";

import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import outlines from "@/lib/broadcast/avertaGlyphs.json";

type Glyph = { advance: number; path: string };
type Font = { glyphs: Record<string, Glyph>; kern: Record<string, number> };
const fonts = outlines as Record<string, Font>;
const useMetricsEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function OutlineWord({ word }: { word: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [metrics, setMetrics] = useState({ weight: "400", tracking: 0, tabular: false, transform: "none" });
  useMetricsEffect(() => {
    const element = ref.current;
    if (!element) return;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (!style) return;
    const requested = Number(style.fontWeight) || (style.fontWeight === "bold" ? 700 : 400);
    const weight = requested >= 650 ? "700" : requested >= 500 ? "600" : "400";
    const size = parseFloat(style.fontSize) || 16;
    const tracking = (parseFloat(style.letterSpacing) || 0) / size * 1000;
    const tabular = style.fontVariantNumeric.includes("tabular-nums");
    const transform = style.textTransform;
    setMetrics(old => old.weight === weight && Math.abs(old.tracking - tracking) < .01 && old.tabular === tabular && old.transform === transform ? old : { weight, tracking, tabular, transform });
  });
  const font = fonts[metrics.weight];
  const characters = [...(metrics.transform === "uppercase" ? word.toLocaleUpperCase("en-GB") : metrics.transform === "lowercase" ? word.toLocaleLowerCase("en-GB") : word)];
  const digitWidth = Math.max(..."0123456789".split("").map(digit => font.glyphs[digit].advance));
  let cursor = 0;
  const paths = characters.map((character, index) => {
    const glyph = font.glyphs[character] ?? font.glyphs["?"];
    const advance = metrics.tabular && /[0-9]/.test(character) ? digitWidth : glyph.advance;
    const x = cursor + (advance - glyph.advance) / 2;
    cursor += advance + (index < characters.length - 1 ? (font.kern[character + characters[index + 1]] ?? 0) + metrics.tracking : 0);
    return <path key={index} d={glyph.path} transform={`translate(${x} 0)`} />;
  });
  const width = Math.max(1, cursor);
  return <svg ref={ref} aria-hidden="true" focusable="false" shapeRendering="geometricPrecision" viewBox={`0 -800 ${width} 1000`} style={{ display: "inline-block", width: `${width / 1000}em`, height: "1em", verticalAlign: "-.2em", overflow: "visible", font: "inherit", letterSpacing: "inherit" }}><g fill="currentColor" transform="scale(1 -1)">{paths}</g></svg>;
}

export function OutlinedText({ text }: { text: string }) {
  return <bdi role="img" aria-label={text} style={{ font: "inherit", letterSpacing: "inherit", color: "inherit" }}>{text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : <OutlineWord key={index} word={word} />)}</bdi>;
}

export function SvgOutlinedText({ text, x, y, size, anchor = "start" }: { text: string; x: number; y: number; size: number; anchor?: "start" | "end" }) {
  const font = fonts["700"];
  let cursor = 0;
  const characters = [...text];
  const paths = characters.map((character, index) => {
    const glyph = font.glyphs[character] ?? font.glyphs["?"];
    const offset = cursor;
    cursor += glyph.advance + (font.kern[character + (characters[index + 1] ?? "")] ?? 0);
    return <path key={index} d={glyph.path} transform={`translate(${offset} 0)`} />;
  });
  return <g role="img" aria-label={text} transform={`translate(${x - (anchor === "end" ? cursor / 1000 * size : 0)} ${y}) scale(${size / 1000} ${-size / 1000})`} fill="currentColor">{paths}</g>;
}

// Run at each presentation component boundary, preserving its layout, colours,
// semantics and animations. No visible SVG text elements or browser fonts remain.
export function outlineBroadcastText(node: ReactNode): ReactNode {
  return Children.map(node, child => {
    if (typeof child === "string" || typeof child === "number") {
      const text = String(child);
      return text.trim() ? <OutlinedText text={text} /> : child;
    }
    if (!isValidElement(child) || child.type === OutlinedText) return child;
    if (typeof child.type === "string" && ["svg", "style", "script", "input", "select", "textarea"].includes(child.type)) return child;
    const element = child as ReactElement<{ children?: ReactNode }>;
    return element.props.children === undefined ? element : cloneElement(element, {}, outlineBroadcastText(element.props.children));
  });
}
