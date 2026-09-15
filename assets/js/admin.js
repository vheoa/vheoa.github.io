// ============================================================
// VHEOA — Admin dashboard
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.VHEOA;

// Admin needs a session-persisted client (differs from the public one)
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: 'vheoa-admin' },
});

const loginView = document.getElementById('login-view');
const dashView  = document.getElementById('dash-view');
const userLabel = document.getElementById('admin-user');
const logoutLink = document.getElementById('admin-logout');

let allMerchants = [];
const loginForm = document.getElementById('login-form');
const loginMsg  = document.getElementById('login-msg');
const loginBtn  = document.getElementById('login-btn');

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
init();

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await enterDashboard(session);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.classList.remove('hidden');
  dashView.classList.add('hidden');
  logoutLink.style.display = 'none';
  userLabel.textContent = '';
}

async function enterDashboard(session) {
  // Check admin status
  const { data: isAdmin, error } = await sb.rpc('is_admin');

  if (error || !isAdmin) {
    showMsg(loginMsg, 'This account does not have admin access.', 'error');
    await sb.auth.signOut();
    showLogin();
    return;
  }

  loginView.classList.add('hidden');
  dashView.classList.remove('hidden');
  logoutLink.style.display = '';
  userLabel.textContent = session.user.email || '';

  loadReports();
  loadSpikes();
  loadHidden();
  loadMerchants();
}

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';
  showMsg(loginMsg, '', 'hidden');

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = 'Log in';

  if (error) {
    showMsg(loginMsg, error.message || 'Login failed.', 'error');
    return;
  }

  await enterDashboard(data.session);
});

logoutLink.addEventListener('click', async (e) => {
  e.preventDefault();
  await sb.auth.signOut();
  showLogin();
});

// ------------------------------------------------------------
// Tabs
// ------------------------------------------------------------
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    document.getElementById('panel-' + target).classList.remove('hidden');
  });
});

// ------------------------------------------------------------
// Reports
// ------------------------------------------------------------
async function loadReports() {
  const el = document.getElementById('panel-reports');
  el.innerHTML = `<p class="loading">Loading reports…</p>`;

  const { data, error } = await sb.rpc('admin_list_reports');

  if (error) {
    el.innerHTML = `<p class="empty">Error: ${esc(error.message)}</p>`;
    return;
  }

  document.getElementById('reports-count').textContent =
    data.length ? `(${data.length})` : '';

  if (!data.length) {
    el.innerHTML = `<p class="empty">No pending reports. </p>`;
    return;
  }

  el.innerHTML = `
    <table class="board">
      <thead>
        <tr>
          <th>Student</th>
          <th>Country</th>
          <th>Reason</th>
          <th>Reported</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (r) => `
          <tr>
            <td>
              <a href="student.html?id=${r.student_id}" target="_blank" rel="noopener">
                ${esc(r.student_name)}
              </a>
              <div class="dim" style="font-size:.82rem;">
                ${esc(r.course)} · ${r.upvote_count} upvotes
              </div>
            </td>
            <td>${esc(r.country_code)}</td>
            <td style="max-width:300px;">${esc(r.reason)}</td>
            <td class="dim">${new Date(r.report_created).toLocaleDateString()}</td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn ghost" data-act="dismiss" data-id="${r.report_id}">Dismiss</button>
              <button class="btn" data-act="hide_student" data-id="${r.report_id}">Hide student</button>
            </td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;

  el.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => resolveReport(btn));
  });
}

async function resolveReport(btn) {
  const reportId = btn.dataset.id;
  const action   = btn.dataset.act;

  if (action === 'hide_student') {
    if (!confirm('Hide this student profile? This removes them from all leaderboards.')) return;
  }

  btn.disabled = true;
  btn.textContent = '…';

  const { data, error } = await sb.rpc('admin_resolve_report', {
    p_report_id: Number(reportId),
    p_action:    action,
  });

  if (error || data?.error) {
    alert('Failed: ' + (error?.message || data.error));
    btn.disabled = false;
    btn.textContent = action === 'hide_student' ? 'Hide student' : 'Dismiss';
    return;
  }

  loadReports();
  loadHidden();
}

