// popup.js — logique de la popup Save & Resurface
// Flux : popup → content script (check compat + extraction Readability) → backend FastAPI

const BACKEND_SAVE_URL = "http://localhost:8000/save";

// Détection de secours basée sur l'URL (utilisée si le check content script expire)
function detectSourceFromUrl(url) {
  if (/youtube\.com\/watch/.test(url))               return "youtube";
  if (/reddit\.com\/r\/[^/]+\/comments\//.test(url)) return "reddit";
  return "article";
}

const btnSave   = document.getElementById("btn-save");
const statusEl  = document.getElementById("status");
const titleEl   = document.getElementById("page-title");
const compatDot = document.getElementById("compat-dot");
const compatLbl = document.getElementById("compat-label");

// Source détectée lors du check (utilisée dans le payload POST)
let detectedSource = "article";

// --- Helpers UI ---

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type; // "info" | "success" | "error"
}

function setLoading(on) {
  btnSave.disabled = on;
  btnSave.textContent = on ? "Sauvegarde en cours…" : "Sauvegarder";
}

function setSaved() {
  btnSave.disabled = true;
  btnSave.textContent = "Sauvegardé ✓";
}

function updateCompatUI(status, label, disableSave) {
  compatDot.className = `compat-dot ${status}`;
  compatLbl.textContent = label;
  btnSave.disabled = disableSave;
}

// --- Vérification de compatibilité au chargement de la popup ---

async function runCompatibilityCheck() {
  let tabs;
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    updateCompatUI("incompatible", "Impossible d'accéder à l'onglet", true);
    return;
  }

  const tab = tabs[0];
  const url = tab?.url || "";

  // Pages spéciales inaccessibles aux content scripts — détectable sans eux
  const specialPrefixes = ["chrome://", "chrome-extension://", "about:", "file://", "data:"];
  if (specialPrefixes.some(p => url.startsWith(p))) {
    const scheme = url.split("://")[0] || "inconnu";
    updateCompatUI("incompatible", `Page ${scheme}:// — non accessible`, true);
    return;
  }

  // Demander le check rapide au content script (timeout 250ms)
  let result;
  try {
    const checkPromise = chrome.tabs.sendMessage(tab.id, { action: "check" });
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 700));
    result = await Promise.race([checkPromise, timeout]);
  } catch (e) {
    // Content script non chargé : onglet ouvert avant installation de l'extension
    updateCompatUI("partial", "Recharge la page (F5) pour activer la détection", false);
    return;
  }

  if (!result) {
    detectedSource = detectSourceFromUrl(url); // B1 : fallback URL, évite source:"article" par défaut
    updateCompatUI("partial", "Détection expirée — essaie quand même", false);
    return;
  }

  detectedSource = result.source || "article";
  updateCompatUI(result.status, result.label, result.disableSave);
}

// --- Initialisation ---

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const t = tabs[0]?.title || "(titre indisponible)";
  titleEl.textContent = t;
  titleEl.title = t;
});

runCompatibilityCheck();

// --- Clic sur Save ---

btnSave.addEventListener("click", async () => {
  setLoading(true);
  showStatus("Extraction du contenu…", "info");

  // 1. Récupérer l'onglet actif
  let tabs;
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    showStatus("Erreur : impossible d'accéder à l'onglet.", "error");
    setLoading(false);
    return;
  }

  const tab = tabs[0];

  // 2. Extraction complète via Readability (content script)
  let extracted;
  try {
    const extractPromise = chrome.tabs.sendMessage(tab.id, { action: "extract" });
    const extractTimeout  = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("extract_timeout")), 10000)
    );
    extracted = await Promise.race([extractPromise, extractTimeout]);
  } catch (e) {
    if (e.message === "extract_timeout") {
      showStatus("La page n'a pas répondu à temps — réessaie ou recharge la page.", "error");
    } else {
      showStatus(
        "Impossible d'accéder à cette page. Si l'onglet était ouvert avant l'installation, recharge la page (F5).",
        "error"
      );
    }
    setLoading(false);
    return;
  }

  // 3. Garde-fou : contenu extrait insuffisant → ne pas envoyer au backend
  if (!extracted || !extracted.content) {
    const ytErrors = {
      "no_transcript":        "Cette vidéo n'a pas de transcript disponible. C'est courant, ce n'est pas un bug.",
      "panel_timeout":        "Le panneau transcript n'a pas pu s'ouvrir. Sélecteurs probablement obsolètes.",
      "transcript_too_short": "Transcript trop court ou vide — cette vidéo ne peut pas être sauvegardée.",
    };
    const errMsg =
      ytErrors[extracted?.error] ||
      (extracted?.error === "scraper_broken"
        ? "Scraper cassé sur cette page (layout non standard, paywall, SPA)."
        : "Impossible d'extraire le contenu de cette page.");
    showStatus(errMsg, "error");
    setLoading(false);
    return;
  }

  // Garde-fou Reddit : 0 commentaire extrait = sélecteurs CSS obsolètes
  if (detectedSource === "reddit" && !(extracted.comments?.length)) {
    showStatus(
      "Aucun commentaire extrait — sélecteurs CSS probablement obsolètes. Vérifie la console (F12).",
      "error"
    );
    setLoading(false);
    return;
  }

  showStatus("Envoi au backend…", "info");

  // 4. POST vers le backend — source = détectée par le check
  const payload = {
    source: detectedSource,
    url: extracted.url || tab.url,
    title: extracted.title || tab.title || "(sans titre)",
    content: extracted.content,
    metadata: {
      author:    extracted.author    || null,
      subreddit: extracted.subreddit || null,
      channel:   extracted.channel   || null,
      duration:  extracted.duration  || null,
      video_id:  extracted.videoId   || null,
    },
    comments: extracted.comments || [],
  };

  try {
    const res = await fetch(BACKEND_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch (_) { /* ignore */ }
      showStatus(`Erreur backend ${res.status} : ${detail}`, "error");
      setLoading(false);
      return;
    }

    const data = await res.json();

    if (data.duplicate) {
      showStatus("Déjà sauvegardé ✓ (doublon détecté, synthèse conservée)", "success");
    } else if (data.status === "processing") {
      showStatus("Sauvegardé ✓ — synthèse en cours…", "success");
    } else {
      const tagsStr = data.tags?.length ? data.tags.join(", ") : "—";
      showStatus(`Saved ✓  Score ${data.relevance_score}/5 · Tags : ${tagsStr}`, "success");
    }
    setSaved();
    return;
  } catch (e) {
    if (e instanceof TypeError && e.message.includes("fetch")) {
      showStatus(
        "Backend non joignable — lance : uv run uvicorn backend.app:app --reload --port 8000",
        "error"
      );
    } else {
      showStatus(`Erreur inattendue : ${e.message}`, "error");
    }
  }

  setLoading(false);
});
