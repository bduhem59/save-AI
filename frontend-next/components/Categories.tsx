"use client";

import { useState, useEffect } from "react";
import { getStats } from "@/lib/api";
import { CATEGORIES, CATEGORY_CONFIG } from "@/types";
import { TopBar } from "@/components/TopBar";

interface CategoriesProps {
  onCategoryClick: (category: string) => void;
}

export function Categories({ onCategoryClick }: CategoriesProps) {
  const [byCat, setByCat] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then((s) => { setByCat(s.by_category); setTotal(s.total_saves); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title="Catégories"
        subtitle={loading ? undefined : `${total} saves`}
      />

      <div className="flex-1 overflow-y-auto stable-gutter px-8 py-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const count = byCat[cat] ?? 0;
            return (
              <button
                key={cat}
                onClick={() => onCategoryClick(cat)}
                className="group relative text-left bg-white rounded-2xl border border-ink-200/70 p-5 hover:shadow-pop hover:-translate-y-0.5 transition-all active:scale-[0.98] overflow-hidden"
                style={{
                  background: `linear-gradient(145deg, #ffffff 55%, ${cfg.dot}14)`,
                }}
              >
                {/* Decorative circle */}
                <div
                  className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-[0.08]"
                  style={{ backgroundColor: cfg.dot }}
                />
                <div className="relative">
                  <span className="text-[28px] block mb-3 select-none">{cfg.emoji}</span>
                  <span className="text-[14px] font-semibold text-ink-900 block leading-tight">
                    {cat}
                  </span>
                  <span className="text-[12px] font-mono text-ink-400 mt-1 block">
                    {loading ? "…" : `${count} save${count !== 1 ? "s" : ""}`}
                  </span>
                </div>
                {/* Bottom accent line on hover */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: cfg.dot }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
