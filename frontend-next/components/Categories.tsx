"use client";

import { useState, useEffect } from "react";
import { listSaves } from "@/lib/api";
import { CATEGORIES, CATEGORY_CONFIG } from "@/types";

interface CategoriesProps {
  onCategoryClick: (category: string) => void;
}

export function Categories({ onCategoryClick }: CategoriesProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSaves({ limit: 200 })
      .then((data) => {
        const c: Record<string, number> = {};
        for (const save of data.saves) {
          const cat = save.category || "Autre";
          c[cat] = (c[cat] || 0) + 1;
        }
        setCounts(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-5">
        Cliquer sur une catégorie pour filtrer les saves.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const count = counts[cat] || 0;
          return (
            <button
              key={cat}
              onClick={() => onCategoryClick(cat)}
              className={`p-4 rounded-xl border-2 border-transparent text-left transition-all hover:border-indigo-200 hover:shadow-md active:scale-[0.98] ${cfg.bgColor}`}
            >
              <div className="text-2xl mb-2">{cfg.emoji}</div>
              <div className={`text-sm font-semibold ${cfg.color}`}>{cat}</div>
              <div className="text-xs text-gray-400 mt-1">
                {loading ? "…" : `${count} save${count > 1 ? "s" : ""}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
