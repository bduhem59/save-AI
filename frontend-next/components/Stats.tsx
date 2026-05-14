"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { getStats } from "@/lib/api";
import { CATEGORY_CONFIG } from "@/types";
import type { Stats as StatsType } from "@/types";
import { TopBar } from "@/components/TopBar";
import { Skeleton } from "@/components/ui/skeleton";

const SRC_LABELS: Record<string, string> = {
  article: "Articles",
  reddit:  "Reddit",
  youtube: "YouTube",
};

function formatWeek(w: string): string {
  const m = w.match(/\d{4}-W(\d{2})/);
  return m ? `S${m[1]}` : w;
}

function buildSparkline(backendWeeks: { week: string; count: number }[]): { week: string; count: number }[] {
  const sorted = [...backendWeeks]
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);
  const padding = Array.from(
    { length: Math.max(0, 12 - sorted.length) },
    () => ({ week: "—", count: 0 })
  );
  return [...padding, ...sorted.map((w) => ({ week: formatWeek(w.week), count: w.count }))];
}

function KpiTile({ value, label, mono = false }: { value: string; label: string; mono?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-ink-200/70 px-5 py-4">
      <div className={`text-[28px] font-semibold tracking-tight text-ink-950 leading-none mb-1 ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
      <div className="text-[12px] text-ink-500">{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.08em] mb-3">
      {children}
    </h2>
  );
}

export function Stats() {
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <TopBar title="Statistiques" />
        <div className="flex-1 overflow-y-auto stable-gutter px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-ink-200/70 px-5 py-4">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const total = stats.total_saves;
  const sourceEntries = Object.entries(stats.by_source).sort((a, b) => b[1] - a[1]);
  const catEntries = Object.entries(stats.by_category).sort((a, b) => b[1] - a[1]);
  const weekData = buildSparkline(stats.by_week);

  return (
    <div className="flex flex-col h-screen">
      <TopBar title="Statistiques" subtitle={`${total} saves`} />

      <div className="flex-1 overflow-y-auto stable-gutter px-8 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiTile value={String(stats.total_saves)} label="saves au total" />
          <KpiTile value={String(stats.this_week_count)} label="cette semaine" />
          <KpiTile
            value={`${stats.claude_cost_eur_total.toFixed(3)}€`}
            label="coût Claude"
            mono
          />
          <KpiTile
            value={
              stats.claude_tokens_total > 999
                ? `${(stats.claude_tokens_total / 1000).toFixed(1)}k`
                : String(stats.claude_tokens_total)
            }
            label="tokens utilisés"
            mono
          />
        </div>

        {/* Par source */}
        {sourceEntries.length > 0 && (
          <section>
            <SectionLabel>Par source</SectionLabel>
            <div className="bg-white rounded-xl border border-ink-200/70 divide-y divide-ink-100">
              {sourceEntries.map(([src, n]) => {
                const pct = total > 0 ? (n / total) * 100 : 0;
                return (
                  <div key={src} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-20 text-[13px] font-medium text-ink-700 shrink-0">
                      {SRC_LABELS[src] ?? src}
                    </span>
                    <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: "#3f3f46",
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-[12px] font-mono text-ink-500 shrink-0">
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Sparkline 12 semaines */}
        {weekData.length > 0 && (
          <section>
            <SectionLabel>Activité — 12 semaines</SectionLabel>
            <div className="bg-white rounded-xl border border-ink-200/70 px-4 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={weekData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      border: "1px solid #e4e4e7",
                      borderRadius: 8,
                      boxShadow: "none",
                      padding: "4px 10px",
                    }}
                    formatter={(v: number) => [`${v} save${v > 1 ? "s" : ""}`, ""]}
                    labelStyle={{ color: "#3f3f46", fontWeight: 500 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#09090b"
                    strokeWidth={1.5}
                    fill="#f4f4f5"
                    dot={false}
                    activeDot={{ r: 3, fill: "#09090b" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Par catégorie */}
        {catEntries.length > 0 && (
          <section>
            <SectionLabel>Par catégorie</SectionLabel>
            <div className="bg-white rounded-xl border border-ink-200/70 divide-y divide-ink-100">
              {catEntries.map(([cat, n]) => {
                const cfg = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
                const pct = total > 0 ? (n / total) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-base shrink-0">{cfg?.emoji ?? "📌"}</span>
                    <span className="w-28 text-[13px] font-medium text-ink-700 shrink-0 truncate">
                      {cat}
                    </span>
                    <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cfg?.dot ?? "#9ca3af",
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-[12px] font-mono text-ink-500 shrink-0">
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Top tags */}
        {stats.top_tags?.length > 0 && (
          <section>
            <SectionLabel>Top tags</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {stats.top_tags.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 px-3 h-7 rounded-full text-[12.5px] font-medium bg-white border border-ink-200 text-ink-700"
                >
                  {tag}
                  <span className="font-mono text-[10.5px] text-ink-400">{count}</span>
                </span>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
