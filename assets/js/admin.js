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

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
