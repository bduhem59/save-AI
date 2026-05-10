"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, BookmarkCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getStats } from "@/lib/api";

interface HeaderProps {
  onSearch: (q: string) => void;
}

export function Header({ onSearch }: HeaderProps) {
  const [totalSaves, setTotalSaves] = useState<number | null>(null);
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    getStats()
      .then((s) => {
        setTotalSaves(s.total_saves);
        setTotalCost(s.claude_cost_eur_total);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch(searchValue.trim());
    },
    [searchValue, onSearch]
  );

  const handleClear = () => {
    setSearchValue("");
    onSearch("");
  };

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
            <BookmarkCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 hidden sm:block">Save &amp; Resurface</span>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 max-w-sm relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Rechercher…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-8 pr-8"
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </form>

        <div className="ml-auto text-xs text-gray-400 shrink-0 hidden sm:block">
          {totalSaves !== null && (
            <span>
              {totalSaves} save{totalSaves > 1 ? "s" : ""} ·{" "}
              {totalCost !== null ? `${totalCost.toFixed(2)}€` : ""}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
