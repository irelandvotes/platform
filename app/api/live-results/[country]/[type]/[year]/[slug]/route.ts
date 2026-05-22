export const dynamic = "force-dynamic";

export const runtime = "nodejs";

import { liveSheetMap } from "@/lib/liveSheetMap";
import Papa from "papaparse";

/* =============================
   CSV Loader
============================= */

async function loadCSV(url?: string) {

    if (!url) {
        throw new Error(
            "Missing CSV URL"
        );
    }

    const res = await fetch(url, {
        cache: "no-store"
    });

    if (!res.ok) {
        throw new Error(
            `Failed to fetch: ${url}`
        );
    }

    return await res.text();

}

/* =============================
   CSV Parser
============================= */

function parseResults(csv: string) {

    const parsed =
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true
        }).data;

    const grouped: any = {};

    parsed.forEach((row: any) => {

        const constituency =
            row.constituency?.trim();

        const count =
            Number(row.count);

        if (!constituency) return;

        if (!grouped[constituency]) {

            grouped[constituency] = {
                counts: {}
            };

        }

        if (
            !grouped[
                constituency
            ].counts[count]
        ) {

            grouped[
                constituency
            ].counts[count] = [];

        }

grouped[
   constituency
].counts[count].push({

   id:
      `${row.candidate}-${row.party}-${count}`,

   imageId:
      `${row.candidate_id}-${row.party}`,

   name:
      row.candidate,

   candidate:
      row.candidate,

   candidate_id:
      row.candidate_id,

   incumbent:
      row.incumbent === "TRUE",

   party:
      row.party,

   votes:
      Number(row.votes) || 0,

   status:
      row.status?.toLowerCase() || "running",

   seats:
      Number(row.seats) || 0,

   quota:
      Number(row.quota) || 0,

   electorate:
      Number(row.electorate) || 0,

   turnout:
      Number(row.turnout) || 0,

   tvp:
      Number(row.tvp) || 0,

   spoilt:
      Number(row.spoilt) || 0

});

grouped[
   constituency
].seats =
   Number(row.seats) || 0;

grouped[
   constituency
].quota =
   Number(row.quota) || 0;

grouped[
   constituency
].turnout =
   Number(row.turnout) || 0;

grouped[
   constituency
].tvp =
   Number(row.tvp) || 0;

grouped[
   constituency
].spoilt =
   Number(row.spoilt) || 0;

grouped[
   constituency
].electorate =
   Number(row.electorate) || 0;

    });

    return grouped;

}

/* =============================
   SSE Route
============================= */

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      country: string;
      type: string;
      year: string;
      slug: string;
    }>
  }
) {

  const params =
    await context.params;

const key =
`${params.country}-${params.type}-${params.year}-${params.slug}`;

  const config =
    liveSheetMap[key];

  if (!config) {

    return Response.json(
      {
        error:
          `No config for ${key}`
      },
      {
        status:404
      }
    );

  }

  const tallyURL =
    config.tally;

  const officialURL =
    config.official;

    const stream =
        new ReadableStream({

        async start(controller) {

            let previous = "";

            async function push() {

                try {

                    if (!tallyURL) {

                        return;

                    }

                    const electionCSV =
                        await loadCSV(
                            tallyURL
                        );

                    let official = {};

                    if (
                        officialURL
                    ) {

                        try {

                            const countCSV =
                                await loadCSV(
                                    officialURL
                                );

                            official =
                                parseResults(
                                    countCSV
                                );

                        }

                        catch {

                        }

                    }

                    const tally =
                        parseResults(
                            electionCSV
                        );

                    const payload =
                        JSON.stringify({

                            results:
                                tally,

                            officialResults:
                                official,

                            updated:
                                Date.now()

                        });

                    if (
                        payload !== previous
                    ) {

try {

   controller.enqueue(
      `data:${payload}\n\n`
   );

} catch {

   clearInterval(interval);

}

                        previous =
                            payload;

                    }

                }

                catch (err) {

                }

            }

const interval =
    setInterval(
        push,
        10000
    );

await push();

const cleanup = () => {

   clearInterval(interval);

   try {

      controller.close();

   } catch {}

};

request.signal.addEventListener(
   "abort",
   cleanup
);

        }

    });

    return new Response(
        stream,
        {
            headers: {

                "Content-Type":
                    "text/event-stream",

                "Cache-Control":
                    "no-cache",

                Connection:
                    "keep-alive"

            }
        }
    );

}