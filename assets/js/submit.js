// ============================================================
// VHEOA — CV submission form (SQL backend via RPC)
// ============================================================

import { sb } from './supabase.js';
import { COUNTRIES } from './countries.js';

const { TURNSTILE_SITE_KEY, GEO_API } = window.VHEOA;

// ------------------------------------------------------------
// 1. Populate country dropdown
// ------------------------------------------------------------
const countrySel = document.getElementById('country');

countrySel.innerHTML =
  `<option value="">Select country…</option>` +
  COUNTRIES.map((c) => `<option value="${c.code}">${c.name}</option>`).join('');

// ------------------------------------------------------------
// 2. Auto-detect visitor country (cached 24h in localStorage)
// ------------------------------------------------------------
(async () => {
  try {
    const cached = localStorage.getItem('vheoa_country');
    if (cached && COUNTRIES.some((c) => c.code === cached)) {
      countrySel.value = cached;
      return;
    }
    const r = await fetch(GEO_API).then((res) => res.json());
    if (r?.country_code && COUNTRIES.some((c) => c.code === r.country_code)) {
      countrySel.value = r.country_code;
      localStorage.setItem('vheoa_country', r.country_code);
    }
  } catch {
    /* silent — user can pick manually */
  }
})();

// ------------------------------------------------------------
// 3. Portfolio links (add / remove rows, max 5)
// ------------------------------------------------------------
const portList = document.getElementById('portfolio-list');

function addPortfolioRow() {
  if (portList.children.length >= 5) return;

  const row = document.createElement('div');
  row.className = 'portfolio-row';
  row.innerHTML = `
    <input type="text" class="p-label" placeholder="Label (e.g. GitHub)" maxlength="40" />
    <input type="url" class="p-url" placeholder="https://…" />
    <button type="button" class="remove-row" aria-label="Remove">×</button>
  `;
  row.querySelector('.remove-row').addEventListener('click', () => row.remove());
  portList.appendChild(row);
}

document.getElementById('add-portfolio').addEventListener('click', addPortfolioRow);
addPortfolioRow(); // start with one empty row

// ------------------------------------------------------------
// 4. Turnstile widget
// ------------------------------------------------------------
let turnstileToken = '';
let turnstileWidgetId = null;

// These must be on window — Turnstile looks them up by string name.
window.onTurnstileSuccess = (t) => { turnstileToken = t; };
window.onTurnstileExpired = () => { turnstileToken = ''; };
window.onTurnstileError   = () => { turnstileToken = ''; };

function renderTurnstile() {
  if (!window.turnstile) return;
  const container = document.getElementById('turnstile-widget');
  if (!container || container.dataset.rendered === 'true') return;

  turnstileWidgetId = window.turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    callback: 'onTurnstileSuccess',
    'expired-callback': 'onTurnstileExpired',
    'error-callback': 'onTurnstileError',
    theme: 'dark',
  });
  container.dataset.rendered = 'true';
}

// Turnstile is loaded with `async defer`, so it may not exist yet at DOM ready.
window.addEventListener('load', renderTurnstile);
// Fallback for slow script loads
const turnstilePoll = setInterval(() => {
  if (window.turnstile) {
    renderTurnstile();
    clearInterval(turnstilePoll);
  }
}, 200);
setTimeout(() => clearInterval(turnstilePoll), 10000);

// ------------------------------------------------------------
// 5. Form helpers
// ------------------------------------------------------------
const form = document.getElementById('submit-form');
const msg  = document.getElementById('form-message');
const btn  = document.getElementById('submit-btn');

function showMsg(text, kind = 'error') {
  msg.textContent = text;
  msg.className = `message ${kind}`;
  msg.classList.remove('hidden');
}

function resetTurnstile() {
  turnstileToken = '';
  if (window.turnstile && turnstileWidgetId !== null) {
    try { window.turnstile.reset(turnstileWidgetId); } catch { /* noop */ }
  }
}

// ------------------------------------------------------------
// 6. Submit handler
// ------------------------------------------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!turnstileToken) {
    return showMsg('Please wait for the security check to finish.');
  }

  const portfolio = [...portList.querySelectorAll('.portfolio-row')]
    .map((r) => ({
      label: r.querySelector('.p-label').value.trim(),
      url:   r.querySelector('.p-url').value.trim(),
    }))
    .filter((x) => x.url);

  const payload = {
    p_full_name:       form.full_name.value.trim(),
    p_email:           form.email.value.trim(),
    p_country_code:    form.country.value,
    p_country_name:    countrySel.options[countrySel.selectedIndex]?.textContent || '',
    p_course:          form.course.value.trim(),
    p_cv_url:          form.cv_url.value.trim(),
    p_portfolio_links: portfolio,
    p_turnstile_token: turnstileToken,
  };

  if (
    !payload.p_full_name ||
    !payload.p_email ||
    !payload.p_country_code ||
    !payload.p_course ||
    !payload.p_cv_url
  ) {
    return showMsg('Please fill in all required fields.');
  }

  btn.disabled = true;
  btn.textContent = 'Submitting…';
  msg.classList.add('hidden');

  try {
    const { data, error } = await sb.rpc('submit_cv', payload);

    if (error) throw new Error(error.message || 'Submission failed.');
    if (data?.error) throw new Error(data.error);
    if (!data?.student_id) throw new Error('Unexpected response from server.');

    showMsg('Success! Redirecting to your profile…', 'success');

    setTimeout(() => {
      window.location.href = `student.html?id=${data.student_id}`;
    }, 900);

  } catch (err) {
    showMsg(err.message || 'Something went wrong. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Submit CV';
    resetTurnstile();
  }
});
