# Assembly broadcast prototype

Open `/broadcast/elections/northern-ireland/assembly/2022` locally.

## Simulation desk

Choose a Reporting constituency and press Release count N. Each click publishes
exactly one complete count for that constituency. Counts must be released in
order; switching constituencies retains their individual progress. Play broadcast
runs the graphic/alert queue without releasing further results. Releasing a count
starts playback automatically. Complete mode
loads all final results without a backlog of announcements; Reset clears results.

The data contains 146 constituency count snapshots. Historical arrival timestamps
are unavailable. Incoming counts use `receiveUpdate` in `lib/broadcast/engine.ts`;
a future live adapter can use the same boundary. It ignores duplicate/stale
snapshots and detects elected candidates and completion. Every count is retained
in arrival order. Its main-screen coverage finishes before its seat-win alerts,
with a national overview before moving on to the next count.

National vote-share and seat comparisons use only reporting constituencies from
2017. Vote shares use matched first-preference totals. Seat changes compare seats
won so far in reporting constituencies with their 2017 final seats, and remain
provisional until counting finishes. Missing comparisons display an em dash.

## Presentation

The fixed 1920 × 1080 canvas scales to fit the preview. Fullscreen output shows
only the programme; Escape returns to the desk. H hides/shows controls. The
results bar has its own pause control independent of graphic playback.

Open output window moves the programme into a separate window while this tab
retains the control desk. Results and count-page timing remain owned by the desk.
The opening click requests fullscreen; browsers that reject it show an Enter
fullscreen button in the output window. Escape restores that button. Closing the
output window returns the programme to the desk preview. Keep the desk open while
using the output window. Output windows inherit the current styles and fonts.

The constituency strip cycles alphabetically: party first preferences, first-count
candidates, elected candidates so far, then continuing candidates at the latest
count. Up to six tiles appear per page. Parties below 5% are grouped as Other,
always last. Party pages show shares plus votes for four seconds, then shares plus
changes for eight seconds before advancing. Candidate pages last eight seconds;
elected latest-count summaries omit votes. Incumbents come from the CSV flag.

The national bar cycles shares, share changes, seats, and seat changes every four
seconds. Election alerts take over this slot with a red sting and animated tick.
The floating lower-third area reserves space so main graphics remain clear.
Reduced-motion preferences suppress decorative motion. The right panel contains
the logo, current Europe/Dublin time and rotating captions.

State lives in the current tab. This prototype does not connect to a live source,
persist announced wins, handle count corrections, or synchronise multiple tabs.

## Main-screen count sequence

`CountCoverage.tsx` opens each count with a 2.4-second constituency title wipe.
Count one then shows party first preferences for six seconds. Candidate pages of
up to eight entries follow for seven seconds each. Subsequent counts skip party
totals and show vote differences against the previous snapshot captured in the
count story. Elected candidates with a zero retained tally show Elected instead
of zero votes. All queued counts retain their original snapshots and deltas.

`ConstituencyMap.jsx` loads local constituency boundaries, highlights the current
constituency and flies from the Northern Ireland overview to its bounds after
the title. It requests no external tiles. Missing map data has a fallback label,
and reduced-motion preferences disable map flight and decorative title motion.

The results panel uses translucent glass and a mild backdrop blur. Map display
geometry is simplified at a subpixel tolerance before rendering; source GeoJSON
is untouched. After a 650ms locator ring, a 1.2-second camera interpolation uses
public Leaflet setView calls with animation disabled to reproject vector paths
at each frame instead of stretching a cached drawing. The map component is
memoized so candidate-page changes do not rebuild it. Verify this rendering and
lifecycle logic with `node scripts/test-broadcast-map-lifecycle.mjs`.

Verify with `node scripts/test-broadcast-replay.mjs`.
