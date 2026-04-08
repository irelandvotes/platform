"use client";

import { useState, useEffect, useMemo } from "react";
import Map from "../Map";
import NationalScene from "./NationalScene";
import ConstituencyScene from "./ConstituencyScene";
import BroadcastTopBar from "./BroadcastTopBar";

export default function BroadcastChannel({
  title,
  year,
  country,
  type
}) {

const [results, setResults] = useState({});
const [list, setList] = useState([]);
const [total, setTotal] = useState(null);
const [previousResults, setPreviousResults] = useState({});
const [sceneIndex, setSceneIndex] = useState(0);


/* ===============================
   CONSTITUENCIES WITH RESULTS
=============================== */

const constituenciesWithResults = useMemo(() => {

return list.filter(name => {

const counts = results?.[name]?.counts;

if (!counts) return false;

return Object.values(counts).some(
rows => rows && rows.length > 0
);

});

}, [list, results]);


/* ===============================
   SCENES
=============================== */

const scenes = useMemo(() => {

return [
{ type: "national" },
...constituenciesWithResults.map(name => ({
type: "constituency",
name
}))
];

}, [constituenciesWithResults]);


/* ===============================
   SAFE INDEX
=============================== */

const safeIndex =
sceneIndex >= scenes.length
? 0
: sceneIndex;

const scene =
scenes[safeIndex] || { type: "national" };


/* ===============================
   AUTO ROTATE
=============================== */

useEffect(() => {

if (!scenes.length) return;

const currentScene =
scenes[safeIndex];

const duration =
currentScene?.type === "national"
? 8000
: 24000; // 4 slides × 6s

const timer = setTimeout(() => {

setSceneIndex(prev =>
(prev + 1) % scenes.length
);

}, duration);

return () => clearTimeout(timer);

}, [sceneIndex, scenes]);


/* ===============================
   RENDER
=============================== */

return (

<div
style={{
width: "100vw",
height: "100vh",
background: "#111",
color: "#fff",
overflow: "hidden",
display: "flex",
flexDirection: "column",
position: "relative"
}}
>

{/* HIDDEN MAP (DATA LOADER) */}

<div
style={{
position: "absolute",
width: 0,
height: 0,
overflow: "hidden"
}}
>
<Map
election={{ country, type, year }}
onLoadResults={setResults}
onLoadList={setList}
onLoadTotal={setTotal}
onLoadPreviousResults={setPreviousResults}
selected={null}
view="count"
results={results}
/>
</div>


{/* NATIONAL */}

{scene?.type === "national" && (
<NationalScene
title={title}
results={results}
/>
)}


{/* CONSTITUENCY */}

{scene?.type === "constituency" && (

<>

{/* TOP BAR */}

<BroadcastTopBar
name={scene.name}
results={results}
/>


{/* CONTENT */}

<div style={{ flex: 1 }}>

<ConstituencyScene
name={scene.name}
results={results}
previousResults={previousResults}
/>

</div>

</>

)}

</div>

);

}