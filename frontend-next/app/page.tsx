"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SavesList } from "@/components/SavesList";
import { Categories } from "@/components/Categories";
import { Stats } from "@/components/Stats";
import { ReadingModal } from "@/components/ReadingModal";
import { CommandPalette } from "@/components/CommandPalette";
import { getStats, listSaves } from "@/lib/api";
import type { Stats as StatsData, Save, View } from "@/types";
import type { Density } from "@/components/ui/density-toggle";

export default function Home() {
  const [view, setView] = useState<View>("inbox");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [density, setDensity] = useState<Density>("list");
  const [selectedSaveId, setSelectedSaveId] = useState<number | null>(null);

  // Sidebar counts
  const [stats, setStats] = useState<StatsData | null>(null);

  // Master save list — seul détenteur de la vérité
  const [allSaves, setAllSaves] = useState<Save[]>([]);
  const [savesLoading, setSavesLoading] = useState(true);
  const [savesError, setSavesError] = useState<string | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    setSavesLoading(true);
    setSavesError(null);
    listSaves({ limit: 200 })
      .then((d) => setAllSaves(d.saves))
      .catch(() => {
        setSavesError("Backend non joignable — lance : uv run uvicorn backend.app:app --reload --port 8000");
        setAllSaves([]);
      })
      .finally(() => setSavesLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setCmdOpen(true); return;
      }
      if (!typing && e.key === "/") { e.preventDefault(); setCmdOpen(true); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => ({
    total:     stats?.total_saves     ?? 0,
    unread:    stats?.unread_count    ?? 0,
    favorites: stats?.favorites_count ?? 0,
    thisWeek:  stats?.this_week_count ?? 0,
    byCat:     stats?.by_category    ?? {},
  }), [stats]);

  const handleCategoryClick = useCallback((cat: string) => {
    setActiveCategory(cat);
    setView("inbox");
  }, []);

  const handleSaveUpdated = useCallback(
    (id: number, changes: { is_favorite: boolean; is_read: boolean }) => {
      setAllSaves((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    },
    []
  );

  const handleNavigate = useCallback((v: View, category?: string) => {
    setView(v);
    setActiveCategory(category ?? null);
  }, []);

  return (
    <div className="min-h-screen flex bg-ink-50/50">
      <Sidebar
        view={view}
        setView={setView}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        counts={counts}
        onOpenCmd={() => setCmdOpen(true)}
      />

      <main className="flex-1 min-w-0">
        {view === "categories" ? (
          <Categories onCategoryClick={handleCategoryClick} />
        ) : view === "stats" ? (
          <Stats />
        ) : (
          <SavesList
            allSaves={allSaves}
            loading={savesLoading}
            error={savesError}
            view={view}
            filterCategory={activeCategory ?? ""}
            density={density}
            onDensityChange={setDensity}
            onSelectSave={setSelectedSaveId}
          />
        )}
      </main>

      <ReadingModal
        saveId={selectedSaveId}
        onClose={() => setSelectedSaveId(null)}
        onSaveUpdated={handleSaveUpdated}
      />

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onSelectSave={setSelectedSaveId}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
