"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Phone, Clock, Timer, Activity, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VolumeChart = dynamic(() => import("@/components/reports/charts").then((mod) => mod.VolumeChart), { ssr: false });
const RiskPieChart = dynamic(() => import("@/components/reports/charts").then((mod) => mod.RiskPieChart), { ssr: false });
const AgentBarChart = dynamic(() => import("@/components/reports/charts").then((mod) => mod.AgentBarChart), { ssr: false });

type ReportData = {
  kpis: {
    totalCalls: number;
    totalMinutes: number;
    avgDuration: number;
    avgSentiment: number;
  };
  volumeTrend: any[];
  riskDistribution: any[];
  agentPerformance: any[];
};

export default function ReportsPage() {
  const [range, setRange] = useState("7d");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports?range=${range}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch report data", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [range]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Analytics & Reporting</h1>
          <p className="text-zinc-400 mt-1">
            Business intelligence and operational insights
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {["7d", "30d", "90d"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                range === r
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              Last {r.replace("d", " Days")}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[600px] flex items-center justify-center">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
        </div>
      ) : data ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Calls"
              value={data.kpis.totalCalls.toLocaleString()}
              icon={Phone}
              color="text-emerald-500"
              bg="bg-emerald-500/10"
            />
            <KpiCard
              title="Total Minutes"
              value={data.kpis.totalMinutes.toLocaleString()}
              icon={Clock}
              color="text-blue-500"
              bg="bg-blue-500/10"
            />
            <KpiCard
              title="Avg Duration"
              value={`${Math.floor(data.kpis.avgDuration / 60)}m ${data.kpis.avgDuration % 60}s`}
              icon={Timer}
              color="text-orange-500"
              bg="bg-orange-500/10"
            />
            <KpiCard
              title="Avg Sentiment"
              value={data.kpis.avgSentiment > 0 ? `+${data.kpis.avgSentiment}` : data.kpis.avgSentiment.toString()}
              icon={Activity}
              color={data.kpis.avgSentiment >= 0 ? "text-emerald-500" : "text-red-500"}
              bg={data.kpis.avgSentiment >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 min-h-[450px]">
              <VolumeChart data={data.volumeTrend} />
            </div>
            <div className="min-h-[450px]">
              <RiskPieChart data={data.riskDistribution} />
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 min-h-[450px]">
            <AgentBarChart data={data.agentPerformance} />
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-zinc-500">
          Failed to load data. Please try again.
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center gap-4 hover:border-zinc-700 transition-colors">
      <div className={cn("p-3 rounded-lg", bg)}>
        <Icon className={cn("h-6 w-6", color)} />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-500">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}
