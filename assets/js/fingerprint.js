// ============================================================
// VHEOA — Device fingerprint
// A stable hash derived from browser + hardware signals.
// Not perfect, but combined with IP + daily salt it is enough.
// ============================================================

let cachedFingerprint = null;

export async function getFingerprint() {
  if (cachedFingerprint) return cachedFingerprint;

  const parts = [
    navigator.userAgent || '',
    navigator.language || '',
    (screen.width || 0) + 'x' + (screen.height || 0),
    String(screen.colorDepth || 0),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency || 0),
    navigator.platform || '',
  ];

  // Canvas rendering fingerprint
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('VheoaFP', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('VheoaFP', 4, 17);
      parts.push(canvas.toDataURL());
    }
  } catch { /* ignore */ }

  // WebGL vendor / renderer fingerprint
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (ext && gl) {
      parts.push(String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || ''));
      parts.push(String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''));
    }
  } catch { /* ignore */ }

  const raw = parts.join('|');
  const buf = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  cachedFingerprint = [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return cachedFingerprint;
}
