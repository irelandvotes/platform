export function buildTransferMatrix(
  transferData: any
) {

  if (!transferData) return null;

  const matrix: Record<string, number> = {};

  transferData.transfers.forEach((t: any) => {

    if (!matrix[t.party]) {
      matrix[t.party] = 0;
    }

    matrix[t.party] += t.gain;

  });

  const total = Object.values(matrix)
    .reduce((a, b) => a + b, 0);

  return Object.entries(matrix)
    .map(([party, votes]: [string, any]) => ({
      party,
      votes,
      percent: total
        ? ((votes / total) * 100).toFixed(1)
        : 0
    }))
    .sort((a, b) => b.votes - a.votes);

}