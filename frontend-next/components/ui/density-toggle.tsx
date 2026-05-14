"use client";

import { LayoutList, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type Density = "list" | "grid";

interface DensityToggleProps {
  value: Density;
  onChange: (d: Density) => void;
  className?: string;
}

export function DensityToggle({ value, onChange, className }: DensityToggleProps) {
  return (
    <div className={cn("flex items-center rounded-lg border border-ink-200 p-0.5 gap-0.5", className)}>
      {(["list", "grid"] as Density[]).map((d) => {
        const Icon = d === "list" ? LayoutList : LayoutGrid;
        return (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
              value === d
                ? "bg-ink-950 text-white"
                : "text-ink-400 hover:text-ink-700"
            )}
            aria-label={d === "list" ? "Vue liste" : "Vue grille"}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}
