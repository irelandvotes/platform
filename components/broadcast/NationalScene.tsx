export default function NationalScene({
title,
results
}) {

return (

<div
style={{
width: "100%",
height: "100%",
display: "flex",
flexDirection: "column",
padding: "40px"
}}
>

<div
style={{
fontSize: "42px",
fontWeight: "700",
marginBottom: "20px"
}}
>
{title}
</div>

<div
style={{
fontSize: "22px",
opacity: 0.7
}}
>
National Overview
</div>

</div>

);

}