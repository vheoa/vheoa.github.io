// ============================================================
// VHEOA — Merchant submission form
// ============================================================

import { sb } from './supabase.js';
import { COUNTRIES } from './countries.js';
import { initMerchantBoard } from './merchant-board.js';

initMerchantBoard();
loadRankTargets();

const form = document.getElementById('merchant-form');
const msg  = document.getElementById('merchant-msg');
const btn  = document.getElementById('merchant-submit');

const countrySel = document.getElementById('country');
countrySel.innerHTML =
  `<option value="">Select country…</option>` +
  COUNTRIES.map((c) => `<option value="${c.code}">${c.name}</option>`).join('');

// ------------------------------------------------------------
// Load rank targets + countdown
// ------------------------------------------------------------
async function loadRankTargets() {
  const el = document.getElementById('rank-targets-content');
  const header = document.getElementById('rank-targets');
  if (!el) return;

  const { data, error } = await sb.rpc('merchant_rank_targets');

  if (error || !data) {
    el.textContent = 'Could not load current rankings.';
    return;
  }

  const resetText = data.resets_in_sec
    ? `<p class="dim" style="margin: 0 0 14px; font-size:0.85rem;">
         Next reset in <strong>${formatCountdown(data.resets_in_sec)}</strong>
       </p>`
    : '';

  const rows = (data.ranks || []).map((r) => {
    const required = Number(r.week_score_usd) + 5;
    const label =
      r.business_name
        ? `Rank #${r.rank} — ${esc(r.business_name)} ($${Number(r.week_score_usd).toFixed(2)})`
        : `Rank #${r.rank} — be the first`;
    return `
      <button type="button" class="rank-target" data-amount="${required.toFixed(2)}">
        <span class="rank-target-label">${label}</span>
        <span class="rank-target-price">pay $${required.toFixed(2)}</span>
      </button>
    `;
  }).join('');

  el.innerHTML = `
    ${resetText}
    <div class="rank-target-list">${rows}</div>
    <p class="dim" style="font-size:0.82rem; margin-top:12px;">
      Deposits add to your weekly score. Every Monday at 00:00 UTC, scores reset to $0 — everybody starts fresh.
    </p>
  `;

  // Wire click → pre-fill amount
  el.querySelectorAll('.rank-target').forEach((b) => {
    b.addEventListener('click', () => {
      document.getElementById('amount_usd').value =
        Number(b.dataset.amount).toFixed(2);
      document.getElementById('amount_usd').focus();
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

// Populate countries
const countrySel = document.getElementById('country');
countrySel.innerHTML =
  `<option value="">Select country…</option>` +
  COUNTRIES.map((c) => `<option value="${c.code}">${c.name}</option>`).join('');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.classList.add('hidden');

  const payload = {
    p_business_name: document.getElementById('business_name').value.trim(),
    p_contact_email: document.getElementById('contact_email').value.trim(),
    p_category:      document.getElementById('category').value,
    p_country_code:  countrySel.value,
    p_country_name:  countrySel.options[countrySel.selectedIndex]?.textContent || '',
    p_website_url:   document.getElementById('website_url').value.trim(),
    p_description:   document.getElementById('description').value.trim(),
    p_amount_usd:    parseFloat(document.getElementById('amount_usd').value),
  };

  if (!payload.p_business_name || !payload.p_contact_email ||
      !payload.p_category || !payload.p_country_code ||
      !Number.isFinite(payload.p_amount_usd) || payload.p_amount_usd < 5) {
    return show('Please fill in all required fields. Minimum deposit is $5.');
  }

  btn.disabled = true;
  btn.textContent = 'Fetching BTC price…';

  try {
    const { data, error } = await sb.rpc('create_merchant_invoice', payload);
    if (error) throw new Error(error.message || 'Could not create invoice.');
    if (data?.error) throw new Error(data.error);
    if (!data?.invoice_id) throw new Error('Unexpected response from server.');

    window.location.href = `merchant-pay.html?id=${data.invoice_id}`;
  } catch (err) {
    show(err.message || 'Something went wrong.');
    btn.disabled = false;
    btn.textContent = 'Create Bitcoin invoice →';
  }
});

function show(text) {
  msg.textContent = text;
  msg.className = 'message error';
  msg.classList.remove('hidden');
}
