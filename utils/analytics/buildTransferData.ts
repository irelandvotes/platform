export function buildTransferData({
  current,
  count,
  countTimeline
}: any) {

  if (!current?.data?.counts || count <= 1) {
    return null;
  }

  const counts = current.data.counts;

  const currentData = counts[count] || [];
  const prevData = counts[count - 1] || [];

  const quota =
    currentData?.[0]?.quota ||
    prevData?.[0]?.quota ||
    0;

  const event =
    countTimeline?.[count];

  const transfers: any[] = [];

  currentData.forEach((c: any) => {

    const prev = prevData.find(
      (p: any) =>
        p.name === c.name &&
        p.party === c.party
    );

    const gain = prev
      ? c.votes - prev.votes
      : 0;

    if (gain > 0) {

      transfers.push({
        name: c.name,
        party: c.party,
        gain
      });

    }

  });

  return {
    quota,
    event,
    sources: event?.sources || [],
    transfers: transfers.sort(
      (a, b) => b.gain - a.gain
    )
  };

}