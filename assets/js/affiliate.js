// ============================================================
// VHEOA — Geo-targeted affiliate strip
// ============================================================

const { GEO_API } = window.VHEOA;

const FALLBACK = [
  { name: 'Notion',  tag: 'Study Tools', url: 'https://notion.grsm.io/vheoa' },
  { name: 'Grammarly', tag: 'Writing',   url: 'https://grammarly.go2cloud.org/vheoa' },
];

// Small mapping — expand as you join more programs.
// Keys are ISO-3166 alpha-2 country codes.
const BY_COUNTRY = {
  IN: [
    { name: 'Amazon IN', tag: 'Books', url: 'https://amzn.to/vheoa-in' },
    { name: 'Flipkart', tag: 'Supplies', url: 'https://fkrt.it/vheoa' },
  ],
  US: [
    { name: 'BooksRun', tag: 'Textbooks', url: 'https://booksrun.com/?ref=vheoa' },
    { name: 'Chegg',    tag: 'Study Help', url: 'https://chegg.com/?ref=vheoa' },
  ],
  GB: [
    { name: 'Waterstones', tag: 'Books', url: 'https://waterstones.com/?ref=vheoa' },
  ],
  NG: [
    { name: 'Jumia', tag: 'Supplies', url: 'https://jumia.com.ng/?ref=vheoa' },
  ],
  BR: [
    { name: 'Amazon BR', tag: 'Books', url: 'https://amzn.to/vheoa-br' },
  ],
  // Add more as you join programs
};

export async function initAffiliateStrip() {
  const strip = document.getElementById('affiliate-strip');
  if (!strip) return;

  let country = localStorage.getItem('vheoa_country');

  if (!country) {
    try {
      const r = await fetch(GEO_API).then((res) => res.json());
      country = r?.country_code || null;
      if (country) localStorage.setItem('vheoa_country', country);
    } catch { /* silent */ }
  }

  const list = (country && BY_COUNTRY[country]) || FALLBACK;

  strip.innerHTML = `
    <div class="affiliate-inner">
      <span class="affiliate-label">Student resources</span>
      ${list
        .map(
          (a) => `
        <a class="affiliate-link" href="${a.url}" target="_blank" rel="noopener nofollow sponsored">
          <span class="affiliate-name">${a.name}</span>
          <span class="affiliate-tag">${a.tag}</span>
        </a>`,
        )
        .join('')}
    </div>
  `;
}
