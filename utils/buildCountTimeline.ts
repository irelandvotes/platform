export function buildCountTimeline(counts: any) {

  const timeline: any = {};

  const processedSurpluses = new Set<string>();

  const countNumbers =
    Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b);

  for (const count of countNumbers) {

    /*
      FIRST COUNT
    */

    if (count === 1) {

      timeline[count] = {
        type: "initial",
        elected: [],
        sources: [],
        description: "First preference votes counted."
      };

      continue;
    }

    const prev = counts[count - 1] || [];
    const curr = counts[count] || [];

    const quota =
      curr?.[0]?.quota ||
      prev?.[0]?.quota ||
      0;

    /*
      Detect newly elected candidates
    */

    const newlyElected = curr.filter((c: any) => {

      const prevCandidate = prev.find(
        (p: any) =>
          p.name === c.name &&
          p.party === c.party
      );

      return (
        c.status === "elected" &&
        prevCandidate?.status !== "elected"
      );

    });

    /*
      Detect surplus distributor
      (elected candidate losing votes)
    */

    const surplusDistributors = prev
      .map((prevCandidate: any) => {

        const currCandidate = curr.find(
          (c: any) =>
            c.name === prevCandidate.name &&
            c.party === prevCandidate.party
        );

        if (!currCandidate) {
          return null;
        }

        /*
          Must already be elected
        */

        if (prevCandidate.status !== "elected") {
          return null;
        }

        /*
          Must be above quota
        */

        if (prevCandidate.votes <= quota) {
          return null;
        }

        /*
          Must lose votes this count
        */

        const voteLoss =
          prevCandidate.votes - currCandidate.votes;

        if (voteLoss <= 0) {
          return null;
        }

        return {
          id: prevCandidate.id,
          name: prevCandidate.name,
          party: prevCandidate.party,
          surplus: prevCandidate.votes - quota,
          distributed: voteLoss
        };

      })
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          b.distributed - a.distributed
      );

    /*
      Detect newly eliminated candidates
    */

    const eliminated = prev.filter((c: any) => {

      const currCandidate = curr.find(
        (p: any) =>
          p.name === c.name &&
          p.party === c.party
      );

      return (
        c.status !== "eliminated" &&
        currCandidate?.status === "eliminated"
      );

    });

    /*
      Detect redistribution of previously
      eliminated candidates
    */

    const redistributedEliminations = prev.filter((c: any) => {

      /*
        Candidate was already eliminated
      */

      if (c.status !== "eliminated") {
        return false;
      }

      const currCandidate = curr.find(
        (p: any) =>
          p.name === c.name &&
          p.party === c.party
      );

      if (!currCandidate) {
        return false;
      }

      /*
        Vote total must now fall
      */

      return currCandidate.votes < c.votes;

    });

    /*
      Active surplus distributor
    */

    const activeSurplus = surplusDistributors
      .filter((s: any) => s.distributed > 0)
      .sort(
        (a: any, b: any) =>
          b.distributed - a.distributed
      )[0];

    /*
      Build narration parts
    */

    const descriptionParts: string[] = [];

    /*
      Elections
    */

    if (newlyElected.length) {

      descriptionParts.push(
        `${newlyElected
          .map((c:any) => c.name)
          .join(", ")} elected`
      );

    }

    /*
      Surplus redistribution
    */

    if (activeSurplus) {

      descriptionParts.push(
        `Distribution of the surplus of ${activeSurplus.name}`
      );

    }

    /*
      Newly eliminated candidates
    */

    if (eliminated.length) {

      descriptionParts.push(
        `${eliminated
          .map((c:any) => c.name)
          .join(", ")} eliminated`
      );

    }

    /*
      Redistribution of eliminated votes
    */

    if (redistributedEliminations.length) {

      descriptionParts.push(
        `Redistribution of the votes of ${redistributedEliminations
          .map((c:any) => c.name)
          .join(", ")}`
      );

    }

    /*
      Determine primary count type
    */

    let type = "unknown";

    if (activeSurplus) {
      type = "surplus";
    }
    else if (redistributedEliminations.length) {
      type = "elimination";
    }
    else if (eliminated.length) {
      type = "elimination";
    }
    else if (newlyElected.length) {
      type = "election";
    }

    /*
      Final timeline object
    */

    timeline[count] = {
      type,

      elected: newlyElected,

      sources: [

        ...(activeSurplus
          ? [{
              ...activeSurplus,
              sourceType: "surplus"
            }]
          : []),

        ...redistributedEliminations.map((e: any) => ({
          ...e,
          sourceType: "elimination-redistribution"
        })),

        ...eliminated.map((e: any) => ({
          ...e,
          sourceType: "elimination"
        }))

      ],

      description:
        descriptionParts.length
          ? descriptionParts.join(". ") + "."
          : "Count completed."

    };

  }

  return timeline;

}