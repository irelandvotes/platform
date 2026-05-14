export function buildAdvancedMetrics({
  current,
  count,
  countTimeline
}: any) {

  const counts = current?.data?.counts;
  const data = counts?.[count];
  const firstCount = counts?.[1];

  if (!data || !firstCount) return [];

  const quota = data?.[0]?.quota || 0;

  const candidates = data.map((c: any) => {

    const first = firstCount.find(
      (p: any) =>
        p.name === c.name &&
        p.party === c.party
    );

    const firstVotes = first?.votes || 0;
    const gain = c.votes - firstVotes;

    let totalGain = 0;
    let gainCounts = 0;
    let transferCounts = 0;

    let transferablePool = 0;
    let capturedTransfers = 0;
    let lateGain = 0;

    Object.keys(counts).forEach((k) => {

      const n = Number(k);

      if (n <= 1 || n > count) return;

      const prev = counts[n - 1];
      const curr = counts[n];

      const prevCandidate = prev?.find(
        (p: any) =>
          p.name === c.name &&
          p.party === c.party
      );

      const currCandidate = curr?.find(
        (p: any) =>
          p.name === c.name &&
          p.party === c.party
      );

      if (!prevCandidate || !currCandidate) {
        return;
      }

      const diff =
        currCandidate.votes -
        prevCandidate.votes;

      transferCounts++;

   if (diff > 0) {

  gainCounts++;
  totalGain += diff;

  capturedTransfers += diff;

  if (
    n > Math.floor(count / 2)
  ) {
    lateGain += diff;
  }

}

      prev.forEach((p: any) => {

        const timelineEvent =
          countTimeline?.[n];

        const transferring =
          timelineEvent?.sources?.some?.(
            (s: any) =>
              s.name === p.name &&
              s.party === p.party
          );

        if (!transferring) return;

transferablePool += (
  p.surplus ||
  p.votes ||
  0
);

      });

    });

const transferCaptureRate =
  transferablePool
    ? (
        capturedTransfers /
        transferablePool
      ) * 100
    : 0;

const transferDependency =
  c.votes
    ? (
        totalGain /
        c.votes
      ) * 100
    : 0;

    return {

      ...c,

      firstVotes,
      gain,

      quotaDistance:
        c.votes - quota,

        transferCaptureRate,
        transferDependency,
        lateGain,
        totalGain
        
    };

  });

return candidates
  .map((c: any) => {

    let archetype = "Balanced";

    if (
      c.firstVotes / c.votes > 0.85
    ) {
      archetype =
        "First Preference Fortress";
    }

    else if (
      c.transferCaptureRate > 25
    ) {
      archetype =
        "Transfer Magnet";
    }

    else if (
      c.lateGain >
      c.totalGain * 0.6
    ) {
      archetype =
        "Late Surge";
    }

    else if (
      c.transferDependency > 50
    ) {
      archetype =
        "Transfer Dependent";
    }

    return {

      ...c,

      transferCaptureRate:
        c.transferCaptureRate,

      transferDependency:
        c.transferDependency,

      lateGain:
        c.lateGain,

      totalGain:
        c.totalGain,

      archetype

    };

  })
    .sort(
      (a: any, b: any) =>
        b.votes - a.votes
    );

}