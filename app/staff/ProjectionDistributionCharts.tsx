"use client";

import { useMemo, useState } from "react";

export type DistributionProbability = { outcome: number; probability: number };
export type DistributionSnapshot = {
  expected: number;
  standardDeviation: number;
  baseline: number;
  probabilities: DistributionProbability[];
};
export type DistributionSeries = {
  key: string;
  label: string;
  color: string;
  byScope: Record<string, DistributionSnapshot>;
};
export type DistributionScope = { key: string; label: string };

function DistributionChart({
  title,
  eyebrow,
  series,
  scopes,
  seriesLabel,
}: {
  title: string;
  eyebrow: string;
  series: DistributionSeries[];
  scopes: DistributionScope[];
  seriesLabel: string;
}) {
  const [seriesKey, setSeriesKey] = useState("");
  const [scopeKey, setScopeKey] = useState("all");
  const [hoveredOutcome, setHoveredOutcome] = useState<number | null>(null);
  const selectedSeries = series.find((item) => item.key === seriesKey) ?? series[0];
  const selectedScope = scopes.find((item) => item.key === scopeKey) ?? scopes[0];
  const snapshot = selectedSeries?.byScope[selectedScope?.key ?? ""];
  const distribution = snapshot?.probabilities ?? [];
  const chart = useMemo(() => {
    const width = 660;
    const height = 250;
    const left = 44;
    const right = 15;
    const top = 18;
    const bottom = 34;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxOutcome = Math.max(1, ...distribution.map((item) => item.outcome));
    const maxProbability = Math.max(1, ...distribution.map((item) => item.probability));
    const yMax = Math.ceil(maxProbability / 10) * 10 || 10;
    const slotWidth = plotWidth / (maxOutcome + 1);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      y: top + plotHeight * (1 - ratio),
      label: `${(yMax * ratio).toFixed(0)}%`,
    }));
    const bars = distribution.map((item) => {
      const barHeight = Math.max(2, Math.min(plotHeight, item.probability / yMax * plotHeight));
      return {
        ...item,
        x: left + item.outcome * slotWidth + Math.max(1, slotWidth * 0.12),
        y: top + plotHeight - barHeight,
        width: Math.max(1, slotWidth * 0.76),
        height: barHeight,
        hitHeight: Math.max(12, barHeight),
      };
    });
    const xTicks = [...new Set([0, Math.round(maxOutcome * 0.25), Math.round(maxOutcome * 0.5), Math.round(maxOutcome * 0.75), maxOutcome])]
      .map((outcome) => ({ outcome, x: left + (outcome + 0.5) * slotWidth }));
    return { width, height, left, top, plotWidth, plotHeight, ticks, bars, xTicks, yMax };
  }, [distribution]);

  return <article className="staff-projection-distribution-card">
    <div className="staff-projection-distribution-heading"><div><p className="staff-eyebrow">{eyebrow}</p><h3>{title}</h3></div><span>{series.length} available</span></div>
    <div className="staff-projection-distribution-controls">
      <label><span>{seriesLabel}</span><select value={selectedSeries?.key ?? ""} onChange={(event) => setSeriesKey(event.target.value)}>{series.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <label><span>Geography</span><select value={selectedScope?.key ?? ""} onChange={(event) => setScopeKey(event.target.value)}>{scopes.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
    </div>
    {snapshot && selectedSeries ? <>
      <div className="staff-projection-distribution-stats"><strong style={{ color: selectedSeries.color }}>{selectedSeries.label}</strong><span>Mean seats <b>{snapshot.expected.toFixed(1)}</b></span><span>SD <b>{snapshot.standardDeviation.toFixed(2)} seats</b></span><span>Baseline <b>{snapshot.baseline}</b></span></div>
      <svg className="staff-projection-distribution-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="group" aria-label={`${selectedSeries.label} seat outcome probabilities for ${selectedScope.label}`}>
        {chart.ticks.map((tick) => <g key={tick.label}><line x1={chart.left} x2={chart.width - 15} y1={tick.y} y2={tick.y} className="staff-projection-distribution-gridline" /><text x={chart.left - 7} y={tick.y + 3} textAnchor="end" className="staff-projection-distribution-axis-label">{tick.label}</text></g>)}
        <line x1={chart.left} x2={chart.width - 15} y1={chart.top + chart.plotHeight} y2={chart.top + chart.plotHeight} className="staff-projection-distribution-axis" />
        {chart.bars.map((bar) => <g
          key={bar.outcome}
          className="staff-projection-distribution-bar"
          tabIndex={0}
          role="img"
          aria-label={`${bar.outcome} seats: ${bar.probability.toFixed(2)}% probability`}
          onMouseEnter={() => setHoveredOutcome(bar.outcome)}
          onMouseLeave={() => setHoveredOutcome(null)}
          onFocus={() => setHoveredOutcome(bar.outcome)}
          onBlur={() => setHoveredOutcome(null)}
        >
          <title>{`${bar.outcome} seats · ${bar.probability.toFixed(2)}% probability`}</title>
          <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="2" fill={selectedSeries.color} opacity=".84" />
          <rect className="staff-projection-distribution-hitarea" x={bar.x} y={chart.top + chart.plotHeight - bar.hitHeight} width={bar.width} height={bar.hitHeight} />
        </g>)}
        {hoveredOutcome !== null && (() => {
          const bar = chart.bars.find((item) => item.outcome === hoveredOutcome);
          if (!bar) return null;
          const tooltipWidth = 124;
          const tooltipX = Math.max(chart.left, Math.min(chart.width - tooltipWidth - 8, bar.x + bar.width / 2 - tooltipWidth / 2));
          const tooltipY = Math.max(1, bar.y - 27);
          return <g className="staff-projection-distribution-tooltip" pointerEvents="none">
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="21" rx="4" />
            <text x={tooltipX + tooltipWidth / 2} y={tooltipY + 14} textAnchor="middle">{bar.outcome} seats · {bar.probability.toFixed(2)}%</text>
          </g>;
        })()}
        {chart.xTicks.map((tick) => <text key={tick.outcome} x={tick.x} y={chart.height - 10} textAnchor="middle" className="staff-projection-distribution-axis-label">{tick.outcome}</text>)}
      </svg>
      <p className="staff-projection-distribution-caption">Probability of each exact seat total across the model simulations. Baseline is the recorded seat count for this geography.</p>
    </> : <p className="staff-projection-help">Run a projection to see its seat outcome distribution.</p>}
  </article>;
}

export default function ProjectionDistributionCharts({
  partySeries,
  communitySeries,
  scopes,
}: {
  partySeries: DistributionSeries[];
  communitySeries: DistributionSeries[];
  scopes: DistributionScope[];
}) {
  return <section className="staff-projection-result-card staff-projection-distributions" aria-label="Seat outcome probability distributions">
    <div className="staff-projection-section-heading"><div><p className="staff-eyebrow">SIMULATION DISTRIBUTIONS</p><h2>Seat outcome probabilities</h2></div><span>Exact totals across every simulation</span></div>
    <div className="staff-projection-distribution-grid">
      <DistributionChart title="Party seat distribution" eyebrow="PARTY VIEW" series={partySeries} scopes={scopes} seriesLabel="Party" />
      <DistributionChart title="Community seat distribution" eyebrow="COMMUNITY VIEW" series={communitySeries} scopes={scopes} seriesLabel="Community" />
    </div>
  </section>;
}
