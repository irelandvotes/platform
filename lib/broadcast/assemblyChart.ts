import type { BroadcastState, CountUpdate } from "./engine";

type Point = { x: number; y: number };
export type AssemblySeat = Point & { id: number; party: string | null; progress: number };

export const ASSEMBLY_BLOCS = {
  NAT: { name: "Nationalist", color: "#31a87c" },
  NON: { name: "Non-aligned", color: "#e5bf20" },
  UNI: { name: "Unionist", color: "#3676c0" },
};
// Assembly designation, distinct from the projection model's political blocs.
// 2022 Roll: PBP's Gerry Carroll designated Other, alongside Alliance.
export function assemblyBlocForParty(code: string): keyof typeof ASSEMBLY_BLOCS {
  if (["SF", "SDLP", "AON", "INDN", "PD", "WP"].includes(code)) return "NAT";
  if (["DUP", "UUP", "TUV", "INDU", "PUP", "CON", "UKIP"].includes(code)) return "UNI";
  return "NON";
}

export function noOverallCommunityControl(seats: AssemblySeat[]) {
  const totals = { NAT: 0, NON: 0, UNI: 0 };
  let unfilled = 0;
  for (const seat of seats) {
    if (!seat.party) unfilled++;
    else totals[assemblyBlocForParty(seat.party)]++;
  }
  return Object.values(totals).every(count => count + unfilled < 46);
}

export function communityResults(data: BroadcastState, constituency?: string, baseline?: CountUpdate[] | null) {
  const names = constituency ? [constituency].filter(name => data.first[name]) : Object.keys(data.first);
  const rows = (["NAT", "NON", "UNI"] as const).map(code => ({ code, ...ASSEMBLY_BLOCS[code], votes: 0, share: 0, seats: 0 }));
  for (const name of names) {
    for (const candidate of data.first[name].candidates) rows.find(row => row.code === assemblyBlocForParty(candidate.party))!.votes += candidate.votes;
    for (const candidate of data.latest[name]?.candidates ?? []) if (candidate.status === "elected") rows.find(row => row.code === assemblyBlocForParty(candidate.party))!.seats++;
  }
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  const previous = { NAT: 0, NON: 0, UNI: 0 };
  const matched = new Set<string>();
  for (const count of baseline ?? []) {
    if (count.count !== 1 || !names.includes(count.constituency) || matched.has(count.constituency)) continue;
    matched.add(count.constituency);
    for (const candidate of count.candidates) previous[assemblyBlocForParty(candidate.party)] += candidate.votes;
  }
  const previousTotal = Object.values(previous).reduce((sum, votes) => sum + votes, 0);
  return rows.map(row => {
    const share = total ? row.votes / total * 100 : 0;
    return { ...row, share, change: total && previousTotal && matched.size === names.length ? share - previous[row.code] / previousTotal * 100 : undefined };
  });
}

// Camera looking across the chamber floor, rather than down onto a flat plan.
export function projectAssemblyPoint(point: Point, height = 0): Point {
  const cameraDistance = Math.hypot(1100, 800);
  const forward = 1100 / cameraDistance, elevation = 800 / cameraDistance;
  const depth = 330 - point.y;
  const distance = cameraDistance + forward * depth - elevation * height;
  const scale = 1740 / distance;
  return { x: 440 + (point.x - 440) * scale, y: 350 - (elevation * depth + forward * height) * scale };
}

export function assemblySeatFaces(seat: Point) {
  const corners = [{ x: seat.x - 20, y: seat.y - 20 }, { x: seat.x + 20, y: seat.y - 20 }, { x: seat.x + 20, y: seat.y + 20 }, { x: seat.x - 20, y: seat.y + 20 }];
  const base = corners.map(point => projectAssemblyPoint(point));
  const top = corners.map(point => projectAssemblyPoint(point, 22));
  const path = (points: Point[]) => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join("") + "Z";
  return {
    top: path(top),
    front: path([top[3], top[2], base[2], base[3]]),
    side: seat.x < 440 ? path([top[1], top[2], base[2], base[1]]) : path([top[0], top[3], base[3], base[0]]),
    shadow: path(corners.map(point => projectAssemblyPoint({ x: point.x + 7, y: point.y + 9 }))),
  };
}

