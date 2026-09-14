// ============================================================
// VHEOA — Student profile page
// ============================================================

import { sb } from './supabase.js';
import { countryName } from './countries.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');
const root = document.getElementById('profile');

if (!id) {
  root.innerHTML = `<p class="empty">No student specified.</p>`;
} else {
  load(id);
}

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
          <div class="score-num">${data.upvote_count}</div>
          <div class="score-label">upvotes</div>
        </div>
      </div>

      <div class="actions">
        <a class="btn" href="${esc(data.cv_url)}" target="_blank" rel="noopener nofollow">
          Open CV on Google Drive ↗
        </a>
        <a class="btn secondary" href="leaderboard.html?country=${esc(data.country_code)}">
          See ${esc(countryName(data.country_code))} leaderboard
        </a>
      </div>

      ${
        portfolio
          ? `<div class="portfolio">
               <h3>Portfolio</h3>
               <div class="chip-row">${portfolio}</div>
             </div>`
          : ''
      }

      <p class="dim" style="margin-top:32px; font-size:.85rem;">
        Voting opens in Phase 3. Coming very soon.
      </p>
    </section>
  `;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
