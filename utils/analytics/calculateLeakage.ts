export function calculateLeakageHistory(
  current: any
) {

  if (!current?.data?.counts) return [];

  const counts = current.data.counts;
  const history: any[] = [];

  Object.keys(counts).forEach((c) => {

    const count = Number(c);

    if (count === 1) {
      history.push({
        count,
        leakage: 0,
        percent: 0
      });
      return;
    }

    const data = counts[count];
    const prev = counts[count - 1];

    if (!data || !prev) return;

    const quota =
      data?.[0]?.quota ||
      prev?.[0]?.quota ||
      0;

    let transferableVotes = 0;
    let totalGain = 0;

    prev.forEach((p: any) => {

      const curr = data.find(
        (d: any) =>
          d.name === p.name &&
          d.party === p.party
      );

      if (!curr) return;

      const diff = curr.votes - p.votes;

      if (diff > 0) {
        totalGain += diff;
      }

      if (p.status === "eliminated") {
        transferableVotes += p.votes;
      }

      if (
        p.status === "elected" &&
        p.votes > quota &&
        curr.votes <= quota
      ) {
        transferableVotes += (
          p.votes - quota
        );
      }

    });

    const leakageVotes = Math.max(
      0,
      transferableVotes - totalGain
    );

    const percent = transferableVotes
      ? (leakageVotes / transferableVotes) * 100
      : 0;

    history.push({
      count,
      leakage: Math.round(leakageVotes),
      percent: Number(percent.toFixed(1))
    });

  });

  return history;

}