export function assemblyPartyCallouts(seats: AssemblySeat[]) {
  const groups = new Map<string, AssemblySeat[]>();
  for (const seat of seats) {
    const code = seat.party ?? "PENDING";
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code)!.push(seat);
  }
  const labels = [...groups.entries()].map(([code, members]) => {
    const points = members.map(seat => projectAssemblyPoint(seat, 22));
    const center = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
    const target = points.reduce((best, point) => Math.hypot(point.x - center.x, point.y - center.y) < Math.hypot(best.x - center.x, best.y - center.y) ? point : best);
    return { code, count: members.length, target, centerX: center.x, centerY: center.y, side: center.x < 440 ? "left" : "right", x: 0, y: 0, reveal: 0 };
  });
  const rowCount = Math.max(labels.filter(label => label.side === "left").length, labels.filter(label => label.side === "right").length);
  const levels = Array.from({ length: rowCount }, (_, index) => 360 + (index - (rowCount - 1) / 2) * 74);
  for (const side of ["left", "right"]) {
    const column = labels.filter(label => label.side === side).sort((a, b) => a.centerY - b.centerY);
    // Both columns share mirrored row levels. Choose the nearest available levels
    // to each group's projected centre without swapping groups or overlapping boxes.
    let best: number[] = [], bestCost = Infinity;
    function choose(indices: number[], start: number, cost: number) {
      if (indices.length === column.length) { if (cost < bestCost) { best = [...indices]; bestCost = cost; } return; }
      for (let row = start; row <= levels.length - (column.length - indices.length); row++) {
        choose([...indices, row], row + 1, cost + (levels[row] - column[indices.length].centerY) ** 2);
      }
    }
    choose([], 0, 0);
    column.forEach((label, index) => { label.x = side === "left" ? -280 : 1000; label.y = levels[best[index]] - 30; });
  }
  labels.sort((a, b) => a.centerX - b.centerX || a.target.y - b.target.y || a.code.localeCompare(b.code));
  labels.forEach((label, index) => { label.reveal = .8 + index * 1.05; });
  return labels;
}

export function assemblyPartyOutlines(seats: AssemblySeat[]) {
  const codes = [...new Set(seats.flatMap(seat => seat.party ? [seat.party] : []))];
  return codes.map(code => {
    const points = seats.filter(seat => seat.party === code).flatMap(seat => [-22, 22].flatMap(dx => [-22, 22].map(dy => projectAssemblyPoint({ x: seat.x + dx, y: seat.y + dy }, 23)))).sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const half = (ordered: Point[]) => {
      const hull: Point[] = [];
      for (const point of ordered) { while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop(); hull.push(point); }
      return hull.slice(0, -1);
    };
    const hull = [...half(points), ...half([...points].reverse())];
    const center = { x: hull.reduce((sum, p) => sum + p.x, 0) / hull.length, y: hull.reduce((sum, p) => sum + p.y, 0) / hull.length };
    const path = hull.map((point, index) => {
      const dx = point.x - center.x, dy = point.y - center.y, length = Math.hypot(dx, dy) || 1;
      return `${index ? "L" : "M"}${(point.x + dx / length * 5).toFixed(2)} ${(point.y + dy / length * 5).toFixed(2)}`;
    }).join("") + "Z";
    return { code, path };
  });
}

// Four rounded horseshoe tracks, following the assembly composition graphic.
export function assemblySeatLayout(data: BroadcastState): AssemblySeat[] {
  const tracks = Array.from({ length: 4 }, (_, row) => {
    const left = 85 + row * 61, right = 795 - row * 61;
    const top = 55 + row * 61, bottom = 615, corner = 100 - row * 16;
    const points: Point[] = [{ x: left, y: bottom }, { x: left, y: top + corner }];
    for (let i = 0; i <= 18; i++) { const angle = Math.PI + Math.PI / 2 * i / 18; points.push({ x: left + corner + corner * Math.cos(angle), y: top + corner + corner * Math.sin(angle) }); }
    points.push({ x: right - corner, y: top });
    for (let i = 0; i <= 18; i++) { const angle = -Math.PI / 2 + Math.PI / 2 * i / 18; points.push({ x: right - corner + corner * Math.cos(angle), y: top + corner + corner * Math.sin(angle) }); }
    points.push({ x: right, y: bottom });
    const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
    return { points, lengths, length: lengths.reduce((sum, n) => sum + n, 0) };
  });
  const totalLength = tracks.reduce((sum, track) => sum + track.length, 0);
  const allocations = tracks.map(track => Math.floor(track.length / totalLength * 90));
  const remainder = 90 - allocations.reduce((sum, n) => sum + n, 0);
  const order = tracks.map((track, index) => ({ index, remainder: track.length / totalLength * 90 - allocations[index] })).sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remainder; i++) allocations[order[i].index]++;
  const positions = tracks.flatMap((track, row) => Array.from({ length: allocations[row] }, (_, index) => {
    const progress = (index + .5) / allocations[row];
    let distance = progress * track.length, segment = 0;
    while (segment < track.lengths.length - 1 && distance > track.lengths[segment]) distance -= track.lengths[segment++];
    const start = track.points[segment], end = track.points[segment + 1];
    const ratio = distance / track.lengths[segment];
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio, progress, row };
  })).sort((a, b) => a.progress - b.progress || a.row - b.row);
  const preferred = ["SF", "SDLP", "PBP", "GP", "AP", "TUV", "UUP", "DUP", "INDU", "IND"];
  const elected = Object.values(data.latest).flatMap(update => update.candidates.filter(candidate => candidate.status === "elected")).sort((a, b) => {
    const rank = (code: string) => { const index = preferred.indexOf(code); return index === -1 ? preferred.length : index; };
    return rank(a.party) - rank(b.party) || a.party.localeCompare(b.party);
  });
  return positions.map((position, id) => ({ ...position, id, party: elected[id]?.party ?? null }));
}
