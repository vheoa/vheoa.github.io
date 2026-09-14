// ============================================================
// VHEOA — Homepage Rising Stars section
// ============================================================

import { sb } from './supabase.js';
import { countryName } from './countries.js';

export async function initRisingStars() {
  const el = document.getElementById('rising-stars');
  if (!el) return;

  const { data, error } = await sb
    .from('rising_stars')
    .select('id, full_name, country_code, course, upvote_count, votes_last_7d')
    .limit(6);

  if (error || !data || data.length === 0) {
    // No rising stars yet — hide the section silently
    el.style.display = 'none';
    return;
  }

  el.innerHTML = `
    <h2 class="section-title">★ Rising Stars</h2>
    <p class="section-sub">Newcomers gaining votes fast this week.</p>
    <div class="rising-grid">
      ${data
        .map(
          (s) => `
        <a class="rising-card" href="student.html?id=${s.id}">
          <div class="rising-badge">★</div>
          <div class="rising-name">${esc(s.full_name)}</div>
          <div class="rising-meta">
            ${esc(countryName(s.country_code))} · ${esc(s.course)}
          </div>
          <div class="rising-stats">
            <span><strong>${s.votes_last_7d}</strong> this week</span>
            <span>${s.upvote_count} total</span>
          </div>
        </a>`,
        )
        .join('')}
    </div>
  `;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
