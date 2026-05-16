"use client";

import { useState, useEffect, useMemo } from "react";
import Map from "../Map";
import NationalScene from "./NationalScene";
import ConstituencyScene from "./ConstituencyScene";
import BroadcastTopBar from "./BroadcastTopBar";
import BroadcastTicker from "./BroadcastTicker";

type ConstituencySceneType = {
  type:"constituency";
  name:string;
};

type NationalSceneType = {
  type:"national";
};

type Scene =
| NationalSceneType
| ConstituencySceneType;

export default function BroadcastChannel({
title,
year,
country,
type
}:{
title:string;
year:number|string;
country:string;
type:string;
}){

const [results,setResults]=
useState<Record<string,any>>({});

const [list,setList]=
useState<string[]>([]);

const [
previousResults,
setPreviousResults
]=
useState<Record<string,any>>({});

const [
sceneIndex,
setSceneIndex
]=
useState<number>(0);


/* ==========================
CONSTITUENCIES
========================== */

const constituencies=
useMemo(()=>{

return list.filter(name=>{

const counts=
results?.[name]?.counts;

return(
counts &&
Object.keys(counts).length>0
);

});

},[
list,
results
]);


/* ==========================
SCENES
========================== */

const scenes:Scene[]=
useMemo(()=>{

return[

{
type:"national"
},

...constituencies.map(
(name):
ConstituencySceneType=>({

type:"constituency",
name

})
)

];

},[
constituencies
]);


/* ==========================
CURRENT SCENE
========================== */

const scene:Scene=

scenes.length

? scenes[
sceneIndex%
scenes.length
]

: {
type:"national"
};


/* ==========================
AUTOROTATE
========================== */

useEffect(()=>{

if(!scenes.length)
return;

const duration=

scene.type==="national"

?12000

:36000;

const timer=
setTimeout(()=>{

setSceneIndex(
prev=>
(prev+1)
%
scenes.length
);

},duration);

return()=>clearTimeout(
timer
);

},[
scene,
scenes.length
]);


/* ==========================
MAP SELECTED
========================== */

const selectedConstituency:

{name:string}|null=

scene.type===
"constituency"

?{
name:
scene.name
}

:null;


/* ==========================
RENDER
========================== */

return(

<div
style={{

height:"100vh",

display:"flex",
flexDirection:"column",

background:"#101010",

overflow:"hidden"
}}
>

<BroadcastTopBar
scene={scene}
results={results}
/>

<div
style={{

flex:1,

minHeight:0,

display:"grid",

gridTemplateColumns:
"58% 42%",

overflow:"hidden"

}}
>

{/* MAP */}

<div
style={{

position:"relative",

overflow:"hidden",

borderRight:
"1px solid rgba(255,255,255,.06)"
}}
>

<div
style={{

position:"absolute",

inset:0,

background:
"radial-gradient(circle at center, rgba(0,223,239,.08), transparent 70%)",

pointerEvents:"none",

zIndex:1
}}
/>

<div
style={{

position:"relative",

zIndex:2,

height:"100%"
}}
>

<Map
election={{
country,
type,
year
}}

selected={
selectedConstituency
}

view="winner"

results={results}

onSelect={()=>{}}

onLoadResults={
setResults
}

onLoadList={
setList
}

onLoadPreviousResults={
setPreviousResults
}

onLoadTotal={()=>{}}

onLoadOfficialResults={()=>{}}

onLoadProjection={()=>{}}

resetTrigger={0}

count={1}
/>

</div>

</div>


{/* STORY PANEL */}

<div
style={{

flex:1,

minHeight:0,

overflow:"hidden",

display:"flex",

flexDirection:"column"
}}
>

{scene.type==="national"

? (

<NationalScene
title={title}
results={results}
/>

)

:(

<ConstituencyScene
name={scene.name}
results={results}
previousResults={
previousResults
}
/>

)}

</div>

</div>


<BroadcastTicker
results={results}
/>

</div>

);

}