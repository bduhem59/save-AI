import { Save } from "@/types";
import { SourceBadge } from "@/components/ui/source-badge";
import { CategoryChip } from "@/components/ui/category-chip";
import { Stars } from "@/components/ui/stars";
import { Pill } from "@/components/ui/pill";
import { ExternalLink } from "lucide-react";
import { relativeDate } from "@/lib/utils";

interface SaveCardProps {
  save: Save;
  onClick: () => void;
}

export function SaveCard({ save, onClick }: SaveCardProps) {
  const category = save.category || "Autre";
  const tldr = save.summary
    ? save.summary.split("\n")[0].replace(/^\*\*TL;DR\*\* : /, "")
    : "";

  return (
    <div
      className="flex flex-col gap-2.5 p-4 bg-white rounded-xl border border-ink-200 hover:shadow-pop cursor-pointer transition-all hover:-translate-y-0.5"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge source={save.source} />
          <CategoryChip category={category} />
        </div>
        <a
          href={save.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1 rounded hover:bg-ink-100 text-ink-400 hover:text-ink-700 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-ink-950 line-clamp-2 leading-snug">
        {save.title}
      </h3>

      {/* TL;DR */}
      {tldr && (
        <p className="text-xs text-ink-500 line-clamp-3 leading-relaxed">{tldr}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex flex-wrap gap-1">
          {save.tags?.slice(0, 3).map((tag) => (
            <Pill key={tag} variant="muted">{tag}</Pill>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {save.relevance_score > 0 && (
            <Stars score={save.relevance_score} max={5} />
          )}
          <span className="text-xs text-ink-400">{relativeDate(save.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
