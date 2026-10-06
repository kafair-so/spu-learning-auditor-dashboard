(() => {
  const cfg = window.OOE_AUTH_CONFIG || {};
  const loginPage = "login.html";
  let renewalPromise = null;
  let renewalTimer = null;

  function decodeJwt(token) {
    try {
      const part = token.split(".")[1];
      if (!part) return null;
      const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
      const json = decodeURIComponent(
        atob(padded)
          .split("")
          .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function isConfigured() {
    return Boolean(
      cfg.googleClientId &&
      !cfg.googleClientId.includes("PASTE_GOOGLE_OAUTH_CLIENT_ID_HERE")
    );
  }

  function validateCredential(token) {
    if (!token || !isConfigured()) return null;
    const p = decodeJwt(token);
    if (!p) return null;

    const now = Math.floor(Date.now() / 1000);
    const email = String(p.email || "").toLowerCase();
    const domain = String(cfg.allowedDomain || "").toLowerCase();

    const valid =
      p.aud === cfg.googleClientId &&
      Number(p.exp || 0) > now &&
      p.email_verified === true &&
      email.endsWith("@" + domain) &&
      (!p.hd || String(p.hd).toLowerCase() === domain);

    return valid ? p : null;
  }

  function getCredential() {
    const key = cfg.storageKey || "ooe_google_credential";
    const token = sessionStorage.getItem(key) || localStorage.getItem(key) || "";
    if (token && !sessionStorage.getItem(key)) sessionStorage.setItem(key, token);
    return token;
  }

  function secondsUntilExpiry(token = getCredential()) {
    const payload = decodeJwt(token);
    return Math.floor(Number(payload?.exp || 0) - Date.now() / 1000);
  }

  function getUser() {
    if (cfg.previewMode && (location.protocol === "file:" || location.hostname === "127.0.0.1" || location.hostname === "localhost")) {
      return { email:"preview@spu.ac.th", name:"Integration Preview", preview:true };
    }
    const user = validateCredential(getCredential());
    if (!user) clearCredential();
    return user;
  }

  function saveCredential(token) {
    const key = cfg.storageKey || "ooe_google_credential";
    sessionStorage.setItem(key, token);
    localStorage.setItem(key, token);
  }

  function clearCredential() {
    const key = cfg.storageKey || "ooe_google_credential";
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }

  function scheduleCredentialRenewal() {
    clearTimeout(renewalTimer);
    const seconds = secondsUntilExpiry();
    if (seconds <= 0) return;
    // Refresh before the API token expires. Google may still require an
    // interaction; that case is handled as a safe worker pause, never a lost job.
    renewalTimer = setTimeout(async () => {
      const renewed = await refreshCredential({ interactive:false }).catch(() => false);
      if (renewed) scheduleCredentialRenewal();
      else renewalTimer = setTimeout(() => scheduleCredentialRenewal(), 60 * 1000);
    }, Math.max(60, seconds - 10 * 60) * 1000);
  }

  function acceptCredential(response) {
    const token = response && response.credential;
    const user = validateCredential(token);
    if (!user) return null;
    saveCredential(token);
    scheduleCredentialRenewal();
    window.dispatchEvent(new CustomEvent("ooeauthrenewed", { detail:{ email:user.email } }));
    return user;
  }

  function loadGoogleIdentity() {
    if (window.google?.accounts?.id) return Promise.resolve(true);
    if (!isConfigured() || !document.head) return Promise.resolve(false);

    const existing = document.querySelector('script[data-ooe-google-identity]');
    if (existing) {
      return new Promise(resolve => {
        existing.addEventListener("load", () => resolve(Boolean(window.google?.accounts?.id)), { once:true });
        existing.addEventListener("error", () => resolve(false), { once:true });
        setTimeout(() => resolve(Boolean(window.google?.accounts?.id)), 8000);
      });
    }

    return new Promise(resolve => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.ooeGoogleIdentity = "true";
      script.onload = () => resolve(Boolean(window.google?.accounts?.id));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
      setTimeout(() => resolve(Boolean(window.google?.accounts?.id)), 8000);
    });
  }

  async function refreshCredential({ interactive = false } = {}) {
    if (validateCredential(getCredential()) && secondsUntilExpiry() > 10 * 60) return true;
    if (renewalPromise) return renewalPromise;
    renewalPromise = loadGoogleIdentity().then(available => new Promise(resolve => {
      if (!available || !window.google?.accounts?.id) { resolve(false); return; }
      let settled = false;
      const finish = value => { if (!settled) { settled = true; resolve(value); } };
      try {
        google.accounts.id.initialize({
          client_id: cfg.googleClientId,
          callback: response => finish(Boolean(acceptCredential(response))),
          hd: cfg.allowedDomain,
          auto_select: true,
          cancel_on_tap_outside: !interactive
        });
        google.accounts.id.prompt(notification => {
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
            if (!interactive) finish(false);
          }
        });
        setTimeout(() => finish(false), interactive ? 30000 : 8000);
      } catch (_) { finish(false); }
    })).finally(() => { renewalPromise = null; });
    return renewalPromise;
  }

  async function ensureFreshCredential({ interactive = false } = {}) {
    // A still-valid credential must keep the current audit moving while a
    // background renewal is attempted; do not interrupt a course mid-scan.
    if (validateCredential(getCredential())) {
      if (secondsUntilExpiry() <= 10 * 60) refreshCredential({ interactive:false }).catch(() => {});
      return true;
    }
    return refreshCredential({ interactive });
  }

  function isSessionError(error) {
    return /exp.? claim|timestamp check|jwt expired|missing_token|session_expired|เซสชันหมดอายุ|HTTP 401/i.test(String(error?.message || error));
  }

  function dashboardUrl() {
    const next = new URLSearchParams(location.search).get("next");
    if (next && !next.includes("://") && !next.startsWith("//")) return next;
    return "index.html";
  }

  function requireAuth() {
    const user = getUser();
    if (!user) {
      const current = location.pathname.split("/").pop() || "index.html";
      const suffix = (location.search || "") + (location.hash || "");
      location.replace(loginPage + "?next=" + encodeURIComponent(current + suffix));
      return null;
    }
    document.documentElement.classList.remove("auth-check");
    scheduleCredentialRenewal();
    window.addEventListener("DOMContentLoaded", () => renderUser(user));
    revealReviewerLinks();
    return user;
  }

  let reviewerSessionPromise;
  async function reviewerSession() {
    const user = getUser();
    if (!user || !cfg.backendApiUrl) return null;
    if (!reviewerSessionPromise) reviewerSessionPromise = fetch(String(cfg.backendApiUrl).replace(/\/$/, "") + "/api/v1/admin/session", {
      headers: { Authorization: `Bearer ${getCredential()}`, apikey: cfg.supabasePublishableKey || "" },
      cache: "no-store"
    }).then(async response => response.ok ? response.json() : null).catch(() => null);
    return reviewerSessionPromise;
  }

  function revealReviewerLinks() {
    const reveal = async () => {
      const session = await reviewerSession();
      if (!session?.reviewer) return;
      document.querySelectorAll("[data-reviewer-only]").forEach(element => { element.hidden = false; });
    };
    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", reveal, { once:true });
    else reveal();
  }

  async function requireReviewer() {
    const user = requireAuth();
    if (!user) return null;
    if (user.preview && cfg.previewMode) {
      document.documentElement.classList.remove("auth-check");
      return user;
    }
    try {
      const session = await reviewerSession();
      if (!session?.reviewer) throw new Error("reviewer_required");
      document.documentElement.classList.remove("auth-check");
      const reviewerUser = { ...user, reviewer:true, role:session.role || "admin" };
      renderUser(reviewerUser);
      return reviewerUser;
    } catch (_) {
      document.documentElement.classList.remove("auth-check");
      document.body.innerHTML = '<main style="max-width:760px;margin:60px auto;padding:24px;font-family:Tahoma,sans-serif"><h1>ไม่มีสิทธิ์เข้าถึงหลังบ้านทีมตรวจ</h1><p>บัญชีนี้เปิดดูผลสำหรับอาจารย์ได้ แต่ไม่ได้อยู่ในรายชื่อทีมตรวจ</p><p><a href="index.html">กลับ Dashboard รายวิชา</a></p></main>';
      return null;
    }
  }

  function renderUser(user) {
    const el = document.getElementById("authUserEmail");
    if (el) el.textContent = user.email || "";
  }

  function handleGoogleCredential(response) {
    const user = acceptCredential(response);

    const msg = document.getElementById("loginMessage");
    if (!user) {
      clearCredential();
      if (msg) {
        msg.textContent = "บัญชีนี้ไม่ได้รับอนุญาต กรุณาใช้บัญชี @" + (cfg.allowedDomain || "spu.ac.th");
        msg.className = "message error";
      }
      return;
    }

    location.replace(dashboardUrl());
  }

  function logout() {
    clearTimeout(renewalTimer);
    clearCredential();
    try {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
    } catch (_) {}
    location.replace(loginPage);
  }

  function setupLogin() {
    const msg = document.getElementById("loginMessage");
    const box = document.getElementById("googleSignIn");

    if (!isConfigured()) {
      if (msg) {
        msg.textContent = "ยังไม่ได้ตั้งค่า Google OAuth Client ID";
        msg.className = "message setup";
      }
      if (box) box.innerHTML = '<div class="setup-box">ตั้งค่า <code>auth-config.js</code> ก่อนเปิดใช้งานจริง</div>';
      return;
    }

    const existing = getUser();
    if (existing) {
      location.replace(dashboardUrl());
      return;
    }

    if (!window.google || !google.accounts || !google.accounts.id) {
      setTimeout(setupLogin, 150);
      return;
    }

    google.accounts.id.initialize({
      client_id: cfg.googleClientId,
      callback: handleGoogleCredential,
      hd: cfg.allowedDomain,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    google.accounts.id.renderButton(box, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
      logo_alignment: "left",
      width: 300
    });
  }

  window.OOEAuth = {
    requireAuth,
    requireReviewer,
    setupLogin,
    logout,
    getUser,
    getCredential,
    refreshCredential,
    ensureFreshCredential,
    isSessionError,
    reviewerSession,
    revealReviewerLinks,
    handleGoogleCredential
  };
})();