// ------------------------------------------------------------
// Vote spikes
// ------------------------------------------------------------
async function loadSpikes() {
  const el = document.getElementById('panel-spikes');
  el.innerHTML = `<p class="loading">Loading…</p>`;

  const { data, error } = await sb.rpc('admin_vote_spikes');

  if (error) {
    el.innerHTML = `<p class="empty">Error: ${esc(error.message)}</p>`;
    return;
  }

  if (!data.length) {
    el.innerHTML = `<p class="empty">No data yet.</p>`;
    return;
  }

  el.innerHTML = `
    <table class="board">
      <thead>
        <tr>
          <th>Student</th>
          <th>Country</th>
          <th style="text-align:right">Today</th>
          <th style="text-align:right">Last 7d</th>
          <th style="text-align:right">Total</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (s) => `
          <tr>
            <td>
              <a href="student.html?id=${s.student_id}" target="_blank" rel="noopener">
                ${esc(s.student_name)}
              </a>
            </td>
            <td>${esc(s.country_code)}</td>
            <td style="text-align:right; font-variant-numeric:tabular-nums;">
              ${s.votes_today}
            </td>
            <td style="text-align:right; font-variant-numeric:tabular-nums;">
              ${s.votes_7d}
            </td>
            <td style="text-align:right; font-variant-numeric:tabular-nums;">
              ${s.total_votes}
            </td>
            <td style="text-align:right;">
              <button class="btn ghost" data-act="hide" data-id="${s.student_id}">Hide</button>
            </td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;

  el.querySelectorAll('button[data-act="hide"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hide this student profile?')) return;
      btn.disabled = true;
      btn.textContent = '…';
      const { data, error } = await sb.rpc('admin_set_hidden', {
        p_student_id: btn.dataset.id,
        p_hidden:     true,
      });
      if (error || data?.error) {
        alert('Failed: ' + (error?.message || data.error));
        btn.disabled = false;
        btn.textContent = 'Hide';
        return;
      }
      loadSpikes();
      loadHidden();
    });
  });
}

// ------------------------------------------------------------
// Hidden students
// ------------------------------------------------------------
async function loadHidden() {
  const el = document.getElementById('panel-hidden');
  el.innerHTML = `<p class="loading">Loading…</p>`;

  const { data, error } = await sb.rpc('admin_list_hidden');

  if (error) {
    el.innerHTML = `<p class="empty">Error: ${esc(error.message)}</p>`;
    return;
  }

  if (!data.length) {
    el.innerHTML = `<p class="empty">No hidden students.</p>`;
    return;
  }

  el.innerHTML = `
    <table class="board">
      <thead>
        <tr>
          <th>Student</th>
          <th>Country</th>
          <th>Course</th>
          <th style="text-align:right">Upvotes</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (s) => `
          <tr>
            <td>${esc(s.student_name)}</td>
            <td>${esc(s.country_code)}</td>
            <td>${esc(s.course)}</td>
            <td style="text-align:right;">${s.upvote_count}</td>
            <td style="text-align:right;">
              <button class="btn" data-act="unhide" data-id="${s.student_id}">Unhide</button>
            </td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;

  el.querySelectorAll('button[data-act="unhide"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      const { data, error } = await sb.rpc('admin_set_hidden', {
        p_student_id: btn.dataset.id,
        p_hidden:     false,
      });
      if (error || data?.error) {
        alert('Failed: ' + (error?.message || data.error));
        btn.disabled = false;
        btn.textContent = 'Unhide';
        return;
      }
      loadHidden();
      loadReports();
    });
  });
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function showMsg(el, text, kind) {
  if (kind === 'hidden' || !text) {
    el.classList.add('hidden');
    return;
  }
  el.textContent = text;
  el.className = `message ${kind}`;
  el.classList.remove('hidden');
}
// ------------------------------------------------------------
// Merchants
// ------------------------------------------------------------
let currentMerchantFilter = 'all';

async function loadMerchants() {
  const el = document.getElementById('panel-merchants');
  if (!el) return;

  el.innerHTML = `<p class="loading">Loading merchants…</p>`;

  const { data, error } = await sb.rpc('admin_list_merchants');

  if (error) {
    el.innerHTML = `<p class="empty">Error: ${esc(error.message)}</p>`;
    return;
  }

  allMerchants = data || [];

  document.getElementById('merchants-count').textContent =
    allMerchants.filter((m) => m.status === 'pending_payment').length
      ? `(${allMerchants.filter((m) => m.status === 'pending_payment').length} pending)`
      : '';

  renderMerchants();
}

function renderMerchants() {
  const el = document.getElementById('panel-merchants');
  if (!el) return;

  const counts = {
    all:             allMerchants.length,
    pending_payment: allMerchants.filter((m) => m.status === 'pending_payment').length,
    active:          allMerchants.filter((m) => m.status === 'active').length,
    hidden:          allMerchants.filter((m) => m.status === 'hidden').length,
    expired:         allMerchants.filter((m) => m.status === 'expired').length,
  };

  const filterHtml = `
    <div class="merchant-filters">
      ${[
        ['all',             'All'],
        ['pending_payment', 'Pending'],
        ['active',          'Active'],
        ['hidden',          'Hidden'],
        ['expired',         'Expired'],
      ]
        .map(
          ([key, label]) => `
            <button class="filter-btn ${currentMerchantFilter === key ? 'active' : ''}"
                    data-filter="${key}">
              ${label} (${counts[key]})
            </button>`,
        )
        .join('')}
    </div>
  `;

  const list =
    currentMerchantFilter === 'all'
      ? allMerchants
      : allMerchants.filter((m) => m.status === currentMerchantFilter);

  if (!list.length) {
    el.innerHTML = filterHtml + `<p class="empty">No merchants in this view.</p>`;
    wireMerchantFilters();
    return;
  }

  el.innerHTML =
    filterHtml +
    `
    <table class="board">
      <thead>
        <tr>
          <th>Business</th>
          <th>Contact</th>
          <th>Category</th>
          <th>Status</th>
          <th style="text-align:right">Week</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(renderMerchantRow).join('')}
      </tbody>
    </table>
  `;

  wireMerchantFilters();
  wireMerchantActions();
}

