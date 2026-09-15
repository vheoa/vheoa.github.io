// ============================================================
// VHEOA — Merchant leaderboard (public read)
// ============================================================

import { sb } from './supabase.js';

export async function initMerchantBoard() {
  const el = document.getElementById('merchant-board');
  if (!el) return;

  const [{ data: merchants, error }, { data: meta }] = await Promise.all([
    sb
      .from('merchants')
      .select('id, business_name, category, country_code, website_url, description, week_score_usd, created_at')
      .eq('status', 'active')
      .order('week_score_usd', { ascending: false })
      .order('created_at',     { ascending: true })
      .limit(100),
    sb.rpc('merchant_rank_targets'),
  ]);

  if (error) {
    el.innerHTML = `<p class="empty">Could not load merchants.</p>`;
    return;
  }

  const resetText = meta?.resets_in_sec
    ? `<p class="dim" style="margin: 0 0 14px; font-size: 0.9rem;">
         Rankings reset in <strong>${formatCountdown(meta.resets_in_sec)}</strong>
       </p>`
    : '';

  if (!merchants.length) {
    el.innerHTML = `
      ${resetText}
      <div class="card" style="text-align:center; padding:40px 20px;">
        <p class="dim" style="margin:0;">
          No merchants listed yet this week. Be the first — see the form below.
        </p>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    ${resetText}
    <table class="board">
      <thead>
        <tr>
          <th style="width:60px">#</th>
          <th>Business</th>
          <th>Category</th>
          <th>Country</th>
          <th style="text-align:right">Weekly score</th>
        </tr>
      </thead>
      <tbody>
        ${merchants
          .map(
            (m, i) => `
          <tr data-href="merchant.html?id=${m.id}">
            <td class="rank">${i + 1}</td>
            <td>
              <span class="name">${esc(m.business_name)}</span>
              ${
                m.description
                  ? `<div class="dim" style="font-size:.82rem; margin-top:2px;">${esc(m.description)}</div>`
                  : ''
              }
            </td>
            <td>${esc(m.category)}</td>
            <td>${esc(m.country_code)}</td>
            <td class="votes" style="text-align:right;">
              $${Number(m.week_score_usd).toFixed(2)}
            </td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Row click → profile
  el.querySelectorAll('tr[data-href]').forEach((tr) => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') return;   // let links work normally
      location.href = tr.dataset.href;
    });
  });
}

function formatCountdown(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
