"use client";

import { useState, useEffect, useCallback } from "react";
import { listSaves, searchSaves } from "@/lib/api";
import { Save } from "@/types";
import { SaveRow } from "@/components/SaveRow";
import { SaveDetail } from "@/components/SaveDetail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface SavesListProps {
  searchQuery: string;
  filterSource: string;
  filterCategory: string;
}

const SOURCE_FILTERS = [
  { value: "",        label: "Tous" },
  { value: "article", label: "Articles" },
  { value: "reddit",  label: "Reddit" },
  { value: "youtube", label: "YouTube" },
];

export function SavesList({ searchQuery, filterSource, filterCategory }: SavesListProps) {
  const [saves, setSaves] = useState<Save[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState(filterSource);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Sync external category/source filter from Categories tab clicks
  useEffect(() => { setActiveSource(filterSource); }, [filterSource]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (searchQuery) {
        const data = await searchSaves(searchQuery);
        setSaves(data.results);
      } else {
        const data = await listSaves({
          source:   activeSource   || undefined,
          category: filterCategory || undefined,
          limit: 200,
        });
        setSaves(data.saves);
      }
    } catch {
      setError("Backend non joignable — lance : uv run uvicorn backend.app:app --reload --port 8000");
      setSaves([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeSource, filterCategory]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Source filter tabs (hidden during search) */}
      {!searchQuery && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {SOURCE_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={activeSource === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSource(f.value)}
            >
              {f.label}
            </Button>
          ))}
          {filterCategory && (
            <span className="flex items-center gap-1.5 px-3 h-7 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
              {filterCategory}
            </span>
          )}
        </div>
      )}

      {/* Search context */}
      {searchQuery && (
        <p className="text-sm text-gray-500 mb-4">
          <strong>{saves.length}</strong> résultat{saves.length > 1 ? "s" : ""} pour «&nbsp;{searchQuery}&nbsp;»
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 mb-4">
          {error}
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-4 py-3.5 space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </>
        ) : saves.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-sm">Aucun save{filterCategory ? ` dans « ${filterCategory} »` : ""}.</p>
            <p className="text-xs mt-1 text-gray-300">
              Sauvegarde du contenu via l'extension Chrome pour commencer.
            </p>
          </div>
        ) : (
          saves.map((save) => (
            <SaveRow key={save.id} save={save} onClick={() => setSelectedId(save.id)} />
          ))
        )}
      </div>

      <SaveDetail saveId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
