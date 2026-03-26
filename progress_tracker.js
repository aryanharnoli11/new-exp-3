(function () {
  if (window.VLProgress) return;
  const KEY = "vlab_exp2_progress_v1";
  const VERSION = 1;
  const GENERAL_PROGRESS_KEYS = [
    "vlab_exp2_pretest_score",
    "vlab_exp2_pretest_total",
    "vlab_exp2_pretest_updated_at",
    "vlab_exp2_posttest_score",
    "vlab_exp2_posttest_total",
    "vlab_exp2_posttest_updated_at",
    "vlab_exp2_simulation_report_html",
    "vlab_exp2_simulation_report_updated_at"
  ];

  function nowISO() { return new Date().toISOString(); }
  function normalizeEmail(email) {
    if (!email || typeof email !== "string") return "";
    return email.trim().toLowerCase();
  }

  function computeUserHash(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return "";

    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    return `u${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function clearGeneralProgressKeys() {
    if (typeof localStorage === "undefined") return;
    try {
      for (const key of GENERAL_PROGRESS_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore storage failures
    }
  }

  function migrateGeneralProgressKeysToUser(userHash) {
    if (!userHash || typeof localStorage === "undefined") return;
    try {
      let movedAny = false;
      const prefix = `vlab_exp2_user_${userHash}_`;
      for (const key of GENERAL_PROGRESS_KEYS) {
        const value = localStorage.getItem(key);
        if (!value || !String(value).trim()) continue;

        const suffix = key.replace(/^vlab_exp2_/, "");
        const destKey = prefix + suffix;
        const existing = localStorage.getItem(destKey);
        if (!existing || !String(existing).trim()) {
          localStorage.setItem(destKey, value);
        }
        movedAny = true;
      }

      if (movedAny) {
        clearGeneralProgressKeys();
      }
    } catch {
      // ignore storage failures
    }
  }

  function ensureHistory(state) {
    if (!Array.isArray(state.userHistory)) state.userHistory = [];
  }

  function findHistoryEntry(state, normalizedEmail) {
    if (!normalizedEmail) return null;
    ensureHistory(state);
    return state.userHistory.find(entry => entry.email === normalizedEmail) || null;
  }

  function safeJSONParse(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }

  function loadState() {
    const raw = localStorage.getItem(KEY);
    const base = {
      version: VERSION,
      user: null,
      flags: { reportDeclined: false },
      timestamps: {
        sessionStart: null,
        aimAfterIntro: null,
        simulationStart: null,
        contributorsVisited: null,
        reportViewedAt: null
      },
      pages: {},           // { "aim.html": { firstEnter, lastExit, timeMs, visits } }
      steps: [],           // [{ name, ts, meta }]
      userHistory: []
    };
    if (!raw) return base;

    const parsed = safeJSONParse(raw, base);
    if (!parsed || typeof parsed !== "object") return base;
    if (!parsed.flags) parsed.flags = { reportDeclined: false };
    if (!parsed.timestamps) parsed.timestamps = base.timestamps;
    if (!parsed.pages) parsed.pages = {};
    if (!parsed.steps) parsed.steps = [];
    if (!Array.isArray(parsed.userHistory)) parsed.userHistory = [];
    return { ...base, ...parsed };
  }

  function recordUserHistory(state, user) {
    const normalizedEmail = normalizeEmail(user && user.email);
    if (!normalizedEmail) return false;
    ensureHistory(state);

    const now = nowISO();
    const existing = findHistoryEntry(state, normalizedEmail);
    if (existing) {
      existing.name = (user && user.name) ? user.name.trim() : "";
      existing.designation = (user && user.designation) ? user.designation.trim() : "";
      existing.lastSeen = now;
      return false;
    }

    state.userHistory.push({
      email: normalizedEmail,
      name: (user && user.name) ? user.name.trim() : "",
      designation: (user && user.designation) ? user.designation.trim() : "",
      firstSeen: now,
      lastSeen: now
    });
    return true;
  }

  function findUserByEmail(email) {
    const state = loadState();
    const normalizedEmail = normalizeEmail(email);
    const entry = findHistoryEntry(state, normalizedEmail);
    return entry ? Object.assign({}, entry) : null;
  }

  function isUserEmailNew(email) {
    return !findUserByEmail(email);
  }

  function saveState(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }

  function pageNameFromURL() {
    const p = window.location.pathname.split("/").pop();
    return p || "index.html";
  }

  function ensureSessionStart(state) {
    if (!state.timestamps.sessionStart) state.timestamps.sessionStart = nowISO();
  }

  function formatMs(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  function initPage() {
    const state = loadState();
    ensureSessionStart(state);

    const page = pageNameFromURL();
    const pageRec = state.pages[page] || { firstEnter: null, lastExit: null, timeMs: 0, visits: 0 };

    if (!pageRec.firstEnter) pageRec.firstEnter = nowISO();
    pageRec.visits += 1;

    state.pages[page] = pageRec;
    saveState(state);

    // store enter time in sessionStorage to compute time-on-page
    try {
      sessionStorage.setItem("vlab_exp2_current_page", page);
      sessionStorage.setItem("vlab_exp2_page_enter_ms", String(Date.now()));
    } catch {}

    // helpful special timestamps
    if (page === "aim.html" && !state.timestamps.aimAfterIntro) {
      // aimAfterIntro is set when intro closes (we set it from aim.html),
      // but if intro doesn't show, at least we have sessionStart + page time tracking.
    }
    if (page === "contributors.html" && !state.timestamps.contributorsVisited) {
      state.timestamps.contributorsVisited = nowISO();
      saveState(state);
    }
    if (page === "index.html" && window.location.pathname.includes("/simulation/")) {
      if (!state.timestamps.simulationStart) {
        state.timestamps.simulationStart = nowISO();
        saveState(state);
      }
    }
  }

  function recordPageExit() {
    const state = loadState();
    const page = (() => {
      try { return sessionStorage.getItem("vlab_exp2_current_page") || pageNameFromURL(); }
      catch { return pageNameFromURL(); }
    })();

    let enterMs = null;
    try {
      const s = sessionStorage.getItem("vlab_exp2_page_enter_ms");
      enterMs = s ? Number(s) : null;
    } catch {}

    const nowMs = Date.now();
    const delta = (enterMs && Number.isFinite(enterMs)) ? (nowMs - enterMs) : 0;

    const pageRec = state.pages[page] || { firstEnter: null, lastExit: null, timeMs: 0, visits: 0 };
    pageRec.timeMs = (pageRec.timeMs || 0) + Math.max(0, delta);
    pageRec.lastExit = nowISO();

    state.pages[page] = pageRec;
    saveState(state);
  }

  function logStep(name, meta = {}) {
    const state = loadState();
    ensureSessionStart(state);
    state.steps.push({ name, ts: nowISO(), meta });
    saveState(state);
  }

  function setUser(user) {
    const trimmedUser = {
      name: (user.name || "").trim(),
      email: (user.email || "").trim(),
      designation: (user.designation || "").trim()
    };
    const normalizedEmail = normalizeEmail(trimmedUser.email);
    const newHash = normalizedEmail ? computeUserHash(normalizedEmail) : "";
    let prevHash = "";
    try { prevHash = localStorage.getItem("vlab_exp2_active_user_hash") || ""; } catch {}

    const state = loadState();
    const isNewUserByEmail = recordUserHistory(state, trimmedUser);

    state.user = {
      name: trimmedUser.name,
      email: trimmedUser.email,
      designation: trimmedUser.designation,
      submittedAt: nowISO()
    };
    // once user fills form, allow report again
    state.flags.reportDeclined = false;

    try {
      if (newHash) {
        localStorage.setItem("vlab_exp2_active_user_hash", newHash);
      } else {
        localStorage.removeItem("vlab_exp2_active_user_hash");
      }
    } catch {
      // ignore storage errors
    }

    // If user details are filled after completing parts of the experiment,
    // migrate the general keys into the user-scoped keys so the Progress Report
    // still shows the recorded results.
    if (isNewUserByEmail && newHash) {
      if (!prevHash) {
        migrateGeneralProgressKeysToUser(newHash);
      } else if (prevHash && prevHash !== newHash) {
        clearGeneralProgressKeys();
      }
    } else if (newHash) {
      migrateGeneralProgressKeysToUser(newHash);
    }

    saveState(state);
  }

  function hasUser() {
    const state = loadState();
    return !!(state.user && state.user.name && state.user.email && state.user.designation);
  }

  function toEpochMs(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const d = new Date(value);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  function isReportAfterUserSubmission(updatedAt, submittedAt) {
    const submittedMs = toEpochMs(submittedAt);
    if (!Number.isFinite(submittedMs)) return true;
    const updatedMs = toEpochMs(updatedAt);
    if (!Number.isFinite(updatedMs)) return false;
    return updatedMs >= submittedMs;
  }

  function hasSimulationReport() {
    const state = loadState();
    const submittedAt = state?.user?.submittedAt || null;

    try {
      const activeHash = localStorage.getItem("vlab_exp2_active_user_hash");
      if (activeHash) {
        const key = `vlab_exp2_user_${activeHash}_simulation_report_html`;
        const html = localStorage.getItem(key);
        if (html && String(html).trim()) {
          const updatedAt = localStorage.getItem(`vlab_exp2_user_${activeHash}_simulation_report_updated_at`);
          return isReportAfterUserSubmission(updatedAt, submittedAt);
        }
        return false;
      }

      const html = localStorage.getItem("vlab_exp2_simulation_report_html");
      if (html && String(html).trim()) {
        const updatedAt = localStorage.getItem("vlab_exp2_simulation_report_updated_at");
        return isReportAfterUserSubmission(updatedAt, submittedAt);
      }
    } catch {
      // ignore storage failures
    }

    try {
      const PREFIX = "VLAB_EXP2::";
      if (typeof window.name === "string" && window.name.startsWith(PREFIX)) {
        const data = JSON.parse(window.name.slice(PREFIX.length)) || {};
        const html = (data.vlab_exp2_simulation_report_html || "").toString();
        if (html.trim()) {
          const updatedAt = data.vlab_exp2_simulation_report_updated_at || null;
          return isReportAfterUserSubmission(updatedAt, submittedAt);
        }
      }
    } catch {
      // ignore parse failures
    }

    return false;
  }

  function canAccessProgressReport() {
    return hasUser() && hasSimulationReport();
  }

  function declineReport() {
    const state = loadState();
    state.flags.reportDeclined = true;
    saveState(state);
  }

  function clearDecline() {
    const state = loadState();
    state.flags.reportDeclined = false;
    saveState(state);
  }

  function mark(key) {
    const state = loadState();
    state.timestamps[key] = nowISO();
    saveState(state);
  }

  function markReportViewed() {
    const state = loadState();
    if (!state.timestamps.reportViewedAt) state.timestamps.reportViewedAt = nowISO();
    saveState(state);
  }

  function resetAll() {
    try { localStorage.removeItem(KEY); } catch {}
    try {
      sessionStorage.removeItem("vlab_exp2_current_page");
      sessionStorage.removeItem("vlab_exp2_page_enter_ms");
    } catch {}
  }

  // attach exit handlers
  window.addEventListener("pagehide", recordPageExit);
  window.addEventListener("beforeunload", recordPageExit);

  // expose API
  window.VLProgress = {
    initPage,
    recordPageExit,
    logStep,
    setUser,
    hasUser,
    hasSimulationReport,
    canAccessProgressReport,
    declineReport,
    clearDecline,
    mark,
    markReportViewed,
    getState: loadState,
    saveState,
    formatMs,
    findUserByEmail,
    isUserEmailNew,
    resetAll
  };
})();