function renderMerchantRow(m) {
  const isPending   = m.status === 'pending_payment';
  const invoiceGone = isPending && m.pending_expires_at && new Date(m.pending_expires_at) < new Date();

  // Status badge
  let badge;
  if (isPending) {
    badge = invoiceGone
      ? `<span class="badge badge-dim">Pending (expired)</span>`
      : `<span class="badge badge-warn">Pending — awaiting BTC</span>`;
  } else if (m.status === 'active') {
    badge = `<span class="badge badge-ok">Active</span>`;
  } else if (m.status === 'hidden') {
    badge = `<span class="badge badge-dim">Hidden</span>`;
  } else {
    badge = `<span class="badge badge-dim">${esc(m.status)}</span>`;
  }

  // Pending info line
  let pendingLine = '';
  if (isPending && m.pending_amount != null) {
    const mins = m.pending_expires_at
      ? Math.max(0, Math.floor((new Date(m.pending_expires_at) - new Date()) / 60000))
      : null;
    pendingLine = `
      <div class="dim" style="font-size:.78rem; margin-top:4px;">
        Invoice $${Number(m.pending_amount).toFixed(2)}
        ${mins != null ? ` · expires in ${mins}m` : ''}
      </div>`;
  }

  // Action buttons per status
  const actions = [];
  if (isPending) {
    actions.push(
      `<button class="btn ghost" data-act="cancel_pending" data-id="${m.merchant_id}">Cancel</button>`,
    );
  } else if (m.status === 'active') {
    actions.push(
      `<a class="btn ghost" href="merchant.html?id=${m.merchant_id}" target="_blank" rel="noopener">View</a>`,
      `<button class="btn ghost" data-act="hide" data-id="${m.merchant_id}">Hide</button>`,
    );
  } else if (m.status === 'hidden') {
    actions.push(
      `<button class="btn ghost" data-act="activate" data-id="${m.merchant_id}">Unhide</button>`,
    );
  } else if (m.status === 'expired') {
    actions.push(
      `<button class="btn ghost" data-act="activate" data-id="${m.merchant_id}">Reactivate</button>`,
    );
  }

  return `
    <tr>
      <td>
        <span class="name">${esc(m.business_name)}</span>
        ${m.website_url ? `<div class="dim" style="font-size:.78rem;">${esc(shortUrl(m.website_url))}</div>` : ''}
      </td>
      <td class="dim" style="font-size:.82rem;">${esc(m.contact_email)}</td>
      <td>${esc(m.category)}</td>
      <td>
        ${badge}
        ${pendingLine}
      </td>
      <td class="votes" style="text-align:right;">$${Number(m.week_score_usd).toFixed(2)}</td>
      <td style="text-align:right; white-space:nowrap;">${actions.join('')}</td>
    </tr>
  `;
}

function wireMerchantFilters() {
  document.querySelectorAll('.filter-btn').forEach((b) => {
    b.addEventListener('click', () => {
      currentMerchantFilter = b.dataset.filter;
      renderMerchants();
    });
  });
}

function wireMerchantActions() {
  document.querySelectorAll('#panel-merchants button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => handleMerchantAction(btn));
  });
}

async function handleMerchantAction(btn) {
  const id     = btn.dataset.id;
  const action = btn.dataset.act;

  const confirmations = {
    cancel_pending: 'Delete this pending merchant? No payment has been received.',
    hide:           'Hide this merchant from the public directory?',
    activate:       'Make this merchant visible on the public directory?',
  };

  if (confirmations[action] && !confirm(confirmations[action])) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '…';

  let result;
  if (action === 'cancel_pending') {
    result = await sb.rpc('admin_cancel_pending_merchant', { p_merchant_id: id });
  } else if (action === 'hide') {
    result = await sb.rpc('admin_set_merchant_status', { p_merchant_id: id, p_status: 'hidden' });
  } else if (action === 'activate') {
    result = await sb.rpc('admin_set_merchant_status', { p_merchant_id: id, p_status: 'active' });
  } else {
    result = { error: { message: 'Unknown action' } };
  }

  const { error, data } = result;
  if (error || data?.error) {
    alert('Failed: ' + (error?.message || data.error));
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }

  // Reload
  loadMerchants();
}

function shortUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return u.slice(0, 40);
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
