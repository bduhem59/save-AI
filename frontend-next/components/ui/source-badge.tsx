import { cn } from "@/lib/utils";
import { Source, SOURCE_CONFIG } from "@/types";

interface SourceBadgeProps {
  source: Source;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        cfg.bgColor,
        cfg.color,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
