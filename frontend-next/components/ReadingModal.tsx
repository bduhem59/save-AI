"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { X, ExternalLink, Heart, CheckCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceBadge } from "@/components/ui/source-badge";
import { CategoryChip } from "@/components/ui/category-chip";
import { Stars } from "@/components/ui/stars";
import { getSave, setFavorite, setRead } from "@/lib/api";
import type { Save } from "@/types";
import { cn } from "@/lib/utils";

interface Chapter {
  title: string;
  timestamp_approx: string | null;
  key_points: string[];
  key_quotes: string[];
}

interface SummaryStructured {
  mode_used?: "standard" | "enriched" | "chapters";
  tldr?: string;
  chapters?: Chapter[];
  conclusion_globale?: string;
  donnees_chiffrees?: string[];
}

interface ReadingModalProps {
  saveId: number | null;
  onClose: () => void;
  onSaveUpdated?: (id: number, changes: { is_favorite: boolean; is_read: boolean }) => void;
}

export function ReadingModal({ saveId, onClose, onSaveUpdated }: ReadingModalProps) {
  const [save, setSave] = useState<Save | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Lock scroll + Escape
  useEffect(() => {
    if (!saveId) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [saveId, onClose]);

  // Load save — getSave() déclenche touch_consulted() côté backend (last_consulted_at auto)
  useEffect(() => {
    if (!saveId) { setSave(null); return; }
    setLoading(true);
    setActiveChapter(0);
    chapterRefs.current = [];
    getSave(saveId)
      .then((s) => {
        setSave(s);
        setIsRead(s.is_read);
        setIsFavorite(s.is_favorite);
      })
      .finally(() => setLoading(false));
  }, [saveId]);

  const handleToggleFavorite = async () => {
    if (!save) return;
    const next = !isFavorite;
    setIsFavorite(next);
    onSaveUpdated?.(save.id, { is_favorite: next, is_read: isRead });
    await setFavorite(save.id, next);
  };

  const handleToggleRead = async () => {
    if (!save) return;
    const next = !isRead;
    setIsRead(next);
    onSaveUpdated?.(save.id, { is_favorite: isFavorite, is_read: next });
    await setRead(save.id, next);
  };

  if (!saveId) return null;

  const structured = (save?.metadata?.summary_structured ?? null) as SummaryStructured | null;
  const isChapters = structured?.mode_used === "chapters";
  const chapters = structured?.chapters ?? [];
  const hasTOC = isChapters && chapters.length > 0 && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pb-8">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full bg-white rounded-2xl shadow-pop overflow-hidden flex flex-col max-h-[88vh]",
          hasTOC ? "max-w-5xl" : "max-w-2xl"
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-ink-100 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            {save && <SourceBadge source={save.source} />}
            {save?.category && (
              <CategoryChip category={save.category} dot />
            )}
            {structured?.mode_used && (
              <span className="px-2 h-5 rounded text-[10.5px] font-mono bg-ink-100 text-ink-500 flex items-center">
                {structured.mode_used}
              </span>
            )}
            {save && <Stars score={save.relevance_score} max={5} />}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Favori */}
            <button
              onClick={handleToggleFavorite}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                isFavorite
                  ? "text-red-500 bg-red-50 hover:bg-red-100"
                  : "text-ink-400 hover:text-ink-700 hover:bg-ink-100"
              )}
              aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
            </button>

            {/* Lien source */}
            {save && (
              <a
                href={save.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                aria-label="Ouvrir la source"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Marquer comme lu — is_read explicite, toggle */}
            <button
              onClick={handleToggleRead}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium transition-colors",
                isRead
                  ? "bg-ink-100 text-ink-500 hover:bg-ink-200"
                  : "bg-ink-950 text-white hover:bg-ink-800"
              )}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {isRead ? "Lu" : "Marquer comme lu"}
            </button>

            {/* Fermer */}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors ml-1"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className={cn("flex-1 overflow-hidden", hasTOC ? "flex flex-row" : "flex flex-col")}>
          {/* Main scroll */}
          <div className="flex-1 overflow-y-auto stable-gutter px-6 py-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : save ? (
              <>
                <h2 className="text-[18px] font-semibold text-ink-950 leading-snug mb-5">
                  {save.title}
                </h2>

                {structured?.tldr && (
                  <div className="rounded-xl bg-ink-50 border border-ink-200/70 px-4 py-3 mb-5">
                    <span className="text-[10.5px] font-semibold text-ink-500 uppercase tracking-[0.06em]">TL;DR </span>
                    <span className="text-[13.5px] text-ink-800 leading-relaxed">{structured.tldr}</span>
                  </div>
                )}

                {isChapters && chapters.length > 0 ? (
                  <ChaptersContent
                    chapters={chapters}
                    activeIndex={activeChapter}
                    chapterRefs={chapterRefs}
                  />
                ) : (
                  <div className="text-[13.5px] text-ink-800 leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-ink-900 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-ink-900 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-[13.5px] [&_h3]:font-semibold [&_h3]:text-ink-900 [&_h3]:mt-4 [&_h3]:mb-1">
                    <ReactMarkdown>{save.summary || ""}</ReactMarkdown>
                  </div>
                )}

                {structured?.donnees_chiffrees && structured.donnees_chiffrees.length > 0 && (
                  <div className="mt-5 rounded-xl border border-ink-200/70 px-4 py-3">
                    <p className="text-[10.5px] font-semibold text-ink-500 uppercase tracking-[0.06em] mb-2">
                      Données chiffrées
                    </p>
                    <ul className="space-y-1">
                      {structured.donnees_chiffrees.map((d, i) => (
                        <li key={i} className="text-[13px] text-ink-700 flex gap-2">
                          <span className="text-amber-500 shrink-0">▸</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {structured?.conclusion_globale && (
                  <p className="mt-4 text-[13.5px] text-ink-700 leading-relaxed">
                    <span className="font-semibold text-ink-900">Conclusion : </span>
                    {structured.conclusion_globale}
                  </p>
                )}

                {save.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-6 pt-4 border-t border-ink-100">
                    {save.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 h-6 rounded-full text-[12px] font-medium bg-ink-100 text-ink-600 flex items-center"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-[11.5px] text-ink-400 font-mono mt-4">
                  {new Date(save.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                  {save.claude_cost_eur > 0 && (
                    <span className="ml-3">€{save.claude_cost_eur.toFixed(4)}</span>
                  )}
                </p>
              </>
            ) : null}
          </div>

          {/* TOC sidebar (chapitres seulement) */}
          {hasTOC && (
            <aside className="w-52 shrink-0 border-l border-ink-100 overflow-y-auto bg-ink-50/50 px-3 py-5">
              <p className="text-[10.5px] font-semibold text-ink-400 uppercase tracking-[0.08em] px-2 mb-2">
                Chapitres
              </p>
              <nav className="space-y-0.5">
                {chapters.map((ch, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setActiveChapter(i);
                      chapterRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded-md text-[12px] leading-snug transition-colors",
                      activeChapter === i
                        ? "bg-white text-ink-950 shadow-soft font-medium"
                        : "text-ink-500 hover:text-ink-800 hover:bg-ink-100"
                    )}
                  >
                    <span className="font-mono text-[10px] text-ink-400 mr-1">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {ch.title}
                    {ch.timestamp_approx && (
                      <span className="block font-mono text-[10px] text-ink-400 mt-0.5">
                        {ch.timestamp_approx}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chapitres ─────────────────────────────────────────────────────────────────

function ChaptersContent({
  chapters,
  activeIndex,
  chapterRefs,
}: {
  chapters: Chapter[];
  activeIndex: number;
  chapterRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}) {
  return (
    <div className="space-y-4">
      {chapters.map((ch, i) => (
        <div
          key={i}
          ref={(el) => { chapterRefs.current[i] = el; }}
          className={cn(
            "rounded-xl border transition-colors",
            i === activeIndex ? "border-ink-300 bg-white" : "border-ink-100 bg-ink-50/40"
          )}
        >
          <div className="flex items-baseline gap-2 px-4 pt-3.5 pb-2">
            <span className="font-mono text-[10.5px] text-ink-400 shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="text-[13.5px] font-semibold text-ink-900 leading-snug flex-1">{ch.title}</h3>
            {ch.timestamp_approx && (
              <span className="font-mono text-[10.5px] text-ink-400 shrink-0">{ch.timestamp_approx}</span>
            )}
          </div>
          <div className="px-4 pb-4 space-y-2.5">
            {ch.key_points?.length > 0 && (
              <ul className="space-y-1.5">
                {ch.key_points.map((kp, j) => (
                  <li key={j} className="flex gap-2 text-[13px] text-ink-700">
                    <span className="text-ink-400 mt-0.5 shrink-0">·</span>
                    <span>{kp}</span>
                  </li>
                ))}
              </ul>
            )}
            {ch.key_quotes?.length > 0 && (
              <div className="space-y-1.5">
                {ch.key_quotes.map((kq, j) => (
                  <blockquote key={j} className="border-l-2 border-ink-200 pl-3 text-[12.5px] text-ink-500 italic">
                    &ldquo;{kq}&rdquo;
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
