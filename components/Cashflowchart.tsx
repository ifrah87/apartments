"use client";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";

export default function CashflowChart({
  data,
}: {
  data: { month: string; inflows: number; outflows: number; net: number }[];
}) {
  if (!data?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 h-[340px]">
      <div className="text-slate-700 font-semibold mb-2">Cashflow (In vs Out)</div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="inflows" name="Inflows" />
          <Bar dataKey="outflows" name="Outflows" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
