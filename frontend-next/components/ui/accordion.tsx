"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItemData {
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItemData[];
  defaultOpen?: number[];
}

export function Accordion({ items, defaultOpen = [0] }: AccordionProps) {
  const [open, setOpen] = useState<Set<number>>(new Set(defaultOpen));

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
      {items.map((item, i) => (
        <div key={i}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            onClick={() => toggle(i)}
          >
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-sm font-medium text-gray-900">{item.title}</span>
              {item.subtitle && (
                <span className="ml-2 text-xs text-gray-400 font-mono shrink-0">
                  {item.subtitle}
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200",
                open.has(i) && "rotate-180"
              )}
            />
          </button>
          {open.has(i) && (
            <div className="px-4 pb-4 pt-2 bg-gray-50/50">{item.children}</div>
          )}
        </div>
      ))}
    </div>
  );
}
