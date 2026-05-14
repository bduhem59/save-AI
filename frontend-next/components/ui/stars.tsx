import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarsProps {
  score: number;
  max?: number;
  className?: string;
}

export function Stars({ score, max = 5, className }: StarsProps) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i < score ? "fill-amber-400 text-amber-400" : "fill-ink-200 text-ink-200"
          )}
        />
      ))}
    </span>
  );
}
