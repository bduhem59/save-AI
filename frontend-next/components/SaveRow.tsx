import { Save, SOURCE_CONFIG, CATEGORY_CONFIG } from "@/types";
import { relativeDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Star } from "lucide-react";

interface SaveRowProps {
  save: Save;
  onClick: () => void;
}

export function SaveRow({ save, onClick }: SaveRowProps) {
  const srcCfg = SOURCE_CONFIG[save.source];
  const category = save.category || "Autre";
  const catCfg = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG["Autre"];

  // First line after "**TL;DR** : " is the tldr text
  const tldr = save.summary
    ? save.summary.split("\n")[0].replace(/^\*\*TL;DR\*\* : /, "")
    : "";

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50/80 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${srcCfg.bgColor} ${srcCfg.color}`}
          >
            {srcCfg.label}
          </span>
          {save.category && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${catCfg.bgColor} ${catCfg.color}`}
            >
              {catCfg.emoji} {save.category}
            </span>
          )}
          {save.relevance_score >= 5 && (
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          )}
          <span className="text-xs text-gray-400 ml-auto shrink-0">
            {relativeDate(save.created_at)}
          </span>
        </div>

        <h3 className="text-sm font-medium text-gray-900 line-clamp-1 mb-0.5">
          {save.title}
        </h3>

        {tldr && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{tldr}</p>
        )}

        {save.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {save.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <a
        href={save.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 p-1 mt-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
        onClick={(e) => e.stopPropagation()}
        title="Ouvrir la source"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
