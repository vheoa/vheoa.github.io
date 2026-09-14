// ============================================
// VHEOA — Homepage globe (globe.gl tile-engine)
// ============================================

import Globe from 'https://esm.sh/globe.gl@2';

const el = document.getElementById('globe');
if (!el) throw new Error('#globe container missing');

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

// Gentle auto-rotate
let controls = world.controls();
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.enableZoom = true;
controls.minDistance = 120;
controls.maxDistance = 400;

// Responsive
window.addEventListener('resize', () => {
  world.width(el.clientWidth).height(el.clientHeight);
});

world.width(el.clientWidth).height(el.clientHeight);

// Phase 2 will populate this with:
// world.pointsData(students).pointLat('latitude').pointLng('longitude')...
