import { Save } from "@/types";
import { SourceBadge } from "@/components/ui/source-badge";
import { CategoryChip } from "@/components/ui/category-chip";
import { Stars } from "@/components/ui/stars";
import { Pill } from "@/components/ui/pill";
import { ExternalLink } from "lucide-react";
import { relativeDate } from "@/lib/utils";

interface SaveRowProps {
  save: Save;
  onClick: () => void;
}

export function SaveRow({ save, onClick }: SaveRowProps) {
  const category = save.category || "Autre";
  const tldr = save.summary
    ? save.summary.split("\n")[0].replace(/^\*\*TL;DR\*\* : /, "")
    : "";

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-ink-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <SourceBadge source={save.source} />
          {save.category && <CategoryChip category={category} />}
          <span className="text-xs text-ink-400 ml-auto shrink-0">
            {relativeDate(save.created_at)}
          </span>
        </div>

        <h3 className="text-sm font-medium text-ink-950 line-clamp-1 mb-0.5">
          {save.title}
        </h3>

        {tldr && (
          <p className="text-xs text-ink-500 line-clamp-2 leading-relaxed">{tldr}</p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {save.tags?.slice(0, 5).map((tag) => (
            <Pill key={tag} variant="muted">{tag}</Pill>
          ))}
          {save.relevance_score > 0 && (
            <Stars score={save.relevance_score} max={5} className="ml-auto" />
          )}
        </div>
      </div>

      <a
        href={save.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 p-1 mt-0.5 rounded hover:bg-ink-100 text-ink-400 hover:text-ink-600 transition-colors"
        onClick={(e) => e.stopPropagation()}
        title="Ouvrir la source"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
