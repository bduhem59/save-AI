"use client";

import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { getStats } from "@/lib/api";
import { Stats as StatsType } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const SOURCE_COLORS: Record<string, string> = {
  article: "#6366f1",
  reddit:  "#f97316",
  youtube: "#ef4444",
};

const CAT_COLORS = [
  "#7c3aed", "#2563eb", "#059669", "#d97706",
  "#ea580c", "#e11d48", "#db2777", "#6b7280",
];

function formatWeek(w: string): string {
  const m = w.match(/\d{4}-W(\d{2})/);
  return m ? `S${m[1]}` : w;
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
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card><CardContent><Skeleton className="h-48" /></CardContent></Card>
          <Card><CardContent><Skeleton className="h-48" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const sourceData = Object.entries(stats.by_source).map(([name, value]) => ({ name, value }));
  const catData = Object.entries(stats.by_category || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  const weekData = (stats.by_week || []).map((w) => ({
    week: formatWeek(w.week),
    count: w.count,
  }));

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-gray-900">{stats.total_saves}</div>
            <div className="text-xs text-gray-500 mt-0.5">saves au total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-indigo-600">
              {stats.claude_cost_eur_total.toFixed(2)}€
            </div>
            <div className="text-xs text-gray-500 mt-0.5">coût Claude</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-gray-900">
              {stats.claude_tokens_total > 1000
                ? `${(stats.claude_tokens_total / 1000).toFixed(0)}k`
                : stats.claude_tokens_total}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">tokens utilisés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-gray-900">
              {Object.keys(stats.by_category || {}).length}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">catégories</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Source pie */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700">Par source</h3>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
                Pas de données
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {sourceData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={SOURCE_COLORS[entry.name] || "#6b7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} saves`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category bar */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700">Par catégorie</h3>
          </CardHeader>
          <CardContent>
            {catData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
                Pas de données
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={catData} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip formatter={(v) => [`${v} saves`, ""]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {catData.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      {weekData.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700">
              Activité des 12 dernières semaines
            </h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={weekData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
                <Tooltip formatter={(v) => [`${v} save${Number(v) > 1 ? "s" : ""}`, ""]} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  fill="#e0e7ff"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top tags */}
      {stats.top_tags?.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-700">Top tags</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.top_tags.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
                >
                  {tag}
                  <Badge variant="outline">{count}</Badge>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
