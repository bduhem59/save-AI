"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { ExternalLink, Star } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion } from "@/components/ui/accordion";
import { getSave, markConsulted } from "@/lib/api";
import { Save, SOURCE_CONFIG, CATEGORY_CONFIG } from "@/types";

// ── Types locaux pour le JSON structuré ──────────────────────────────────────

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

// ── Composant ────────────────────────────────────────────────────────────────

interface SaveDetailProps {
  saveId: number | null;
  onClose: () => void;
}

export function SaveDetail({ saveId, onClose }: SaveDetailProps) {
  const [save, setSave] = useState<Save | null>(null);
  const [loading, setLoading] = useState(false);
  const [consulted, setConsulted] = useState(false);

  useEffect(() => {
    if (!saveId) return;
    setLoading(true);
    setSave(null);
    setConsulted(false);
    getSave(saveId)
      .then(setSave)
      .finally(() => setLoading(false));
  }, [saveId]);

  const handleConsult = async () => {
    if (!saveId || consulted) return;
    await markConsulted(saveId, "read");
    setConsulted(true);
  };

  const category = save?.category || "Autre";
  const catCfg = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG["Autre"];
  const srcCfg = save ? SOURCE_CONFIG[save.source] : null;

  // Données structurées stockées dans metadata par le backend
  const structured = (save?.metadata?.summary_structured ?? null) as SummaryStructured | null;
  const isChapters = structured?.mode_used === "chapters";

  return (
    <Dialog open={!!saveId} onClose={onClose}>
      <div className="p-6">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 pr-6">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <div className="space-y-2 mt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        )}

        {save && (
          <>
            {/* Title */}
            <h2 className="text-base font-semibold text-gray-900 pr-8 mb-3 leading-snug">
              {save.title}
            </h2>

            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {srcCfg && (
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${srcCfg.bgColor} ${srcCfg.color}`}
                >
                  {srcCfg.label}
                </span>
              )}
              {save.category && (
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${catCfg.bgColor} ${catCfg.color}`}
                >
                  {catCfg.emoji} {save.category}
                </span>
              )}
              {structured?.mode_used && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                  {structured.mode_used}
                </span>
              )}
              {save.relevance_score > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-gray-400">
                  {Array.from({ length: save.relevance_score }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </span>
              )}
              <a
                href={save.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                Source <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* ── Summary content ── */}
            {isChapters && structured ? (
              <ChaptersView structured={structured} />
            ) : (
              <div className="markdown-body text-sm text-gray-700 leading-relaxed mb-5">
                <ReactMarkdown>{save.summary || ""}</ReactMarkdown>
              </div>
            )}

            {/* Tags */}
            {save.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {save.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {new Date(save.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <Button
                variant={consulted ? "secondary" : "default"}
                size="sm"
                onClick={handleConsult}
                disabled={consulted}
              >
                {consulted ? "Lu ✓" : "Marquer comme lu"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

// ── Vue chapitres ─────────────────────────────────────────────────────────────

function ChaptersView({ structured }: { structured: SummaryStructured }) {
  const chapters = structured.chapters ?? [];

  return (
    <div className="space-y-4 mb-5">
      {/* TL;DR global */}
      {structured.tldr && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-gray-700 leading-relaxed">
          <span className="font-semibold text-indigo-700">TL;DR </span>
          {structured.tldr}
        </div>
      )}

      {/* Chapitres en accordéon */}
      {chapters.length > 0 && (
        <Accordion
          items={chapters.map((ch) => ({
            title: ch.title,
            subtitle: ch.timestamp_approx,
            children: (
              <div className="space-y-3">
                {/* Points clés */}
                {ch.key_points?.length > 0 && (
                  <ul className="space-y-1.5">
                    {ch.key_points.map((kp, j) => (
                      <li key={j} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-indigo-400 mt-0.5 shrink-0 font-bold">·</span>
                        <span>{kp}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Citations */}
                {ch.key_quotes?.length > 0 && (
                  <div className="space-y-1.5">
                    {ch.key_quotes.map((kq, j) => (
                      <blockquote
                        key={j}
                        className="border-l-2 border-indigo-200 pl-3 text-sm text-gray-500 italic"
                      >
                        &ldquo;{kq}&rdquo;
                      </blockquote>
                    ))}
                  </div>
                )}
              </div>
            ),
          }))}
        />
      )}

      {/* Données chiffrées */}
      {structured.donnees_chiffrees && structured.donnees_chiffrees.length > 0 && (
        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Données chiffrées
          </p>
          <ul className="space-y-1">
            {structured.donnees_chiffrees.map((d, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-amber-500 shrink-0">▸</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conclusion globale */}
      {structured.conclusion_globale && (
        <div className="text-sm text-gray-700 leading-relaxed pt-1">
          <span className="font-semibold">Conclusion globale : </span>
          {structured.conclusion_globale}
        </div>
      )}
    </div>
  );
}
