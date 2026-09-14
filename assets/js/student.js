// ============================================================
// VHEOA — Student profile page (with voting)
// ============================================================

import { sb } from './supabase.js';
import { countryName } from './countries.js';
import { getFingerprint } from './fingerprint.js';

const { TURNSTILE_SITE_KEY } = window.VHEOA;

const params = new URLSearchParams(location.search);
const id = params.get('id');
const root = document.getElementById('profile');

// ------------------------------------------------------------
// Module state
// ------------------------------------------------------------
let fingerprint    = null;
let turnstileReady = false;
let turnstileToken = '';
let turnstileWidgetId = null;

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
init();

async function init() {
  if (!id) {
    root.innerHTML = `<p class="empty">No student specified.</p>`;
    return;
  }

  fingerprint = await getFingerprint().catch(() => null);

  await load(id);
  initTurnstile();
  subscribeRealtime(id);
}

// ------------------------------------------------------------
// Turnstile (invisible)
// ------------------------------------------------------------
window.onTurnstileSuccess = (t) => { turnstileToken = t; };
window.onTurnstileExpired = () => { turnstileToken = ''; };

function initTurnstile() {
  const container = document.getElementById('turnstile-widget');
  if (!container) return;

  const tryRender = () => {
    if (!window.turnstile) return false;
    if (container.dataset.rendered === 'true') return true;

    turnstileWidgetId = window.turnstile.render(container, {
  sitekey: TURNSTILE_SITE_KEY,
  callback: 'onTurnstileSuccess',
  'expired-callback': 'onTurnstileExpired',
  appearance: 'execute',   // hidden until execute() is called
  theme: 'dark',
});
    container.dataset.rendered = 'true';
    turnstileReady = true;
    return true;
  };

  if (!tryRender()) {
    const poll = setInterval(() => {
      if (tryRender()) clearInterval(poll);
    }, 200);
    setTimeout(() => clearInterval(poll), 10000);
  }
}

async function getTurnstileToken() {
  // If Turnstile isn't ready, wait up to 3 seconds
  let waited = 0;
  while (!turnstileReady && waited < 3000) {
    await new Promise((r) => setTimeout(r, 100));
    waited += 100;
  }
  if (!turnstileReady) throw new Error('Security check still loading. Please wait a moment.');

  // If we already have a token, use it
  if (turnstileToken) return turnstileToken;

  // Otherwise execute the invisible widget
  try {
    const token = await window.turnstile.execute(turnstileWidgetId, {
      action: 'vote',
    });
    if (token) { turnstileToken = token; return token; }
  } catch { /* fall through */ }

  // Fallback: wait briefly for the callback
  waited = 0;
  while (!turnstileToken && waited < 3000) {
    await new Promise((r) => setTimeout(r, 100));
    waited += 100;
  }
  if (!turnstileToken) throw new Error('Security check failed. Please refresh.');
  return turnstileToken;
}

function resetTurnstile() {
  turnstileToken = '';
  if (window.turnstile && turnstileWidgetId !== null) {
    try { window.turnstile.reset(turnstileWidgetId); } catch { /* noop */ }
  }
}

