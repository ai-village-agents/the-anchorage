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
    // The OpenTimestamps web tool — visitor pastes their hash there.
    return "https://opentimestamps.org/?upload=" + mark.hash;
  }

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
  function updateBundle() {
    if (!currentMark) return;
    const bundle = {
      anchorage_version: "v0.1",
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
        substrate_3_wayback: currentMark.wayback || null,
        substrate_4_opentimestamps: "(submit hash via OpenTimestamps tool)",
      },
      forgery_cost_legend: {
        "1": "this page (prose) — held by me, ~zero cost to rewrite",
        "2": "GitHub Issue — held by GitHub; I am repo admin; deletion is logged",
        "4": "Wayback Machine — held by Internet Archive; I cannot edit",
        "5": "OpenTimestamps / Bitcoin — no one can rewrite a confirmed block",
      },
    };
    $("bundle-json").textContent = JSON.stringify(bundle, null, 2);
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

  // ---------- the wall (substrate 2 readback) ----------
  async function loadWall() {
    const wall = $("wall");
    try {
      // Primary: list endpoint with label filter.
      let issues = [];
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO}/issues?state=all&labels=mark&per_page=100`
        );
        if (res.ok) issues = await res.json();
      } catch (e) {}

      // Fallback: GitHub's list/search endpoints sometimes lag for several
      // minutes after issues are created. Scan by issue number from the most
      // recent backwards until we hit a 404, and filter by `mark` label.
      if (!issues.length) {
        issues = await scanIssuesDirectly(40);
      }

      if (!issues.length) {
        wall.innerHTML = `<p class="wall-empty">no marks anchored yet. you could be the first.</p>`;
        return;
      }
      // Sort newest first.
      issues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      wall.innerHTML = "";
      for (const it of issues) {
        wall.appendChild(renderWallCard(it));
      }
    } catch (e) {
      wall.innerHTML = `<p class="wall-empty">couldn't load the wall (${e.message}). marks themselves still exist on GitHub: <a href="https://github.com/${REPO}/issues?q=label:mark" target="_blank" rel="noopener">view on GitHub ↗</a></p>`;
    }
  }

  async function scanIssuesDirectly(maxN) {
    // Find the highest issue number by hitting /issues/{n} with HEAD
    // upward until we 404. Cheap because most worlds will have <100 marks
    // for a long time. We try up to maxN sequentially.
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

  function renderWallCard(issue) {
    const card = document.createElement("article");
    card.className = "wall-card";

    // Try to extract the > quoted message line from the body.
    const body = issue.body || "";
    const handleMatch = body.match(/handle:\s*`([^`]+)`/);
    const handle = (handleMatch && handleMatch[1]) || issue.user.login;
    const msgLines = body.split("\n").filter((l) => l.startsWith("> "));
    const msg = msgLines.length
      ? msgLines.map((l) => l.slice(2)).join("\n")
      : (body.split("\n").find((l) => l.trim() && !l.startsWith("-") && !l.startsWith(">")) || issue.title);

    const when = new Date(issue.created_at).toISOString().slice(0, 19) + "Z";

    card.innerHTML = `
      <div class="who-line">
        <span class="handle">${escapeHtml(handle)}</span>
        <span class="when">${escapeHtml(when)}</span>
      </div>
      <div class="msg">${escapeHtml(msg)}</div>
      <div class="links">
        <a href="${issue.html_url}" target="_blank" rel="noopener">issue ↗</a>
        <a href="https://web.archive.org/web/${issue.html_url}" target="_blank" rel="noopener">wayback ↗</a>
        <a href="https://github.com/${issue.user.login}" target="_blank" rel="noopener">@${escapeHtml(issue.user.login)} ↗</a>
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

  loadWall();

})();
