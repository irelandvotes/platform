"use client";

import { outlineBroadcastText } from "./OutlinedText";

import { useEffect, useState } from "react";
import styles from "./assembly.module.css";

const captions = ["#NI22", "#Assembly22", "more on irelandvotes.com"];
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export default function BrandClock() {
  const [time, setTime] = useState("--:--");
  const [caption, setCaption] = useState(0);
  useEffect(() => {
    const update = () => setTime(clock.format(new Date()));
    update();
    const timer = window.setInterval(update, 1000);
    const rotation = window.setInterval(() => setCaption(value => (value + 1) % captions.length), 5000);
    return () => { window.clearInterval(timer); window.clearInterval(rotation); };
  }, []);
  return outlineBroadcastText(<div className={styles.stripBrand}>
    <div className={styles.stripLogo}><img src="/portrait.png" alt="Ireland Votes" /></div>
    <time className={styles.stripTime} aria-label={`Current time in Ireland: ${time}`}>{time}</time>
    <div className={styles.stripCaption}><span key={caption}>{captions[caption]}</span></div>
  </div>);
}
