"use client";

import { useState, useEffect, useMemo } from "react";
import { CATEGORY_CONFIG } from "@/types";
import type { Save, View } from "@/types";
import { SaveRow } from "@/components/SaveRow";
import { SaveCard } from "@/components/SaveCard";
import { TopBar } from "@/components/TopBar";
import { DensityToggle } from "@/components/ui/density-toggle";
import type { Density } from "@/components/ui/density-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface SavesListProps {
  allSaves: Save[];
  loading: boolean;
  error: string | null;
  view: View;
  filterCategory: string;
  density: Density;
  onDensityChange: (d: Density) => void;
  onSelectSave: (id: number) => void;
}

const SOURCE_PILLS = [
  { value: "",        label: "Tous" },
  { value: "article", label: "Articles" },
  { value: "reddit",  label: "Reddit" },
  { value: "youtube", label: "YouTube" },
] as const;

function getSevenDaysAgo(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseCreatedAt(s: string): Date {
  return new Date(s.endsWith("Z") ? s : s + "Z");
}

function viewLabel(view: View, filterCategory: string): string {
  if (filterCategory) return filterCategory;
  if (view === "unread")  return "Non lus";
  if (view === "starred") return "Favoris";
  if (view === "today")   return "Cette semaine";
  return "Tous les saves";
}

export function SavesList({
  allSaves, loading, error,
  view, filterCategory,
  density, onDensityChange,
  onSelectSave,
}: SavesListProps) {
  const [activeSource, setActiveSource] = useState("");

  useEffect(() => {
    setActiveSource("");
  }, [view, filterCategory]);

  const saves = useMemo(() => {
    let result = allSaves;
    if (filterCategory) result = result.filter((s) => s.category === filterCategory);
    if (activeSource)   result = result.filter((s) => s.source === activeSource);
    if (view === "unread")       result = result.filter((s) => !s.is_read);
    else if (view === "starred") result = result.filter((s) => s.is_favorite);
    else if (view === "today") {
      const threshold = getSevenDaysAgo();
      result = result.filter((s) => parseCreatedAt(s.created_at) >= threshold);
    }
    return result;
  }, [allSaves, filterCategory, activeSource, view]);

  const dotColor = filterCategory
    ? CATEGORY_CONFIG[filterCategory as keyof typeof CATEGORY_CONFIG]?.dot
    : undefined;

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        title={viewLabel(view, filterCategory)}
        subtitle={loading ? undefined : `${saves.length} save${saves.length > 1 ? "s" : ""}`}
        right={<DensityToggle value={density} onChange={onDensityChange} />}
      />

      <div className="flex items-center gap-1.5 px-8 py-3 border-b border-ink-100 bg-white/50">
        {SOURCE_PILLS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveSource(f.value)}
            className={cn(
              "px-3 h-7 rounded-full text-[12.5px] font-medium transition-colors",
              activeSource === f.value
                ? "bg-ink-950 text-white"
                : "text-ink-500 hover:text-ink-800 hover:bg-ink-100"
            )}
          >
            {f.label}
          </button>
        ))}
        {filterCategory && dotColor && (
          <span className="ml-2 flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[12.5px] font-medium bg-ink-100 text-ink-700">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: dotColor }} />
            {filterCategory}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto stable-gutter px-8 py-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          density === "list" ? (
            <div className="bg-white rounded-xl border border-ink-200/70 divide-y divide-ink-100">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="px-5 py-4 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-14 rounded-full" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-ink-200/70 p-5 space-y-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-14 rounded-full" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-4/6" />
                </div>
              ))}
            </div>
          )
        ) : saves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookmarkCheck className="w-10 h-10 text-ink-200 mb-4" />
            <p className="text-[14px] font-medium text-ink-500">
              Aucun save{filterCategory ? ` dans « ${filterCategory} »` : ""}.
            </p>
            <p className="text-[12.5px] text-ink-400 mt-1">
              Sauvegarde du contenu via l'extension Chrome pour commencer.
            </p>
          </div>
        ) : density === "list" ? (
          <div className="bg-white rounded-xl border border-ink-200/70 divide-y divide-ink-100">
            {saves.map((save) => (
              <SaveRow key={save.id} save={save} onClick={() => onSelectSave(save.id)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {saves.map((save) => (
              <SaveCard key={save.id} save={save} onClick={() => onSelectSave(save.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
