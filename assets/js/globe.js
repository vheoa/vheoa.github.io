// ============================================================
// VHEOA — Homepage globe with live student data
// ============================================================

import Globe from 'https://esm.sh/globe.gl@2';
import { sb } from './supabase.js';
import { GEO } from './geo.js';
import { countryName } from './countries.js';

const el = document.getElementById('globe');
if (!el) throw new Error('#globe container missing');

// ------------------------------------------------------------
// 1. Build the globe
// ------------------------------------------------------------
const world = new Globe(el)
  .globeTileEngineUrl((x, y, l) =>
    `https://tile.openstreetmap.org/${l}/${x}/${y}.png`
  )
  .globeTileEngineMaxLevel(5)
  .backgroundColor('rgba(0,0,0,0)')
  .showAtmosphere(true)
  .atmosphereColor('#4f8cff')
  .atmosphereAltitude(0.18)
  .pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 0);

world.width(el.clientWidth).height(el.clientHeight);

const controls = world.controls();
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.enableZoom = true;
controls.minDistance = 120;
controls.maxDistance = 400;

window.addEventListener('resize', () => {
  world.width(el.clientWidth).height(el.clientHeight);
});

// ------------------------------------------------------------
// 2. Fetch students (small payload — only 5 columns)
// ------------------------------------------------------------
async function loadGlobeData() {
  const { data, error } = await sb
    .from('students')
    .select('id, full_name, country_code, country_name, upvote_count, created_at')
    .eq('hidden', false)
    .order('upvote_count', { ascending: false })
    .limit(3000);

  if (error || !data) {
    console.warn('Globe: failed to load students', error);
    return;
  }

  const byCountry = aggregate(data);
  renderPoints(byCountry);
  renderTicker(data);
}

// ------------------------------------------------------------
// 3. Aggregate students by country
// ------------------------------------------------------------
function aggregate(students) {
  const map = {};

  for (const s of students) {
    const code = (s.country_code || '').toUpperCase();
    if (!code || !GEO[code]) continue;

    if (!map[code]) {
      map[code] = {
        code,
        name: s.country_name || countryName(code),
        count: 0,
        totalUpvotes: 0,
        top: null,
        lat: GEO[code].lat,
        lng: GEO[code].lng,
      };
    }

    map[code].count += 1;
    map[code].totalUpvotes += s.upvote_count || 0;

    if (!map[code].top || s.upvote_count > map[code].top.upvote_count) {
      map[code].top = s;
    }
  }

  return Object.values(map);
}

// ------------------------------------------------------------
// 4. Plot markers
// ------------------------------------------------------------
function renderPoints(points) {
  const maxCount   = Math.max(1, ...points.map((p) => p.count));
  const maxUpvotes = Math.max(1, ...points.map((p) => p.totalUpvotes));

  world
    .pointsData(points)
    .pointLat('lat')
    .pointLng('lng')
    .pointAltitude((p) => 0.01 + (p.totalUpvotes / maxUpvotes) * 0.15)
    .pointRadius((p) => 0.4 + (p.count / maxCount) * 1.6)
    .pointColor((p) => colorFor(p.totalUpvotes / maxUpvotes))
    .pointLabel((p) => `
      <div style="
        background: rgba(11,13,18,0.95);
        border: 1px solid #1e2430;
        border-radius: 8px;
        padding: 10px 14px;
        color: #e7ebf3;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        max-width: 240px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      ">
        <div style="font-weight:600; margin-bottom:4px;">
          ${escapeHtml(p.name)}
        </div>
        <div style="color:#8b93a7; font-size:12px;">
          ${p.count} student${p.count === 1 ? '' : 's'} · ${p.totalUpvotes} upvotes
        </div>
        ${
          p.top
            ? `<div style="color:#22d3a5; font-size:12px; margin-top:6px;">
                 Top: ${escapeHtml(p.top.full_name)} (${p.top.upvote_count})
               </div>`
            : ''
        }
      </div>
    `)
    .onPointClick((p) => {
      window.location.href = `leaderboard.html?country=${p.code}`;
    });

  // Slow rotation, but stop when hovering a point
  world.onPointHover((p) => {
    controls.autoRotate = !p;
  });
}

// Upvote-ratio → colour (cool blue → hot green)
function colorFor(ratio) {
  const r = Math.round(79  + (34  - 79)  * ratio);
  const g = Math.round(140 + (211 - 140) * ratio);
  const b = Math.round(255 + (165 - 255) * ratio);
  return `rgba(${r},${g},${b},0.95)`;
}

// ------------------------------------------------------------
// 5. Recently joined ticker (below the globe)
// ------------------------------------------------------------
function renderTicker(students) {
  const ticker = document.getElementById('ticker');
  if (!ticker) return;

  const recent = [...students]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  if (!recent.length) {
    ticker.innerHTML = `<p class="dim" style="text-align:center;">No students yet — be the first to submit.</p>`;
    return;
  }

  ticker.innerHTML = `
    <h3 class="ticker-title">Recently joined</h3>
    <div class="ticker-row">
      ${recent
        .map(
          (s) => `
        <a class="ticker-card" href="student.html?id=${s.id}">
          <div class="ticker-name">${escapeHtml(s.full_name)}</div>
          <div class="ticker-meta">
            ${escapeHtml(countryName(s.country_code))} · ${s.upvote_count} upvotes
          </div>
        </a>`,
        )
        .join('')}
    </div>
  `;
}

// ------------------------------------------------------------
// 6. Utilities
// ------------------------------------------------------------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

// ------------------------------------------------------------
// 7. Go
// ------------------------------------------------------------
loadGlobeData();
