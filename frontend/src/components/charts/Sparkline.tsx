"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

/** 12-point trend; the current period is marked with a dot. */
export function Sparkline({ data, height = 36, color = "var(--color-primary)" }: { data: number[]; height?: number; color?: string }) {
  const points = data.map((v, i) => ({ i, v }));
  const last = points.length - 1;
  return (
    <div style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === last && props.cx !== undefined && props.cy !== undefined ? (
                <circle key="last" cx={props.cx} cy={props.cy} r={3.5} fill={color} stroke="#ffffff" strokeWidth={2} />
              ) : (
                <g key={`d${props.index}`} />
              )
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
