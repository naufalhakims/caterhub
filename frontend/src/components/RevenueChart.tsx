"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <div className="mt-3 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8 }}>
          <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} />
          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${Math.round(v / 1_000_000)}jt`}
          />
          <Tooltip
            cursor={{ fill: "#FAEAD7" }}
            formatter={(v) => [`Rp${Number(v).toLocaleString("id-ID")}`, "Pendapatan"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 13 }}
          />
          <Bar dataKey="revenue" fill="#9A3412" radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
