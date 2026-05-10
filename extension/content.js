// content.js — injecté dans toutes les pages web (http:// et https://)
//
// Deux types de messages :
//   "check"   → vérification rapide de compatibilité (<100ms, sans extraire le contenu)
//   "extract" → extraction complète, routée selon la source détectée

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.action === "check") {
    sendResponse(checkCompatibility());
    return;
  }

  if (msg.action === "extract") {
    const url = window.location.href;

    // YouTube — async (clic bouton transcript + attente panneau)
    if (/youtube\.com\/watch/.test(url)) {
      extractYoutube()
        .then(sendResponse)
        .catch(e => sendResponse({ content: null, error: e.message }));
      return true; // garder le canal ouvert pour la réponse async
    }

    // Reddit et Article — synchrones
    try {
      if (/reddit\.com\/r\/[^/]+\/comments\//.test(url)) {
        sendResponse(extractReddit());
      } else {
        sendResponse(extractArticle());
      }
    } catch (e) {
      sendResponse({ content: null, error: e.message });
    }
    return true;
  }

});

// ─── Extraction YouTube ───────────────────────────────────────────────────────

async function extractYoutube() {
  console.log("[YouTube] Extraction started");

  const url      = window.location.href;
  const videoId  = url.match(/[?&]v=([^&]+)/)?.[1] || null;

  // Métadonnées — plusieurs sélecteurs pour couvrir les variantes de layout
  const title = (
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent ||
    document.querySelector("h1.ytd-video-primary-info-renderer yt-formatted-string")?.textContent ||
    document.title.replace(/ - YouTube$/, "")
  ).trim();

  const channel = (
    document.querySelector("ytd-channel-name yt-formatted-string a")?.textContent ||
    document.querySelector("#channel-name a")?.textContent ||
    document.querySelector("#owner #channel-name a")?.textContent ||
    "Chaîne inconnue"
  ).trim();

  const duration = document.querySelector(".ytp-time-duration")?.textContent?.trim() || null;

  // Cas 1 : transcript déjà ouvert dans le DOM (popup re-ouverte, panneau visible)
  const existingSegments = document.querySelectorAll("ytd-transcript-segment-renderer");
  if (existingSegments.length > 0) {
    console.log(`[YouTube] Transcript already open, found ${existingSegments.length} segments`);
    return buildYoutubePayload(existingSegments, title, channel, duration, videoId, url);
  }

  // Cas 2 : chercher et cliquer le bouton transcript
  const btn = findTranscriptButton();
  if (!btn) {
    console.log("[YouTube] Transcript button not found");
    return { content: null, error: "no_transcript" };
  }

  console.log("[YouTube] Transcript button found, clicking...");
  btn.click();

  // Attendre l'apparition du panneau transcript (max 3 s)
  const firstSegment = await waitForElement("ytd-transcript-segment-renderer", 3000);
  if (!firstSegment) {
    console.log("[YouTube] Transcript panel did not open within 3s");
    return { content: null, error: "panel_timeout" };
  }

  const segments = document.querySelectorAll("ytd-transcript-segment-renderer");
  console.log(`[YouTube] Transcript panel opened, found ${segments.length} segments`);

  return buildYoutubePayload(segments, title, channel, duration, videoId, url);
}

function findTranscriptButton() {
  // Priorité 1 : section transcript dans la description (YouTube Desktop 2024+)
  const sectionBtn = document.querySelector(
    "ytd-video-description-transcript-section-renderer button, " +
    "ytd-video-description-transcript-section-renderer yt-button-shape button"
  );
  if (sectionBtn) return sectionBtn;

  // Priorité 2 : bouton avec aria-label contenant "transcript"
  const labelBtn =
    document.querySelector('button[aria-label*="transcript" i]') ||
    document.querySelector('yt-button-shape button[aria-label*="transcript" i]');
  if (labelBtn) return labelBtn;

  // Priorité 3 : renderer dédié (layout plus ancien)
  const rendererBtn = document.querySelector("ytd-transcript-button-renderer button");
  if (rendererBtn) return rendererBtn;

  return null;
}

function buildYoutubePayload(segments, title, channel, duration, videoId, url) {
  const text = Array.from(segments)
    .map(seg =>
      seg.querySelector("yt-formatted-string.segment-text, .segment-text")?.textContent?.trim() || ""
    )
    .filter(t => t.length > 0)
    .join(" ");

  console.log(`[YouTube] Returning payload with ${text.length} characters`);

  if (text.length < 100) {
    return { content: null, error: "transcript_too_short" };
  }

  return { title, author: null, content: text, url, channel, duration, videoId };
}

