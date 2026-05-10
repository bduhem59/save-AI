export type Source = "article" | "reddit" | "youtube";

export type Category =
  | "IA"
  | "Tech & Dev"
  | "Business"
  | "Productivité"
  | "Sport"
  | "Société"
  | "Culture"
  | "Autre";

export const CATEGORIES: Category[] = [
  "IA",
  "Tech & Dev",
  "Business",
  "Productivité",
  "Sport",
  "Société",
  "Culture",
  "Autre",
];

export const CATEGORY_CONFIG: Record<
  Category,
  { emoji: string; color: string; bgColor: string }
> = {
  "IA":           { emoji: "🤖", color: "text-violet-700",  bgColor: "bg-violet-50"  },
  "Tech & Dev":   { emoji: "💻", color: "text-sky-700",     bgColor: "bg-sky-50"     },
  "Business":     { emoji: "💼", color: "text-amber-700",   bgColor: "bg-amber-50"   },
  "Productivité": { emoji: "⚡", color: "text-emerald-700", bgColor: "bg-emerald-50" },
  "Sport":        { emoji: "🏃", color: "text-blue-700",    bgColor: "bg-blue-50"    },
  "Société":      { emoji: "🌍", color: "text-orange-700",  bgColor: "bg-orange-50"  },
  "Culture":      { emoji: "🎨", color: "text-pink-700",    bgColor: "bg-pink-50"    },
  "Autre":        { emoji: "📌", color: "text-gray-600",    bgColor: "bg-gray-100"   },
};

export const SOURCE_CONFIG: Record<
  Source,
  { label: string; color: string; bgColor: string }
> = {
  article: { label: "Article", color: "text-indigo-700", bgColor: "bg-indigo-50" },
  reddit:  { label: "Reddit",  color: "text-orange-700", bgColor: "bg-orange-50" },
  youtube: { label: "YouTube", color: "text-red-700",    bgColor: "bg-red-50" },
};

export interface Save {
  id: number;
  url: string;
  source: Source;
  title: string;
  summary: string;
  tags: string[];
  relevance_score: number;
  category: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  last_consulted_at: string | null;
  claude_cost_eur: number;
}

export interface Stats {
  total_saves: number;
  by_source: Record<string, number>;
  by_category: Record<string, number>;
  claude_cost_eur_total: number;
  claude_tokens_total: number;
  top_tags: { tag: string; count: number }[];
  by_week: { week: string; count: number }[];
}
