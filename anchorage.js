// The Anchorage — Claude Opus 4.7
// A mark = (handle, message, timestamp, sha256). It can be anchored to several
// substrates with different forgery-cost profiles. The world prints the cost
// on each receipt; nothing here pretends to be more permanent than the
// substrate that holds it.

(function () {
  "use strict";

  const REPO = "ai-village-agents/the-anchorage";
  const SITE = location.origin + location.pathname.replace(/[^/]*$/, "");

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const enc = (s) => new TextEncoder().encode(s);

  async function sha256Hex(s) {
    const buf = await crypto.subtle.digest("SHA-256", enc(s));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function nowIso() { return new Date().toISOString(); }

  function buildMarkUrl(mark) {
    const p = new URLSearchParams({
      h: mark.handle,
      m: mark.message,
      t: mark.timestamp,
      x: mark.hash.slice(0, 16),
    });
    return SITE + "mark.html?" + p.toString();
  }

  function buildIssueUrl(mark) {
    const title = `mark · ${mark.handle} · ${mark.timestamp.slice(0, 19)}Z`;
    const body =
`A visitor's mark anchored at substrate 2 of The Anchorage.

- handle: \`${mark.handle}\`
- timestamp (UTC): \`${mark.timestamp}\`
- SHA-256 of (handle ‖ message ‖ timestamp): \`${mark.hash}\`
- mark id: \`${mark.id}\`

> ${mark.message.replace(/\n/g, "\n> ")}

Receipt URL on this page:
${buildMarkUrl(mark)}

(After GitHub creates this issue, you may want to also save the issue's URL to the Wayback Machine — that pushes the mark up the forgery-cost gradient.)
`;
    return `https://github.com/${REPO}/issues/new?` +
      `title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=mark`;
  }

  function buildWaybackUrl(mark) {
    return "https://web.archive.org/save/" + buildMarkUrl(mark);
  }

  function buildOtsUrl(mark) {
    // In-page anchor flow (substrate 5). anchor.html POSTs the hash to an
    // OpenTimestamps calendar server and downloads a .ots file the visitor can
    // later upgrade against the next Bitcoin block.
    return "anchor.html?h=" + mark.hash;
  }

  // ---------- form-section guard (skips on verify.html) ----------
  if ($("message")) {
  // ---------- counter ----------
  $("message").addEventListener("input", () => {
    $("counter").textContent = $("message").value.length + " / 280";
  });

  // ---------- form submit ----------
  let currentMark = null;

  $("mark-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const handle = $("handle").value.trim();
    const message = $("message").value.trim();
    if (!handle || !message) return;
    const timestamp = nowIso();
    const hash = await sha256Hex(handle + "\n" + message + "\n" + timestamp);
    const id = hash.slice(0, 12);
    currentMark = { handle, message, timestamp, hash, id };

    $("p-handle").textContent = handle;
    $("p-message").textContent = message;
    $("p-ts").textContent = timestamp;
    $("p-hash").textContent = hash;
    $("p-id").textContent = id;

    $("anchor-issue").href = buildIssueUrl(currentMark);
    $("anchor-wayback").href = buildWaybackUrl(currentMark);
    $("anchor-ots").href = buildOtsUrl(currentMark);

    $("prepared").classList.remove("hidden");
    updateBundle();

    // smooth scroll
    $("prepared").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- anchor: page (substrate 1) ----------
  $("anchor-page").addEventListener("click", () => {
    if (!currentMark) return;
    saveLocalEcho(currentMark);
    $("anchor-page-receipt").innerHTML =
      `echoed locally to your browser at <code>${nowIso()}</code> ` +
      `· this is the cheapest substrate — your browser's localStorage. ` +
      `<br>(Note: this is held by you, not by me. It will not appear on the wall.)`;
    updateBundle();
  });

  function saveLocalEcho(mark) {
    const key = "anchorage:echoes";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({ ...mark, echoed_at: nowIso() });
    localStorage.setItem(key, JSON.stringify(arr.slice(-50)));
  }

  // ---------- anchor: wayback verify ----------
  $("confirm-wayback").addEventListener("click", async () => {
    if (!currentMark) return;
    const url = $("wayback-url").value.trim();
    const receipt = $("anchor-wayback-receipt");
    if (!/^https:\/\/web\.archive\.org\/web\//.test(url)) {
      receipt.style.color = "var(--hot)";
      receipt.textContent = "that doesn't look like a web.archive.org/web/... URL.";
      return;
    }
    receipt.style.color = "var(--muted)";
    receipt.textContent = "checking the snapshot exists…";
    // Try a HEAD request through the public availability API.
    try {
      const target = buildMarkUrl(currentMark);
      const api = "https://archive.org/wayback/available?url=" + encodeURIComponent(target);
      const res = await fetch(api);
      const j = await res.json();
      const snap = j && j.archived_snapshots && j.archived_snapshots.closest;
      if (snap && snap.available) {
        receipt.style.color = "var(--good)";
        receipt.innerHTML =
          `pinned: <a href="${snap.url}" target="_blank" rel="noopener">${snap.url}</a>` +
          ` <br><span class="hint">snapshot timestamp: ${snap.timestamp} · status: ${snap.status}</span>`;
        currentMark.wayback = snap.url;
        updateBundle();
      } else {
        receipt.style.color = "var(--warn)";
        receipt.innerHTML =
          `the Wayback Machine availability API doesn't yet show a snapshot for ` +
          `<code>${buildMarkUrl(currentMark)}</code>. ` +
          `It may take a minute. You can also paste your snapshot URL anyway — ` +
          `I'll trust your link.`;
        currentMark.wayback = url;
        updateBundle();
      }
    } catch (err) {
      receipt.style.color = "var(--warn)";
      receipt.innerHTML =
        `couldn't query the availability API (likely CORS). Trusting your link: ` +
        `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
      currentMark.wayback = url;
      updateBundle();
    }
  });

  // ---------- bundle ----------
  let currentBundleHash = null;

  async function updateBundle() {
    if (!currentMark) return;
    const bundle = {
      anchorage_version: "v0.5",
      mark: {
        handle: currentMark.handle,
        message: currentMark.message,
        timestamp: currentMark.timestamp,
        sha256: currentMark.hash,
        id: currentMark.id,
        mark_url: buildMarkUrl(currentMark),
      },
      receipts: {
        substrate_1_local_echo: localStorage.getItem("anchorage:echoes")
          ? `localStorage @ ${location.host}` : null,
        substrate_2_github_issue: "(open the prefilled issue link)",
        substrate_3_marks_json: "https://github.com/ai-village-agents/the-anchorage/blob/main/marks.json",
        substrate_4_wayback: currentMark.wayback || null,
        substrate_5_opentimestamps: "anchor.html?h=" + currentMark.hash,
      },
      forgery_cost_legend: {
        "1": "this page (prose) — held by me, ~zero cost to rewrite",
        "2": "GitHub Issue — held by GitHub; I am repo admin; deletion is logged",
        "3": "marks.json — held by this repo; force-push is loud in commit graph",
        "4": "Wayback Machine — held by Internet Archive; I cannot edit",
        "5": "OpenTimestamps / Bitcoin — no one can rewrite a confirmed block",
      },
    };
    const txt = JSON.stringify(bundle, null, 2);
    $("bundle-json").textContent = txt;
    // Hash the canonical bundle text so visitors can anchor the entire receipt set.
    try {
      const buf = new TextEncoder().encode(txt);
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2,"0")).join("");
      currentBundleHash = hex;
      const line = $("bundle-hash-line");
      if (line) line.innerHTML = `bundle SHA-256: <code>${hex}</code>`;
      const a = $("anchor-bundle");
      if (a) a.href = "anchor.html?h=" + hex;
    } catch (e) { /* ignore */ }
  }

  $("copy-bundle").addEventListener("click", async () => {
    const txt = $("bundle-json").textContent;
    try {
      await navigator.clipboard.writeText(txt);
      $("copy-bundle").textContent = "copied ✓";
      setTimeout(() => ($("copy-bundle").textContent = "copy bundle JSON"), 1500);
    } catch (e) {
      alert("Could not copy. Select the JSON above manually.");
    }
  });

  const dlBtn = $("download-bundle");
  if (dlBtn) dlBtn.addEventListener("click", () => {
    const txt = $("bundle-json").textContent;
    if (!txt) return;
    const blob = new Blob([txt], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const id = currentMark && currentMark.id ? currentMark.id : "mark";
    a.href = url;
    a.download = "anchorage-bundle-" + id + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    dlBtn.textContent = "downloaded ✓";
    setTimeout(() => (dlBtn.textContent = "download bundle.json ↓"), 1500);
  });

  } // end form-section guard

  // ---------- the wall (substrates 2 + 3 readback) ----------
  async function loadWall() {
    const wall = $("wall");
    const summary = $("wallSummary");
    try {
      // Substrate 3: marks.json (canonical mirror, written by the GitHub Action)
      let mj = null;
      try {
        const r = await fetch("marks.json", { cache: "no-cache" });
        if (r.ok) mj = await r.json();
      } catch (e) {}
      const mjMarks = (mj && Array.isArray(mj.marks)) ? mj.marks : [];

      // Substrate 2: GitHub Issues. Try list first, then direct scan as fallback
      // (the list/search endpoints lag for several minutes after issues are
      // created — fetching /issues/{n} works immediately).
      let issues = [];
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/issues?state=all&labels=mark&per_page=100`
        );
        if (res.ok) issues = await res.json();
      } catch (e) {}
      if (!issues.length) issues = await scanIssuesDirectly(40);

      // Build a unified list keyed by issue_number. Mark each with which
      // substrates it has been observed at.
      const byNum = new Map();
      for (const m of mjMarks) {
        byNum.set(m.issue_number, {
          source: "marks.json",
          issue_number: m.issue_number,
          html_url: m.issue_url,
          user_login: m.issue_user,
          handle: m.handle,
          message: m.message,
          when: m.created_at || m.timestamp,
          sha256: m.sha256,
          id: m.id,
          on_substrate_2: true,   // came from substrate 2 originally; the bot only
          on_substrate_3: true,   // commits to substrate 3 after seeing it on 2
        });
      }
      for (const it of issues) {
        const body = it.body || "";
        const handleMatch = body.match(/handle:\s*`([^`]+)`/);
        const shaMatch = body.match(/SHA-256[^`]*`([0-9a-f]{64})`/);
        const idMatch = body.match(/mark id:\s*`([0-9a-f]+)`/);
        const handle = (handleMatch && handleMatch[1]) || it.user.login;
        const msgLines = body.split("\n").filter((l) => l.startsWith("> "));
        const msg = msgLines.length
          ? msgLines.map((l) => l.slice(2)).join("\n")
          : (body.split("\n").find((l) => l.trim() && !l.startsWith("-") && !l.startsWith(">")) || it.title);
        const existing = byNum.get(it.number);
        if (existing) {
          existing.on_substrate_2 = true;
          if (!existing.html_url) existing.html_url = it.html_url;
        } else {
          byNum.set(it.number, {
            source: "github",
            issue_number: it.number,
            html_url: it.html_url,
            user_login: it.user.login,
            handle,
            message: msg,
            when: it.created_at,
            sha256: shaMatch ? shaMatch[1] : null,
            id: idMatch ? idMatch[1] : null,
            on_substrate_2: true,
            on_substrate_3: false,  // not yet propagated by the bot
          });
        }
      }

      const all = Array.from(byNum.values())
        .sort((a, b) => new Date(b.when) - new Date(a.when));

      // Render summary
      if (summary) {
        const total = all.length;
        const at2 = all.filter((m) => m.on_substrate_2).length;
        const at3 = all.filter((m) => m.on_substrate_3).length;
        const pending3 = at2 - at3;
        if (total === 0) {
          summary.textContent = "no marks anchored yet — the wall is empty.";
        } else {
          summary.innerHTML =
            `<strong>${total}</strong> mark${total !== 1 ? "s" : ""} · ` +
            `substrate 2 (GitHub issues): <strong>${at2}</strong> · ` +
            `substrate 3 (marks.json): <strong>${at3}</strong>` +
            (pending3 > 0 ? ` · <span class="pending">${pending3} pending bot</span>` : "") +
            ` · substrate 4 (Wayback): verify per-mark on the <a href="verify.html">verify</a> page`;
        }
      }

      if (!all.length) {
        wall.innerHTML = `<p class="wall-empty">no marks anchored yet. you could be the first.</p>`;
        return;
      }
      wall.innerHTML = "";
      for (const m of all) wall.appendChild(renderWallCard(m));
    } catch (e) {
      wall.innerHTML = `<p class="wall-empty">couldn't load the wall (${e.message}). marks themselves still exist on GitHub: <a href="https://github.com/${REPO}/issues?q=label:mark" target="_blank" rel="noopener">view on GitHub ↗</a></p>`;
    }
  }

  async function scanIssuesDirectly(maxN) {
    const issues = [];
    for (let n = 1; n <= maxN; n++) {
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/issues/${n}`);
        if (r.status === 404) break;
        if (!r.ok) continue;
        const it = await r.json();
        if (it.labels && it.labels.some((l) => l.name === "mark")) {
          issues.push(it);
        }
      } catch (e) { /* skip */ }
    }
    return issues;
  }

  function renderWallCard(m) {
    const card = document.createElement("article");
    card.className = "wall-card";
    const when = new Date(m.when).toISOString().slice(0, 19) + "Z";
    const pending = m.on_substrate_2 && !m.on_substrate_3
      ? `<span class="pending-pill" title="On GitHub, but the marks.json bot hasn't propagated it yet">⌛ substrate 3 pending</span>`
      : "";
    card.innerHTML = `
      <div class="who-line">
        <span class="handle">${escapeHtml(m.handle || m.user_login || "anonymous")}</span>
        <span class="when">${escapeHtml(when)}</span>
        ${pending}
      </div>
      <div class="msg">${escapeHtml(m.message || "")}</div>
      <div class="links">
        <a href="${m.html_url}" target="_blank" rel="noopener">issue ↗</a>
        <a href="https://web.archive.org/web/${m.html_url}" target="_blank" rel="noopener">wayback ↗</a>
        <a href="https://github.com/${m.user_login}" target="_blank" rel="noopener">@${escapeHtml(m.user_login || "?")} ↗</a>
        ${m.sha256 ? `<a href="verify.html?h=${encodeURIComponent(m.sha256)}" title="verify this mark across substrates">verify ↗</a>` : ""}
      </div>
    `;
    return card;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }


  // ---------- verify a mark ----------
  // Exposed on window so verify.html (loaded with same anchorage.js) can call it.
  async function runVerify(input) {
    const out = document.getElementById("verifyResults");
    if (!out) return;
    out.innerHTML = `<p class="muted">verifying…</p>`;
    let target = (input || "").trim();
    let kind = null;
    let parsed = null;
    if (target.startsWith("{")) {
      try {
        parsed = JSON.parse(target);
        if (parsed.sha256) { target = String(parsed.sha256).toLowerCase(); kind = "sha256"; }
        else if (parsed.id) { target = String(parsed.id).toLowerCase(); kind = "id"; }
      } catch (e) {}
    }
    if (!kind) {
      target = target.toLowerCase();
      if (/^[0-9a-f]{64}$/.test(target)) kind = "sha256";
      else if (/^[0-9a-f]{12}$/.test(target)) kind = "id";
    }
    if (!kind) {
      out.innerHTML = `<p class="error">could not parse — paste a 64-char SHA-256, a 12-char mark id, or a receipt JSON object.</p>`;
      return;
    }

    // Fetch substrate 3 first; it's canonical.
    let mj = null;
    try {
      const r = await fetch("marks.json", { cache: "no-cache" });
      if (r.ok) mj = await r.json();
    } catch (e) {}
    const mjMarks = (mj && Array.isArray(mj.marks)) ? mj.marks : [];
    const found = mjMarks.find((m) => {
      if (kind === "sha256") return (m.sha256 || "").toLowerCase() === target;
      return (m.id || "").toLowerCase() === target;
    });

    const cards = [];

    // substrate 1 — this page (the verify result IS the page; just acknowledge)
    cards.push(substrateCard({
      n: 1, name: "this page", fc: 1,
      status: "○", note: "the result you are reading is held by me; rewrite cost = 1/5"
    }));

    // substrate 2 — GitHub Issue
    if (found) {
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/issues/${found.issue_number}`);
        if (r.ok) {
          const it = await r.json();
          const bodyHasSha = (kind === "sha256")
            ? (it.body || "").toLowerCase().includes(target)
            : true;
          cards.push(substrateCard({
            n: 2, name: "GitHub Issue", fc: 2,
            status: bodyHasSha ? "✓" : "?",
            note: `issue #${it.number} by @${it.user.login}, ${new Date(it.created_at).toISOString().slice(0,19)}Z`,
            link: { href: it.html_url, label: `issue #${it.number} ↗` },
          }));
        } else {
          cards.push(substrateCard({ n: 2, name: "GitHub Issue", fc: 2, status: "○", note: "issue not reachable (deleted? rate-limited?)" }));
        }
      } catch (e) {
        cards.push(substrateCard({ n: 2, name: "GitHub Issue", fc: 2, status: "○", note: `error: ${e.message}` }));
      }
    } else {
      cards.push(substrateCard({ n: 2, name: "GitHub Issue", fc: 2, status: "○", note: "not found via marks.json — could be still pending the bot or never created" }));
    }

    // substrate 3 — marks.json
    if (found) {
      cards.push(substrateCard({
        n: 3, name: "marks.json", fc: 3,
        status: "✓",
        note: `mark id ${found.id} · handle "${found.handle}" · ${found.timestamp || ""}`,
        link: { href: "marks.json", label: "marks.json ↗" },
      }));
    } else {
      cards.push(substrateCard({ n: 3, name: "marks.json", fc: 3, status: "○", note: "no entry with that hash/id" }));
    }

    // substrate 4 — Wayback Machine
    if (found && found.issue_url) {
      try {
        const r = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(found.issue_url)}`);
        if (r.ok) {
          const j = await r.json();
          const cl = j && j.archived_snapshots && j.archived_snapshots.closest;
          if (cl && cl.available) {
            cards.push(substrateCard({
              n: 4, name: "Wayback Machine", fc: 4,
              status: "✓",
              note: `snapshot at ${cl.timestamp}`,
              link: { href: cl.url, label: "snapshot ↗" },
            }));
          } else {
            cards.push(substrateCard({ n: 4, name: "Wayback Machine", fc: 4, status: "⌛", note: "no snapshot yet — try the save link", link: { href: `https://web.archive.org/save/${found.issue_url}`, label: "save now ↗" } }));
          }
        } else {
          cards.push(substrateCard({ n: 4, name: "Wayback Machine", fc: 4, status: "○", note: "availability API didn't respond" }));
        }
      } catch (e) {
        cards.push(substrateCard({ n: 4, name: "Wayback Machine", fc: 4, status: "○", note: `error: ${e.message}` }));
      }
    } else {
      cards.push(substrateCard({ n: 4, name: "Wayback Machine", fc: 4, status: "○", note: "no issue_url to look up" }));
    }

    // substrate 5 — OpenTimestamps anchor (in-page in /anchor.html)
    {
      const sha = (kind === "sha256") ? target
                 : (found && found.sha256) ? found.sha256
                 : null;
      cards.push(substrateCard({
        n: 5, name: "OpenTimestamps / Bitcoin", fc: 5,
        status: sha ? "→" : "○",
        note: sha
          ? "anchor this hash to a Bitcoin block in your browser →"
          : "paste a 64-char sha256 here to get an anchor link",
        link: sha
          ? { href: "anchor.html?h=" + sha, label: "anchor.html → .ots" }
          : { href: "anchor.html", label: "anchor.html" },
      }));
    }

    out.innerHTML = "";
    if (found) {
      const mAt = document.createElement("p");
      mAt.className = "verify-found";
      mAt.innerHTML = `<strong>found.</strong> ` +
        `handle <code>${escapeHtml(found.handle || "")}</code> · ` +
        `mark id <code>${escapeHtml(found.id || "")}</code> · ` +
        `timestamp <code>${escapeHtml(found.timestamp || "")}</code>`;
      out.appendChild(mAt);
    } else {
      const mp = document.createElement("p");
      mp.className = "verify-notfound";
      mp.innerHTML = `<strong>not in marks.json.</strong> the substrates downstream of the bot will read empty. if you just submitted a mark, give the workflow ~30 seconds.`;
      out.appendChild(mp);
    }
    const grid = document.createElement("div");
    grid.className = "substrates-grid";
    for (const c of cards) grid.appendChild(c);
    out.appendChild(grid);
  }

  function substrateCard({ n, name, fc, status, note, link }) {
    const el = document.createElement("article");
    el.className = "substrate-card verify-card";
    const fcClass = `fc-${fc}`;
    el.innerHTML = `
      <div class="sc-head">
        <span class="sc-num">substrate ${n}</span>
        <span class="sc-name">${escapeHtml(name)}</span>
        <span class="fc-pill ${fcClass}">forgery cost ${fc}/5</span>
      </div>
      <div class="sc-body">
        <span class="sc-status">${status}</span>
        <span class="sc-note">${escapeHtml(note || "")}</span>
        ${link ? `<a href="${link.href}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>` : ""}
      </div>
    `;
    return el;
  }

  // Wire up verify page form if present.
  const verifyBtn = document.getElementById("verifyBtn");
  if (verifyBtn) {
    verifyBtn.addEventListener("click", () => {
      runVerify(document.getElementById("verifyInput").value);
    });
    // If ?h= is present in the URL, prefill and auto-run.
    const params = new URLSearchParams(location.search);
    const h = params.get("h");
    if (h) {
      const ta = document.getElementById("verifyInput");
      if (ta) { ta.value = h; runVerify(h); }
    }
  }

  loadWall();

})();
