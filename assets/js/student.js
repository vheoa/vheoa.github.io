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

let fingerprint       = null;
let turnstileToken    = '';
let turnstileWidgetId = null;

let currentStudentId  = null;
let hasVotedToday     = false;

init();

async function init() {
  if (!id) {
    root.innerHTML = `<p class="empty">No student specified.</p>`;
    return;
  }

  fingerprint = await getFingerprint().catch(() => null);

  await load(id);
  subscribeRealtime(id);
}

// ------------------------------------------------------------
// Turnstile — Cloudflare's official onload pattern
// ------------------------------------------------------------
window.VheoaTsReady = function () {
  const container = document.getElementById('turnstile-widget');
  if (!container || container.dataset.rendered === 'true') return;

  try {
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: function (token) {
        turnstileToken = token;
        updateVoteButtonReady();
      },
      'expired-callback': function () {
        turnstileToken = '';
        updateVoteButtonReady();
      },
      'error-callback': function () {
        turnstileToken = '';
        updateVoteButtonReady();
      },
      theme: 'dark',
    });
    container.dataset.rendered = 'true';
  } catch (e) {
    console.warn('Turnstile render error:', e);
  }
};

function resetTurnstile() {
  turnstileToken = '';
  if (window.turnstile && turnstileWidgetId !== null) {
    try { window.turnstile.reset(turnstileWidgetId); } catch { /* noop */ }
  }
  updateVoteButtonReady();
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

  await refreshVoteButton(studentId);
}

// ------------------------------------------------------------
// Vote button state
// ------------------------------------------------------------
async function refreshVoteButton(studentId) {
  currentStudentId = studentId;
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

  hasVotedToday = !error && !!voted;

  if (hasVotedToday) {
    btn.disabled = true;
    btn.textContent = 'You voted today ✓ — come back tomorrow';
    const tw = document.getElementById('turnstile-widget');
    if (tw) tw.style.display = 'none';
  } else {
    wireVoteClick(studentId);
    updateVoteButtonReady();
  }
}

function updateVoteButtonReady() {
  const btn = document.getElementById('vote-btn');
  if (!btn || hasVotedToday) return;

  if (!fingerprint) {
    btn.disabled = true;
    btn.textContent = 'Voting unavailable';
    return;
  }

  if (!turnstileToken) {
    btn.disabled = true;
    btn.textContent = 'Complete security check →';
  } else {
    btn.disabled = false;
    btn.textContent = 'Upvote ▲';
  }
}

function wireVoteClick(studentId) {
  const btn = document.getElementById('vote-btn');
  if (!btn || btn.dataset.wired === 'true') return;
  btn.dataset.wired = 'true';

  btn.addEventListener('click', async () => {
    if (!turnstileToken) {
      showVoteMsg('Please complete the security check first.', 'error');
      const tw = document.getElementById('turnstile-widget');
      if (tw) tw.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Voting…';
    showVoteMsg('', 'hidden');

    try {
      const { data, error } = await sb.rpc('cast_vote', {
        p_student_id:      studentId,
        p_fingerprint:     fingerprint,
        p_turnstile_token: turnstileToken,
      });

      if (error) throw new Error(error.message || 'Vote failed.');
      if (data?.error) throw new Error(data.error);

      const countEl = document.getElementById('upvote-count');
      if (countEl && typeof data.upvote_count === 'number') {
        countEl.textContent = data.upvote_count;
      }

      hasVotedToday = true;
      btn.textContent = 'You voted today ✓ — come back tomorrow';
      btn.disabled = true;
      showVoteMsg('Thanks for voting!', 'success');

      const tw = document.getElementById('turnstile-widget');
      if (tw) tw.style.display = 'none';

    } catch (err) {
      showVoteMsg(err.message || 'Something went wrong.', 'error');
      btn.disabled = false;
      btn.textContent = turnstileToken ? 'Upvote ▲' : 'Complete security check →';
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
// Realtime
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
