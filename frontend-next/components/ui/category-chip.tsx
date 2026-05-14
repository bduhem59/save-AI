import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG } from "@/types";

interface CategoryChipProps {
  category: string;
  dot?: boolean;
  className?: string;
}

export function CategoryChip({ category, dot = false, className }: CategoryChipProps) {
  const cfg = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG["Autre"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        cfg.bgColor,
        cfg.color,
        className
      )}
    >
      {dot ? (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: cfg.dot }}
        />
      ) : (
        <span>{cfg.emoji}</span>
      )}
      {category}
    </span>
  );
}
