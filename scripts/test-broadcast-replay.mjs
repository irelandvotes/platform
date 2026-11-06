import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import Papa from "papaparse";

const source = fs.readFileSync("lib/broadcast/engine.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } });
const sandbox = { exports: {} };
vm.runInNewContext(compiled.outputText, sandbox);
const { createReplay, initialState, receiveUpdate, rollingResults, nationalSummary, nextConstituencyCount, candidateVoteChanges, coverageDuration, candidateField } = sandbox.exports;
const csv = fs.readFileSync("public/data/elections/northern-ireland/assembly/2022/election_data.csv", "utf8");
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
assert.equal(parsed.errors.length, 0);
const updates = createReplay(parsed.data);
const field = candidateField(updates);
assert.equal(field.length, 239, "Candidate metadata counts unique first-count entries only");
assert.equal(field.filter(candidate => candidate.party === "UUP").length, 27);
assert.equal(new Set(field.filter(candidate => candidate.party === "UUP").map(candidate => candidate.constituency)).size, 18);
assert.equal(candidateField([...updates, ...updates]).length, 239, "Repeated counts cannot duplicate candidates");
let state = initialState();
assert.equal(Object.keys(state.latest).length, 0, "No future results visible at startup");
const wins = new Set();
for (const update of updates) {
  const previous = state.latest[update.constituency];
  assert.equal(update.count, previous ? previous.count + 1 : 1, "Counts arrive in constituency order");
  state = receiveUpdate(state, update);
  assert.strictEqual(receiveUpdate(state, update), state, "Repeated updates cannot generate stories");
  for (const story of state.queue.filter(item => item.update.id === update.id && item.kind === "seat")) {
    const key = `${update.constituency}:${story.candidate.id}`;
    assert.ok(!wins.has(key), `Duplicate seat announcement: ${key}`);
    wins.add(key);
  }
  assert.ok(Object.values(state.latest).flatMap(item => item.candidates.filter(c => c.status === "elected")).length <= 90);
}
assert.equal(updates.length, 146);
assert.equal(Object.keys(state.latest).length, 18);
assert.equal(Object.keys(state.first).length, 18);
assert.equal(wins.size, 90);
const elected = Object.values(state.latest).flatMap(update => update.candidates.filter(c => c.status === "elected"));
const totals = Object.fromEntries([...new Set(elected.map(c => c.party))].map(code => [code, elected.filter(c => c.party === code).length]));
assert.deepEqual(totals, { AP: 17, DUP: 25, UUP: 9, SF: 27, SDLP: 8, PBP: 1, TUV: 1, INDU: 2 });
assert.equal(state.queue.filter(story => story.kind === "complete").length, 18);
assert.equal(state.queue.filter(story => story.kind === "count").length, 146, "Every published count gets main-screen coverage");
assert.equal(state.queue[0].kind, "count", "Count coverage precedes its election alerts");
for (const update of updates) {
  const countIndex = state.queue.findIndex(story => story.kind === "count" && story.update.id === update.id);
  assert.ok(state.queue.filter(story => story.kind === "seat" && story.update.id === update.id).every(story => state.queue.indexOf(story) > countIndex));
  const story = state.queue[countIndex];
  if (update.count > 1) {
    assert.equal(story.previous.count, update.count - 1);
    for (const row of candidateVoteChanges(update, story.previous)) {
      const old = story.previous.candidates.find(c => c.id === row.id);
      assert.equal(row.change, old ? row.votes - old.votes : undefined);
    }
  } else assert.ok(candidateVoteChanges(update).every(row => row.change === undefined));
  assert.equal(coverageDuration(update), 2400 + (update.count === 1 ? 12000 : 0) + Math.ceil(update.candidates.length / 6) * 7000);
}
assert.strictEqual(receiveUpdate(state, updates[0]), state, "Stale updates are ignored");
console.log(`Broadcast replay passed: ${updates.length} counts, 18 completed constituencies, 90 unique seat announcements, correct party totals.`);
const baselineCsv = fs.readFileSync("public/data/elections/northern-ireland/assembly/2017/election_data.csv", "utf8");
const baseline = Object.fromEntries(createReplay(Papa.parse(baselineCsv, { header: true, skipEmptyLines: true }).data).filter(update => update.count === 1).map(update => [update.constituency, update]));
const roll = rollingResults(state, baseline);
const naomi = roll.find(entry => entry.phase === "FIRST COUNT" && entry.name === "Naomi Long");
assert.equal(naomi.incumbent, true, "Incumbent flags reach candidate tiles");
assert.equal(roll.find(entry => entry.phase === "FIRST COUNT" && entry.name === "David Brooks").incumbent, false, "New candidates are not labelled incumbents");
assert.equal(rollingResults(initialState(), baseline).length, 0, "Unreleased counts never appear in the roll");
const constituencyOrder = [...new Set(roll.map(entry => entry.constituency))];
assert.deepEqual(constituencyOrder, [...constituencyOrder].sort((a, b) => a.localeCompare(b, "en-GB")));
for (const name of constituencyOrder) {
  const entries = roll.filter(entry => entry.constituency === name);
  const parties = entries.filter(entry => entry.phase === "PARTY FIRST PREFERENCES");
  const otherIndex = parties.findIndex(entry => entry.name === "Other");
  assert.ok(otherIndex === -1 || otherIndex === parties.length - 1, "Other always appears after named parties");
  assert.equal(parties.reduce((sum, entry) => sum + entry.votes, 0), state.first[name].candidates.reduce((sum, c) => sum + c.votes, 0));
  assert.ok(Math.abs(parties.reduce((sum, entry) => sum + entry.share, 0) - 100) < .0001);
  assert.ok(Math.abs(parties.reduce((sum, entry) => sum + entry.change, 0)) < .0001, "Grouped changes use matching parties in both years");
  const firstIndex = entries.findIndex(entry => entry.phase === "FIRST COUNT");
  const latestIndex = entries.findIndex(entry => entry.phase.startsWith("LATEST COUNT"));
  assert.ok(firstIndex > 0 && latestIndex > firstIndex);
  assert.equal(entries.filter(entry => entry.phase.startsWith("LATEST COUNT") && entry.elected).length, 5);
  assert.equal(entries.filter(entry => entry.phase.startsWith("LATEST COUNT")).length, state.latest[name].candidates.filter(candidate => candidate.status !== "eliminated").length, "Latest count excludes eliminated candidates");
  assert.equal(entries.filter(entry => entry.phase === "FIRST COUNT").length, state.first[name].candidates.length, "First count retains every candidate");
  assert.ok(entries.filter(entry => entry.phase.startsWith("LATEST COUNT") && entry.elected).every(entry => entry.hideVotes), "Elected latest-count tiles hide vote totals");
}
const partial = updates.reduce((data, update) => update.count <= 3 ? receiveUpdate(data, update) : data, initialState());
const partialRoll = rollingResults(partial, baseline);
for (const name of Object.keys(partial.latest)) {
  const latest = partialRoll.filter(entry => entry.constituency === name && entry.phase.startsWith("LATEST COUNT"));
  const firstContinuing = latest.findIndex(entry => !entry.elected);
  if (firstContinuing >= 0) assert.ok(latest.slice(firstContinuing).every(entry => !entry.elected && !entry.hideVotes), "Elected summary precedes continuing candidates and their votes");
}
console.log("Rolling results passed: alphabetical order, grouped vote/share totals, 2017 changes, phase order and elected markers.");
const baselineUpdates = createReplay(Papa.parse(baselineCsv, { header: true, skipEmptyLines: true }).data);
let controlled = initialState();
for (const name of ["Belfast North", "East Derry"]) {
  const next = nextConstituencyCount(updates, controlled, name);
  assert.equal(next.count, 1);
  controlled = receiveUpdate(controlled, next);
}
assert.equal(controlled.seen.length, 2, "Two manual releases publish exactly two constituency counts");
assert.equal(nextConstituencyCount(updates, controlled, "Belfast North").count, 2);
assert.equal(nextConstituencyCount(updates, controlled, "Belfast East").count, 1, "Unselected constituencies remain unreported");
const matched = nationalSummary(controlled, baselineUpdates);
const allowed = ["Belfast North", "East Derry"];
assert.equal(matched.reporting.length, 2);
assert.equal(matched.oldTotal, baselineUpdates.filter(update => allowed.includes(update.constituency) && update.count === 1).flatMap(update => update.candidates).reduce((sum, c) => sum + c.votes, 0));
assert.equal(Object.values(matched.oldSeats).reduce((sum, n) => sum + n, 0), 10, "Seat comparison includes only the two reporting constituencies");
const withoutUnreported = nationalSummary(controlled, baselineUpdates.filter(update => allowed.includes(update.constituency)));
assert.deepEqual(matched.oldSeats, withoutUnreported.oldSeats);
assert.deepEqual(matched.oldVotes, withoutUnreported.oldVotes);
const finalSummary = nationalSummary(state, baselineUpdates);
assert.equal(Object.values(finalSummary.oldSeats).reduce((sum, n) => sum + n, 0), 90);
assert.equal(nextConstituencyCount(updates, state, "Belfast North"), undefined);
console.log("Controlled simulation passed: single-count releases and matched-constituency vote/seat comparisons.");
const makeCandidate = (id, party, status) => ({ id, name: id, party, status, votes: 0 });
const historic = { id: "Test:old", constituency: "Test", count: 9, seats: 5, quota: 1, candidates: [makeCandidate("old1", "DUP", "elected"), makeCandidate("old2", "DUP", "elected"), makeCandidate("old3", "SF", "elected"), makeCandidate("old4", "SF", "elected"), makeCandidate("old5", "AP", "elected")] };
const count = { ...historic, id: "Test:1", count: 1, candidates: [makeCandidate("d1", "DUP", "elected"), makeCandidate("d2", "DUP", "running"), makeCandidate("s1", "SF", "running"), makeCandidate("s2", "SF", "running"), makeCandidate("a1", "AP", "elected"), makeCandidate("a2", "AP", "elected")] };
const early = receiveUpdate(initialState(), count);
const earlySummary = nationalSummary(early, [historic]);
assert.equal(earlySummary.seatChanges.DUP, 0, "A seat still in contention is not a confirmed loss");
assert.equal(earlySummary.seatChangePending.DUP, true);
assert.equal(earlySummary.seatChanges.AP, 1, "An extra elected candidate confirms a gain immediately");
const eliminated = receiveUpdate(early, { ...count, id: "Test:2", count: 2, candidates: count.candidates.map(c => c.id === "d2" ? { ...c, status: "eliminated" } : c) });
assert.equal(nationalSummary(eliminated, [historic]).seatChanges.DUP, -1, "Elimination of the last possible retaining candidate confirms a loss");
for (const code of Object.keys(finalSummary.oldSeats)) assert.equal(finalSummary.seatChanges[code], (finalSummary.seats[code] ?? 0) - finalSummary.oldSeats[code], "Completed counts show final net seat changes");
console.log("Confirmed seat changes passed: unresolved seats, guaranteed gains, elimination-confirmed losses and final totals.");
const chartSource = fs.readFileSync("lib/broadcast/assemblyChart.ts", "utf8");
const chartModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(chartSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, chartModule);
const { assemblySeatLayout, projectAssemblyPoint, assemblySeatFaces, assemblyPartyCallouts, assemblyBlocForParty, noOverallCommunityControl, communityResults, ASSEMBLY_BLOCS } = chartModule.exports;
const emptyChamber = assemblySeatLayout(initialState());
assert.equal(emptyChamber.length, 90);
assert.ok(emptyChamber.every(seat => seat.party === null));
const finalChamber = assemblySeatLayout(state);
assert.equal(new Set(finalChamber.map(seat => `${seat.x}:${seat.y}`)).size, 90, "Every chamber seat has a distinct location");
assert.ok(finalChamber.every(seat => Number.isFinite(seat.x) && Number.isFinite(seat.y) && seat.x > 0 && seat.x < 880 && seat.y > 0 && seat.y < 660));
for (const [code, count] of Object.entries(totals)) assert.equal(finalChamber.filter(seat => seat.party === code).length, count);
const partialChamber = assemblySeatLayout(controlled);
assert.equal(partialChamber.filter(seat => seat.party !== null).length, matched.elected, "Unreported wins never fill the chamber");
assert.equal(partialChamber.filter(seat => seat.party === null).length, 90 - matched.elected);
const projectedWidth = y => projectAssemblyPoint({ x: 460, y }).x - projectAssemblyPoint({ x: 420, y }).x;
assert.ok(projectedWidth(600) > projectedWidth(100), "Near seats appear larger than distant seats");
assert.ok(projectAssemblyPoint({ x: 440, y: 330 }, 22).y < projectAssemblyPoint({ x: 440, y: 330 }).y, "Raised seat tops project upwards");
for (const seat of finalChamber) for (const face of Object.values(assemblySeatFaces(seat))) assert.ok(face.startsWith("M") && face.endsWith("Z") && !/NaN|Infinity/.test(face), "Every projected seat face is a finite closed vector shape");
for (const chamber of [emptyChamber, partialChamber, finalChamber]) {
  const callouts = assemblyPartyCallouts(chamber);
  assert.ok(callouts.every((label, index) => index === 0 || label.centerX >= callouts[index - 1].centerX), "Party reveals follow chamber groups from left to right");
  assert.equal(callouts.reduce((sum, label) => sum + label.count, 0), 90);
  for (const label of callouts) {
    const members = chamber.filter(seat => (seat.party ?? "PENDING") === label.code);
    assert.equal(label.count, members.length);
    assert.ok(members.some(seat => { const point = projectAssemblyPoint(seat, 22); return point.x === label.target.x && point.y === label.target.y; }), "Callout points to a seat of its own party");
    assert.ok(label.reveal >= .8 && label.reveal < 12, "Every party reveal fits the overall slide duration");
  }
  for (const side of ["left", "right"]) {
    const column = callouts.filter(label => label.side === side).sort((a, b) => a.y - b.y);
    assert.ok(column.every((label, i) => i === 0 || label.y - column[i - 1].y > 60), "Floating labels do not overlap");
    assert.ok(column.every((label, i) => i === 0 || label.centerY >= column[i - 1].centerY), "Labels follow the vertical positions of their seat groups");
  }
  const levels = callouts.map(label => label.y + 30);
  assert.ok(levels.every(level => levels.some(other => Math.abs(level + other - 720) < .001)), "Callout rows share a symmetric vertical grid");
}
console.log("Assembly chart passed: 90 distinct seats, correct final party allocation and partial-result vacancies.");
const designated = finalChamber.map(seat => ({ ...seat, party: seat.party ? assemblyBlocForParty(seat.party) : null }));
assert.equal(designated.filter(seat => seat.party === "NAT").length, 35);
assert.equal(designated.filter(seat => seat.party === "NON").length, 18);
assert.equal(designated.filter(seat => seat.party === "UNI").length, 37);
assert.equal(assemblyBlocForParty("PBP"), "NON", "PBP follows the Assembly's Other designation");
assert.ok(designated.every((seat, index) => seat.x === finalChamber[index].x && seat.y === finalChamber[index].y), "Designation view preserves every seat's position");
const partialDesignated = partialChamber.map(seat => ({ ...seat, party: seat.party ? assemblyBlocForParty(seat.party) : null }));
assert.equal(partialDesignated.filter(seat => seat.party === null).length, 90 - matched.elected);
console.log("Assembly designations passed: Nationalist 35, Non-aligned 18, Unionist 37; positions and partial-result vacancies preserved.");
assert.equal(noOverallCommunityControl(emptyChamber), false);
assert.equal(noOverallCommunityControl(finalChamber), true);
assert.equal(noOverallCommunityControl(finalChamber.map((seat, index) => ({ ...seat, party: index < 46 ? "SF" : "AP" }))), false, "A community majority prevents the confirmation");
assert.equal(noOverallCommunityControl(finalChamber.map((seat, index) => ({ ...seat, party: index < 45 ? "SF" : index < 89 ? "DUP" : null }))), false, "An unresolved 46th seat prevents a premature confirmation");
assert.equal(noOverallCommunityControl(finalChamber.map((seat, index) => ({ ...seat, party: index < 35 ? "SF" : index < 72 ? "DUP" : index < 87 ? "AP" : null }))), true, "Confirmation may appear once even all unfilled seats cannot create a majority");
const communityTotals = communityResults(state);
assert.deepEqual(Array.from(communityTotals, row => row.seats), [35, 18, 37]);
assert.ok(Math.abs(communityTotals.reduce((sum, row) => sum + row.share, 0) - 100) < .0001);
for (const name of Object.keys(state.first)) {
  const rows = communityResults(state, name);
  assert.equal(rows.reduce((sum, row) => sum + row.votes, 0), state.first[name].candidates.reduce((sum, c) => sum + c.votes, 0), "Constituency community votes use first preferences, not transfer tallies");
  assert.equal(rows.reduce((sum, row) => sum + row.seats, 0), 5);
}
assert.equal(communityResults(controlled).reduce((sum, row) => sum + row.seats, 0), matched.elected);
assert.notEqual(ASSEMBLY_BLOCS.NAT.color, sandbox.exports.parties.SF.color, "Community Nationalist colour is distinct from Sinn Féin");
