"use client";

import { useState } from "react";
import {
  Inbox, BookOpen, Star, Clock, Layers, BarChart2,
  Search, Plus, Bookmark, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_CONFIG, type View } from "@/types";

interface SidebarCounts {
  total: number;
  unread: number;
  favorites: number;
  thisWeek: number;
  byCat: Record<string, number>;
}

interface SidebarProps {
  view: View;
  setView: (v: View) => void;
  activeCategory: string | null;
  setActiveCategory: (c: string | null) => void;
  counts: SidebarCounts;
  onOpenCmd: () => void;
}

const btnBase =
  "group w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13.5px] font-medium transition-colors";
const activeBtn = "bg-white text-ink-950 shadow-soft";
const inactiveBtn = "text-ink-600 hover:text-ink-900 hover:bg-ink-100/70";

export function Sidebar({
  view,
  setView,
  activeCategory,
  setActiveCategory,
  counts,
  onOpenCmd,
}: SidebarProps) {
  const [catOpen, setCatOpen] = useState(true);

  function nav(v: View) {
    setView(v);
    setActiveCategory(null);
  }

  return (
    <aside className="w-[244px] shrink-0 border-r border-ink-200/70 bg-ink-50 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-ink-200/60">
        <div className="w-7 h-7 rounded-md bg-ink-950 grid place-items-center text-white shrink-0">
          <Bookmark className="w-[15px] h-[15px]" />
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-[13.5px] font-semibold tracking-tight text-ink-950">
            Save &amp; Resurface
          </div>
          <div className="text-[10.5px] text-ink-500 font-mono">MVP — local</div>
        </div>
      </div>

      {/* Primary nav */}
      <div className="px-2.5 pt-3 pb-2 space-y-0.5">
        {(
          [
            { id: "inbox"   as View, label: "Tous les saves", Icon: Inbox,    count: counts.total     },
            { id: "unread"  as View, label: "Non lus",         Icon: BookOpen, count: counts.unread    },
            { id: "starred" as View, label: "Favoris",          Icon: Star,     count: counts.favorites },
            { id: "today"   as View, label: "Cette semaine",    Icon: Clock,    count: counts.thisWeek  },
          ] as const
        ).map((item) => {
          const isActive = view === item.id && !activeCategory;
          return (
            <button
              key={item.id}
              onClick={() => nav(item.id)}
              className={cn(btnBase, isActive ? activeBtn : inactiveBtn)}
            >
              <item.Icon
                className={cn(
                  "w-[15px] h-[15px] shrink-0",
                  isActive ? "text-ink-700" : "text-ink-500"
                )}
              />
              <span className="tracking-tight flex-1 text-left">{item.label}</span>
              <span
                className={cn(
                  "ml-auto font-mono text-[11px]",
                  isActive ? "text-ink-500" : "text-ink-400 group-hover:text-ink-500"
                )}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary nav */}
      <div className="px-2.5 pb-2 space-y-0.5">
        {(
          [
            { id: "categories" as View, label: "Catégories",    Icon: Layers    },
            { id: "stats"      as View, label: "Statistiques",  Icon: BarChart2 },
          ] as const
        ).map((item) => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => nav(item.id)}
              className={cn(btnBase, isActive ? activeBtn : inactiveBtn)}
            >
              <item.Icon
                className={cn(
                  "w-[15px] h-[15px] shrink-0",
                  isActive ? "text-ink-700" : "text-ink-500"
                )}
              />
              <span className="tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Category list */}
      <div className="px-2.5 mt-3">
        <button
          onClick={() => setCatOpen((o) => !o)}
          className="w-full flex items-center gap-1 px-2 h-6 text-[11px] uppercase tracking-[0.08em] font-medium text-ink-500 hover:text-ink-700"
        >
          <ChevronRight
            className={cn(
              "w-[11px] h-[11px] transition-transform",
              catOpen && "rotate-90"
            )}
          />
          Catégories
        </button>

        {catOpen && (
          <div className="mt-1 space-y-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setView("inbox");
                }}
                className={cn(
                  "group w-full flex items-center gap-2.5 px-2.5 h-7 rounded-md text-[13px] transition-colors",
                  activeCategory === cat
                    ? "bg-white text-ink-950 shadow-soft"
                    : "text-ink-600 hover:bg-ink-100/70"
                )}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: CATEGORY_CONFIG[cat].dot }}
                />
                <span className="flex-1 truncate text-left">{cat}</span>
                <span className="font-mono text-[10.5px] text-ink-400">
                  {counts.byCat[cat] ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Bottom */}
      <div className="p-2.5 border-t border-ink-200/60 space-y-1.5">
        <button
          onClick={onOpenCmd}
          className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[12.5px] text-ink-600 hover:bg-ink-100 transition-colors"
        >
          <Search className="w-[14px] h-[14px] shrink-0" />
          Rechercher
          <span className="ml-auto flex gap-1">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </button>
        <div
          title="Sauvegarde une page via l'extension Chrome"
          className="w-full flex items-center gap-2 h-9 px-3 rounded-md bg-ink-950 text-white text-[13px] font-medium cursor-default select-none opacity-70"
        >
          <Plus className="w-[15px] h-[15px] shrink-0" />
          Nouveau save
        </div>
      </div>
    </aside>
  );
}
