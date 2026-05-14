"use client";

import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  right?: React.ReactNode;
  className?: string;
}

export function TopBar({ title, subtitle, breadcrumb, right, className }: TopBarProps) {
  return (
    <div
      className={cn(
        "h-14 px-8 border-b border-ink-200/70 bg-white/70 backdrop-blur sticky top-0 z-30 flex items-center",
        className
      )}
    >
      <div className="flex items-baseline gap-3 min-w-0">
        {breadcrumb && (
          <div className="text-[12px] text-ink-500 font-medium shrink-0">{breadcrumb}</div>
        )}
        <h1 className="text-[15px] font-semibold tracking-tight text-ink-950 truncate">
          {title}
        </h1>
        {subtitle && (
          <span className="text-[12.5px] text-ink-500 font-mono shrink-0">{subtitle}</span>
        )}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
