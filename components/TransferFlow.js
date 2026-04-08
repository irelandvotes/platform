"use client";

import {
  Sankey,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const renderNode = ({
  x,
  y,
  width,
  height,
  payload
}) => {

  const name = payload?.name || payload?.payload?.name;
  const isRightSide = x > 300;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.fill || "#888"}
        rx={4}
      />

<text
  x={isRightSide ? x - 6 : x + width + 6}
  y={y + height / 2}
  textAnchor={isRightSide ? "end" : "start"}
  fill="#ccc"
  fontSize={11}
  alignmentBaseline="middle"
>
  {name.split("\n").map((line, i) => (
    <tspan
      key={i}
      x={isRightSide ? x - 6 : x + width + 6}
      dy={i === 0 ? 0 : 14}
    >
      {line}
    </tspan>
  ))}
</text>
    </g>
  );
};

export default function TransferFlow({ data }) {
  if (!data) return null;

  const height = Math.max(
    260,
    (data.nodes?.length || 0) * 45
  );

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <Sankey
          data={data}
          node={renderNode}
          nodePadding={20}
          margin={{ top: 20, bottom: 20 }}
        >
          <Tooltip />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}