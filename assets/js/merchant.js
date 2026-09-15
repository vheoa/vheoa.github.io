// ============================================================
// VHEOA — Merchant profile page
// ============================================================

import { sb } from './supabase.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');
const root = document.getElementById('merchant-root');

if (!id) {
  root.innerHTML = `<p class="empty">No merchant specified.</p>`;
} else {
  load();
}

async function load() {
  const { data, error } = await sb.rpc('get_merchant', { p_merchant_id: id });

  if (error || data?.error) {
    root.innerHTML = `<p class="empty">Merchant not found.</p>`;
    return;
  }

  document.title = `${data.business_name} — Vheoa`;

  const resetText = data.resets_in_sec
    ? `Rankings reset in <strong>${formatCountdown(data.resets_in_sec)}</strong>`
    : '';

  const joined = new Date(data.created_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  const lastPaid = data.last_payment_at
    ? new Date(data.last_payment_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : null;

  root.innerHTML = `
    <section class="profile">
      <div class="profile-head">
        <div>
          <h1>${esc(data.business_name)}</h1>
          <p class="meta">
            <span class="flag">${esc(data.country_code)}</span>
            ${esc(data.category)}
          </p>
          <p class="meta small">
            Listed ${joined}${lastPaid ? ` · last payment ${lastPaid}` : ''}
          </p>
        </div>
        <div class="score">
          <div class="score-num">#${data.rank}</div>
          <div class="score-label">current rank</div>
        </div>
      </div>

      ${
        data.description
          ? `<p class="merchant-description">${esc(data.description)}</p>`
          : ''
      }

      <div class="actions">
        ${
          data.website_url
            ? `<a class="btn" href="${esc(data.website_url)}" target="_blank" rel="noopener nofollow">
                 Visit website ↗
               </a>`
            : ''
        }
        <a class="btn secondary" href="merchants.html">Back to directory</a>
      </div>

      <div class="merchant-stats">
        <div class="stat">
          <div class="stat-label">This week</div>
          <div class="stat-value">$${Number(data.week_score_usd).toFixed(2)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Lifetime paid</div>
          <div class="stat-value">$${Number(data.total_paid_usd).toFixed(2)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Resets</div>
          <div class="stat-value small">${resetText || '—'}</div>
        </div>
      </div>
    </section>
  `;
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
