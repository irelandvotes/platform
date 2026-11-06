"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./assembly.module.css";

export function openBroadcastWindow() {
  const popup = window.open("", "ireland-votes-output", `popup=yes,width=${screen.availWidth},height=${screen.availHeight},left=0,top=0`);
  if (!popup) return null;
  const doc = popup.document;
  doc.title = "Ireland Votes — Broadcast output";
  doc.documentElement.className = document.documentElement.className;
  doc.body.replaceChildren();
  doc.body.style.cssText = "margin:0;background:#000;overflow:hidden;width:100vw;height:100vh";
  const base = doc.createElement("base");
  base.href = window.location.origin + "/";
  doc.head.replaceChildren(base);
  document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => doc.head.appendChild(node.cloneNode(true)));
  popup.focus();
  // Request within the opening click's activation. A blocked request has an in-window fallback.
  try { void doc.documentElement.requestFullscreen().catch(() => {}); } catch { /* Unsupported fullscreen API. */ }
  return popup;
}

export default function BroadcastWindow({ popup, onClose, children }: { popup: Window; onClose: () => void; children: ReactNode }) {
  const [scale, setScale] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const doc = popup.document;
    const resize = () => { setScale(Math.min(popup.innerWidth / 1920, popup.innerHeight / 1080)); setFullscreen(!!doc.fullscreenElement); };
    resize();
    popup.addEventListener("resize", resize);
    doc.addEventListener("fullscreenchange", resize);
    popup.addEventListener("beforeunload", onClose);
    return () => {
      popup.removeEventListener("resize", resize);
      doc.removeEventListener("fullscreenchange", resize);
      popup.removeEventListener("beforeunload", onClose);
    };
  }, [popup, onClose]);
  async function enterFullscreen() {
    try { await popup.document.documentElement.requestFullscreen(); setError(""); }
    catch { setError("Use F11 or your browser’s fullscreen command."); }
  }
  if (popup.closed) return null;
  return createPortal(<div className={styles.externalOutput}>
    <div className={styles.frame} style={{ width: 1920 * scale, height: 1080 * scale }}><div className={styles.output} style={{ transform: `scale(${scale})` }}>{children}</div></div>
    {!fullscreen && <div className={styles.outputWindowTools}><button onClick={enterFullscreen}>Enter fullscreen</button>{error && <span role="status">{error}</span>}</div>}
  </div>, popup.document.body);
}
