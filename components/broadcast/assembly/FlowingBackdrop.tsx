import styles from "./assembly.module.css";

const waves = Array.from({ length: 7 }, (_, i) => {
  const y = i * 200 - 200;
  return `M -500 ${y} C 100 ${y - 260}, 550 ${y + 320}, 1200 ${y + 40} S 2250 ${y - 240}, 2900 ${y + 120} L 2900 ${y + 225} C 2250 ${y - 135}, 1850 ${y + 325}, 1200 ${y + 145} S 100 ${y - 155}, -500 ${y + 105} Z`;
});

export default function FlowingBackdrop() {
  return <div className={styles.flowingBackdrop} aria-hidden="true">
    <svg viewBox="0 0 2400 1400" preserveAspectRatio="xMidYMid slice">
      <g className={styles.flowingWaves}>
        {waves.map((d, i) => <path key={i} d={d} fill={i % 2 ? "#00a9b5" : "#88e5d7"} fillOpacity={i % 2 ? .24 : .18} />)}
      </g>
    </svg>
  </div>;
}
