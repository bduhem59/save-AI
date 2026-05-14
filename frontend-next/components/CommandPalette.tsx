"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Inbox, BookOpen, Star, Clock,
  Layers, BarChart2, ArrowRight,
} from "lucide-react";
import { searchSaves } from "@/lib/api";
import { SOURCE_CONFIG, CATEGORY_CONFIG } from "@/types";
import type { Save, View } from "@/types";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectSave: (id: number) => void;
  onNavigate: (view: View, category?: string) => void;
}

const QUICK_ACTIONS = [
  { id: "inbox",      label: "Tous les saves", Icon: Inbox,     view: "inbox"      as View },
  { id: "unread",     label: "Non lus",         Icon: BookOpen,  view: "unread"     as View },
  { id: "starred",    label: "Favoris",          Icon: Star,      view: "starred"    as View },
  { id: "today",      label: "Cette semaine",    Icon: Clock,     view: "today"      as View },
  { id: "categories", label: "Catégories",       Icon: Layers,    view: "categories" as View },
  { id: "stats",      label: "Statistiques",     Icon: BarChart2, view: "stats"      as View },
] as const;

export function CommandPalette({ open, onClose, onSelectSave, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Save[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(""); setResults([]); setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setActiveIdx(0); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchSaves(query.trim());
        setResults(data.results.slice(0, 8));
        setActiveIdx(0);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const isSearch = query.trim().length > 0;
  const itemCount = isSearch ? results.length : QUICK_ACTIONS.length;

  const selectItem = useCallback((i: number) => {
    if (isSearch) {
      const save = results[i];
      if (save) { onSelectSave(save.id); onClose(); }
    } else {
      const action = QUICK_ACTIONS[i];
      if (action) { onNavigate(action.view); onClose(); }
    }
  }, [isSearch, results, onSelectSave, onNavigate, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((n) => Math.min(n + 1, itemCount - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((n) => Math.max(n - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); selectItem(activeIdx); }
      else if (e.key === "Escape") { onClose(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeIdx, itemCount, selectItem, onClose]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-pop overflow-hidden flex flex-col max-h-[60vh]">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ink-100 shrink-0">
          <Search className="w-4 h-4 text-ink-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher ou naviguer…"
            className="flex-1 text-[14px] text-ink-950 placeholder:text-ink-400 outline-none bg-transparent"
          />
          {searching && (
            <span className="text-[11px] font-mono text-ink-400 animate-pulse shrink-0">…</span>
          )}
          <kbd className="shrink-0">Esc</kbd>
        </div>

        <div ref={listRef} className="overflow-y-auto stable-gutter pb-2">
          <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-ink-400 uppercase tracking-[0.08em]">
            {isSearch
              ? results.length > 0
                ? `${results.length} résultat${results.length > 1 ? "s" : ""}`
                : "Résultats"
              : "Navigation rapide"}
          </p>

          {isSearch && !searching && results.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-ink-400">
              Aucun résultat pour «&nbsp;{query}&nbsp;»
            </div>
          )}

          {!isSearch && QUICK_ACTIONS.map((action, i) => (
            <button
              key={action.id}
              data-idx={i}
              onClick={() => selectItem(i)}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors",
                i === activeIdx ? "bg-ink-50" : "hover:bg-ink-50/60"
              )}
            >
              <action.Icon className={cn(
                "w-4 h-4 shrink-0",
                i === activeIdx ? "text-ink-700" : "text-ink-400"
              )} />
              <span className={cn(
                "flex-1 text-[13.5px] font-medium",
                i === activeIdx ? "text-ink-950" : "text-ink-700"
              )}>
                {action.label}
              </span>
              {i === activeIdx && <ArrowRight className="w-3.5 h-3.5 text-ink-400 shrink-0" />}
            </button>
          ))}

          {isSearch && results.map((save, i) => {
            const srcCfg = SOURCE_CONFIG[save.source];
            const catCfg = save.category
              ? CATEGORY_CONFIG[save.category as keyof typeof CATEGORY_CONFIG]
              : null;
            return (
              <button
                key={save.id}
                data-idx={i}
                onClick={() => selectItem(i)}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  "w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors",
                  i === activeIdx ? "bg-ink-50" : "hover:bg-ink-50/60"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-ink-900 truncate leading-snug">
                    {save.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      "text-[10.5px] font-medium px-1.5 py-0.5 rounded-full",
                      srcCfg.bgColor, srcCfg.color
                    )}>
                      {srcCfg.label}
                    </span>
                    {catCfg && (
                      <span className="text-[10.5px] text-ink-500">
                        {catCfg.emoji} {save.category}
                      </span>
                    )}
                  </div>
                  {save.summary && (
                    <p className="text-[12px] text-ink-400 mt-0.5 line-clamp-1">
                      {save.summary.replace(/\*\*/g, "").slice(0, 120)}
                    </p>
                  )}
                </div>
                {i === activeIdx && <ArrowRight className="w-3.5 h-3.5 text-ink-400 shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
