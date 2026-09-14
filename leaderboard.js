// ============================================================
// VHEOA — Leaderboard with country + course filters
// ============================================================

import { sb } from './supabase.js';
import { COUNTRIES, countryName } from './countries.js';

const board       = document.getElementById('board');
const countrySel  = document.getElementById('filter-country');
const courseInput = document.getElementById('filter-course');
const clearBtn    = document.getElementById('clear-filters');

countrySel.innerHTML =
  `<option value="">All countries</option>` +
  COUNTRIES.map((c) => `<option value="${c.code}">${c.name}</option>`).join('');

// Read initial filters from URL
const params = new URLSearchParams(location.search);
if (params.get('country')) countrySel.value = params.get('country').toUpperCase();
if (params.get('course'))  courseInput.value = params.get('course');

countrySel.addEventListener('change', refresh);
courseInput.addEventListener('input', debounce(refresh, 300));
clearBtn.addEventListener('click', () => {
  countrySel.value = '';
  courseInput.value = '';
  history.replaceState(null, '', 'leaderboard.html');
  refresh();
});

async function refresh() {
  board.innerHTML = `<p class="loading">Loading…</p>`;

  const country = countrySel.value;
  const course  = courseInput.value.trim();

  let q = sb
    .from('students')
    .select('id, full_name, country_code, course, upvote_count, created_at')
    .eq('hidden', false)
    .order('upvote_count', { ascending: false })
    .order('created_at',   { ascending: true })
    .limit(100);

  if (country) q = q.eq('country_code', country);
  if (course)  q = q.ilike('course', `%${course}%`);

  const { data, error } = await q;

  if (error) {
    board.innerHTML = `<p class="empty">Failed to load.</p>`;
    return;
  }
  if (!data.length) {
    board.innerHTML = `<p class="empty">No students match this filter yet.</p>`;
    return;
  }

  const u = new URL(location.href);
  u.search = '';
  if (country) u.searchParams.set('country', country);
  if (course)  u.searchParams.set('course', course);
  history.replaceState(null, '', u.toString());

  board.innerHTML = `
    <table class="board">
      <thead>
        <tr>
          <th style="width:60px">#</th>
          <th>Student</th>
          <th>Country</th>
          <th>Course</th>
          <th style="text-align:right">Upvotes</th>
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (s, i) => `
          <tr data-id="${s.id}" tabindex="0">
            <td class="rank">${i + 1}</td>
            <td class="name">${esc(s.full_name)}</td>
            <td>${esc(countryName(s.country_code))}</td>
            <td>${esc(s.course)}</td>
            <td class="votes">${s.upvote_count}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;

  board.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => {
      location.href = `student.html?id=${tr.dataset.id}`;
    });
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') location.href = `student.html?id=${tr.dataset.id}`;
    });
  });
}

refresh();

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
