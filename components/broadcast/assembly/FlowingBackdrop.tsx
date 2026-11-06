import styles from "./assembly.module.css";

const horizontal = Array.from({ length: 25 }, (_, i) => {
  const y = i * 80 - 240;
  return `M -400 ${y} C 200 ${y - 180}, 650 ${y + 200}, 1150 ${y} S 2050 ${y - 200}, 2800 ${y + 100}`;
});
const vertical = Array.from({ length: 35 }, (_, i) => {
  const x = i * 100 - 500;
  return `M ${x} -400 C ${x - 160} 150, ${x + 180} 500, ${x} 850 S ${x - 180} 1450, ${x + 60} 1900`;
});

export default function FlowingBackdrop() {
  return <div className={styles.flowingBackdrop} aria-hidden="true">
    <svg viewBox="0 0 2400 1400" preserveAspectRatio="xMidYMid slice">
      <g className={styles.flowingMesh} fill="none" stroke="#67d4ce" strokeWidth="1.5">
        {horizontal.map((d, i) => <path key={`h${i}`} d={d} />)}
        {vertical.map((d, i) => <path key={`v${i}`} d={d} />)}
      </g>
    </svg>
  </div>;
}
