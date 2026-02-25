"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TradesChartProps {
  data: Array<{
    date: string;
    trades: number;
    wins: number;
    losses: number;
  }>;
}

export function TradesChart({ data }: TradesChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operaciones por Dia</CardTitle>
          <CardDescription>Numero de trades en los ultimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          Sin datos historicos disponibles
        </CardContent>
      </Card>
    );
  }

  const maxTrades = Math.max(...data.map((d) => d.trades), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operaciones por Dia</CardTitle>
        <CardDescription>Numero de trades en los ultimos 7 dias</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                domain={[0, maxTrades * 1.2]}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  const val = value ?? 0;
                  const n = name ?? "";
                  if (n === "wins") return [val, "Ganadores"];
                  if (n === "losses") return [val, "Perdedores"];
                  return [val, "Total"];
                }}
                labelFormatter={(label) => `Fecha: ${label}`}
              />
              <Bar dataKey="wins" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar
                dataKey="losses"
                stackId="a"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-sm text-muted-foreground">Ganadores</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-sm text-muted-foreground">Perdedores</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