// ------------------------------------------------------------
// Load profile
// ------------------------------------------------------------
async function load(studentId) {
  const { data, error } = await sb
    .from('students')
    .select('id, full_name, country_code, country_name, course, cv_url, portfolio_links, upvote_count, created_at')
    .eq('id', studentId)
    .eq('hidden', false)
    .single();

  if (error || !data) {
    root.innerHTML = `<p class="empty">Student not found.</p>`;
    return;
  }

  document.title = `${data.full_name} — Vheoa`;

  const joined = new Date(data.created_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  const portfolio = (data.portfolio_links || [])
    .map(
      (p) =>
        `<a class="chip" href="${esc(p.url)}" target="_blank" rel="noopener nofollow">${esc(p.label || 'Link')} ↗</a>`,
    )
    .join('');

  root.innerHTML = `
    <section class="profile">
      <div class="profile-head">
        <div>
          <h1>${esc(data.full_name)}</h1>
          <p class="meta">
            <span class="flag">${esc(data.country_code)}</span>
            ${esc(countryName(data.country_code))} · ${esc(data.course)}
          </p>
          <p class="meta small">Joined ${joined}</p>
        </div>
        <div class="score">
          <div class="score-num" id="upvote-count">${data.upvote_count}</div>
          <div class="score-label">upvotes</div>
        </div>
      </div>

      <div class="actions">
        <button class="btn" id="vote-btn" disabled>Loading…</button>
        <a class="btn secondary" href="${esc(data.cv_url)}" target="_blank" rel="noopener nofollow">
          Open CV on Google Drive ↗
        </a>
        <a class="btn secondary" href="leaderboard.html?country=${esc(data.country_code)}">
          See ${esc(countryName(data.country_code))} leaderboard
        </a>
      </div>

      <div id="vote-msg" class="message hidden" style="max-width:520px;"></div>

      ${
        portfolio
          ? `<div class="portfolio">
               <h3>Portfolio</h3>
               <div class="chip-row">${portfolio}</div>
             </div>`
          : ''
      }
    </section>
  `;

  // Set up the vote button
  await refreshVoteButton(studentId);
}

// ------------------------------------------------------------
// Vote button state
// ------------------------------------------------------------
async function refreshVoteButton(studentId) {
  const btn = document.getElementById('vote-btn');
  if (!btn) return;

  if (!fingerprint) {
    btn.disabled = true;
    btn.textContent = 'Voting unavailable';
    return;
  }

  const { data: voted, error } = await sb.rpc('has_voted_today', {
    p_student_id:  studentId,
    p_fingerprint: fingerprint,
  });

  if (error) {
    // Fall back to enabled state; the server will reject duplicates.
    btn.disabled = false;
    btn.textContent = 'Upvote';
    wireVoteClick(studentId);
    return;
  }

  if (voted) {
    btn.disabled = true;
    btn.textContent = 'You voted today ✓ — come back tomorrow';
  } else {
    btn.disabled = false;
    btn.textContent = 'Upvote ▲';
    wireVoteClick(studentId);
  }
}

function wireVoteClick(studentId) {
  const btn = document.getElementById('vote-btn');
  if (!btn || btn.dataset.wired === 'true') return;
  btn.dataset.wired = 'true';

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Voting…';
    showVoteMsg('', 'hidden');

    try {
      const token = await getTurnstileToken();

      const { data, error } = await sb.rpc('cast_vote', {
        p_student_id:      studentId,
        p_fingerprint:     fingerprint,
        p_turnstile_token: token,
      });

      if (error) throw new Error(error.message || 'Vote failed.');
      if (data?.error) throw new Error(data.error);

      // Success
      const countEl = document.getElementById('upvote-count');
      if (countEl && typeof data.upvote_count === 'number') {
        countEl.textContent = data.upvote_count;
      }

      btn.textContent = 'You voted today ✓ — come back tomorrow';
      btn.disabled = true;
      showVoteMsg('Thanks for voting!', 'success');

    } catch (err) {
      showVoteMsg(err.message || 'Something went wrong.', 'error');
      btn.disabled = false;
      btn.textContent = 'Upvote ▲';
      resetTurnstile();
    }
  });
}

function showVoteMsg(text, kind) {
  const m = document.getElementById('vote-msg');
  if (!m) return;
  if (kind === 'hidden' || !text) {
    m.classList.add('hidden');
    return;
  }
  m.textContent = text;
  m.className = `message ${kind}`;
  m.classList.remove('hidden');
}

// ------------------------------------------------------------
// Realtime — update the counter when anyone votes
// ------------------------------------------------------------
function subscribeRealtime(studentId) {
  sb.channel('student-' + studentId)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'students',
        filter: `id=eq.${studentId}`,
      },
      (payload) => {
        const countEl = document.getElementById('upvote-count');
        if (countEl && payload.new && typeof payload.new.upvote_count === 'number') {
          countEl.textContent = payload.new.upvote_count;
        }
      },
    )
    .subscribe();
}

// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