async function waitForElement(selector, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

// ─── Extraction Reddit ────────────────────────────────────────────────────────

function extractReddit() {
  console.log("[Reddit] Reddit extraction started");

  const url = window.location.href;

  // Subreddit depuis l'URL (source de vérité la plus fiable)
  const subMatch = url.match(/reddit\.com\/r\/([^/]+)\//);
  const subreddit = subMatch ? `r/${subMatch[1]}` : null;

  // ── Post principal ──────────────────────────────────────────────────────────
  let postTitle   = document.title || "";
  let postAuthor  = null;
  let postContent = "";

  const shredditPost = document.querySelector("shreddit-post");
  if (shredditPost) {
    postTitle   = shredditPost.getAttribute("post-title") || postTitle;
    postAuthor  = shredditPost.getAttribute("author") || null;
    const textBody = shredditPost.querySelector("[slot='text-body'], .md");
    postContent = textBody?.textContent?.trim() || "";
  } else {
    const bodyEl = document.querySelector(
      "[data-click-id='text'] .RichTextJSON-root, .Post .RichTextJSON-root"
    );
    if (bodyEl) postContent = bodyEl.textContent.trim();
    const authorEl = document.querySelector("[data-testid='post_author_link'], a[href*='/user/']");
    if (authorEl) postAuthor = authorEl.textContent.replace(/^u\//, "").trim();
  }

  // ── Commentaires : 3 stratégies par ordre de priorité ──────────────────────
  let elements = [];
  let strategy  = "none";

  const shredditEls = document.querySelectorAll("shreddit-comment");
  if (shredditEls.length > 0) { elements = Array.from(shredditEls); strategy = "shreddit"; }

  if (elements.length === 0) {
    const newEls = document.querySelectorAll("[data-testid='comment']");
    if (newEls.length > 0) { elements = Array.from(newEls); strategy = "new-reddit"; }
  }

  if (elements.length === 0) {
    const oldEls = document.querySelectorAll(".comment.thing:not(.deleted)");
    if (oldEls.length > 0) { elements = Array.from(oldEls); strategy = "old-reddit"; }
  }

  console.log(`[Reddit] Found ${elements.length} comment elements (strategy: ${strategy})`);

  const rawComments = elements.map(el => {
    try {
      if (strategy === "shreddit") {
        const author = el.getAttribute("author") || "?";
        const score  = parseInt(el.getAttribute("score") ?? "0") || 0;
        const level  = parseInt(el.getAttribute("depth") ?? el.getAttribute("data-depth") ?? "0") || 0;
        const textEl = el.querySelector("[slot='comment'], [slot='comment-content'], .md");
        const text   = textEl?.textContent?.trim() || "";
        return { author, score, level, text };
      }
      if (strategy === "new-reddit") {
        const authorEl = el.querySelector("a[href*='/user/']");
        const author   = authorEl?.textContent?.replace(/^u\//, "").trim() || "?";
        const textEl   = el.querySelector(".RichTextJSON-root");
        const text     = textEl?.textContent?.trim() || "";
        return { author, score: 0, level: 0, text };
      }
      if (strategy === "old-reddit") {
        const author   = el.querySelector(".author")?.textContent?.trim() || "?";
        const scoreEl  = el.querySelector(".score.unvoted, .score.likes");
        const score    = parseInt(scoreEl?.getAttribute("title") ?? "0") || 0;
        const depthCls = el.closest("[class*='depth-']")?.className?.match(/depth-(\d+)/);
        const level    = depthCls ? parseInt(depthCls[1]) : 0;
        const textEl   = el.querySelector(".usertext-body .md");
        const text     = textEl?.textContent?.trim() || "";
        return { author, score, level, text };
      }
    } catch (_) { /* ignorer les commentaires cassés individuellement */ }
    return null;
  }).filter(Boolean);

  const filtered = rawComments.filter(c => c.text && c.text.length >= 30);

  console.log(`[Reddit] ${filtered.length} comments after filtering (from ${rawComments.length})`);
  console.log(`[Reddit] Returning payload with ${filtered.length} comments, subreddit: ${subreddit}`);

  return {
    title:         postTitle,
    author:        postAuthor,
    content:       postContent || `[Post Reddit sur ${subreddit}]`,
    url:           window.location.href,
    subreddit,
    comments:      filtered,
    commentsTotal: elements.length,
  };
}

// ─── Extraction Article (Readability) ────────────────────────────────────────

function extractArticle() {
  const docClone = document.cloneNode(true);
  const reader   = new Readability(docClone);
  const article  = reader.parse();

  if (!article || !article.textContent || article.textContent.trim().length < 100) {
    return { content: null, error: "scraper_broken" };
  }

  return {
    title:   article.title  || document.title || null,
    author:  article.byline || null,
    content: article.textContent.trim(),
    url:     window.location.href,
  };
}

// ─── Vérification rapide de compatibilité ────────────────────────────────────

function checkCompatibility() {
  const url = window.location.href;

  // ── Toute page YouTube (matcher large d'abord) ─────────────────────────────
  if (/youtube\.com/.test(url)) {
    // Shorts : jamais de transcript
    if (/youtube\.com\/shorts\//.test(url)) {
      return { status: "incompatible", label: "YouTube Shorts — pas de transcript", source: "youtube", disableSave: true };
    }
    // Pages non-vidéo (homepage, chaîne, playlists…)
    if (!/youtube\.com\/watch/.test(url)) {
      return { status: "incompatible", label: "Page YouTube non supportée (pas une vidéo)", source: "youtube", disableSave: true };
    }

    // Page vidéo — transcript déjà ouvert ?
    if (document.querySelector("ytd-transcript-segment-renderer")) {
      return { status: "ok", label: "Vidéo YouTube · transcript ouvert", source: "youtube", disableSave: false };
    }

    // Bouton transcript détectable dans le DOM ?
    const hasBtn = !!document.querySelector(
      "ytd-video-description-transcript-section-renderer, " +
      "ytd-transcript-button-renderer, " +
      'button[aria-label*="transcript" i]'
    );
    if (hasBtn) {
      return { status: "ok", label: "Vidéo YouTube · transcript disponible", source: "youtube", disableSave: false };
    }

    // Vidéo mais bouton pas encore chargé (page en cours de rendu)
    return { status: "partial", label: "Vidéo YouTube · vérification du transcript", source: "youtube", disableSave: false };
  }

  // ── Reddit ─────────────────────────────────────────────────────────────────
  if (/reddit\.com\/r\/[^/]+\/comments\//.test(url)) {
    const n =
      document.querySelectorAll("shreddit-comment").length ||
      document.querySelectorAll("[data-testid='comment']").length ||
      document.querySelectorAll(".Comment").length;
    const countStr = n > 0
      ? `${n} commentaire${n > 1 ? "s" : ""} visible${n > 1 ? "s" : ""}`
      : "commentaires";
    return { status: "ok", label: `Post Reddit · ${countStr}`, source: "reddit", disableSave: false };
  }

  // ── Article ────────────────────────────────────────────────────────────────
  return checkArticle();
}

function checkArticle() {
  const wordCount = estimateWordCount();
  const paywallSelectors = [
    ".paywall", ".subscriber-wall", ".piano-container", ".tp-modal",
    "[id*='paywall']", "[class*='paywall']", "[class*='metered-content']",
    "[id*='subscriber-only']", ".lePaywall", ".premium-lock", "[class*='piano-']",
  ];
  const hasPaywall = paywallSelectors.some(sel => {
    try { return !!document.querySelector(sel); } catch { return false; }
  });

  if (wordCount < 80)  return { status: "incompatible", label: "Pas de contenu lisible détecté",     source: "article", disableSave: true  };
  if (hasPaywall)      return { status: "partial",      label: "Paywall détecté, qualité incertaine", source: "article", disableSave: false };
  if (wordCount < 200) return { status: "partial",      label: `Article court (~${wordCount} mots)`,  source: "article", disableSave: false };
  return               { status: "ok",           label: `Article détecté (~${wordCount} mots)`,  source: "article", disableSave: false };
}

function estimateWordCount() {
  const selectors = ["article", "main", "[role='main']", ".post-content", ".article-body", ".entry-content", ".article-content"];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const count = (el.textContent || "").trim().split(/\s+/).filter(w => w.length > 2).length;
      if (count > 20) return count;
    }
  }
  return (document.body?.textContent || "").substring(0, 8000).trim().split(/\s+/).filter(w => w.length > 2).length;
}
