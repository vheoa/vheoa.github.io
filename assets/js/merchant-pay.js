// ============================================================
// VHEOA — Invoice payment page
// ============================================================

import { sb } from './supabase.js';

const params = new URLSearchParams(location.search);
const invoiceId = params.get('id');
const root = document.getElementById('invoice-root');

if (!invoiceId) {
  root.innerHTML = `<p class="empty">No invoice specified.</p>`;
} else {
  load();
  // Poll every 10 seconds for payment status
  setInterval(load, 10000);
}

async function load() {
  const { data, error } = await sb.rpc('get_invoice', { p_invoice_id: invoiceId });

  if (error || data?.error) {
    root.innerHTML = `<p class="empty">Invoice not found.</p>`;
    return;
  }

  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  const secondsLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const minutesLeft = Math.floor(secondsLeft / 60);
  const expired = secondsLeft <= 0 && data.status === 'pending';

  const statusBadge = {
    pending:   `<span class="badge badge-warn">Awaiting payment</span>`,
    detected:  `<span class="badge badge-info">Payment seen — awaiting confirmations</span>`,
    confirmed: `<span class="badge badge-ok">Confirmed ✓</span>`,
    expired:   `<span class="badge badge-dim">Expired</span>`,
    cancelled: `<span class="badge badge-dim">Cancelled</span>`,
  }[data.status] || '';

  const satsFormatted = Number(data.amount_sats).toLocaleString();
  const btcFormatted  = data.amount_btc;
  const btcUri = `bitcoin:${data.receive_address}?amount=${btcFormatted}`;

  root.innerHTML = `
    <section class="invoice">
      <h1>Invoice</h1>
      <p class="dim" style="margin-top:-6px;">For ${esc(data.business_name)}</p>
      <div style="margin-bottom:24px;">${statusBadge}</div>

      <div class="invoice-grid">

        <div class="invoice-block">
          <div class="invoice-label">Amount (USD)</div>
          <div class="invoice-value">$${Number(data.amount_usd).toFixed(2)}</div>
        </div>

        <div class="invoice-block">
          <div class="invoice-label">Send exactly</div>
          <div class="invoice-value" style="color:var(--accent-2);">
            ${btcFormatted} BTC
          </div>
          <div class="dim" style="font-size:0.85rem;">
            = ${satsFormatted} satoshis
          </div>
        </div>

      </div>

      <div class="invoice-block wide">
        <div class="invoice-label">To this Bitcoin address</div>
        <div class="invoice-address" id="invoice-address">
          ${esc(data.receive_address)}
        </div>
        <button class="btn secondary" id="copy-address" type="button">Copy address</button>
        <button class="btn secondary" id="copy-amount" type="button">Copy exact amount</button>
      </div>

      <div class="invoice-block wide invoice-warning">
        <strong>⚠ Send the exact amount shown above.</strong>
        The last few digits are unique to this invoice so we can match your payment.
        Sending a different amount may delay or prevent activation.
      </div>

      ${
        expired
          ? `<p class="message error">This invoice expired. <a href="merchants.html">Start over</a>.</p>`
          : data.status === 'pending'
          ? `<p class="dim" style="font-size:0.9rem;">Expires in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.</p>`
          : ''
      }

      ${
        data.detected_txid
          ? `<div class="invoice-block wide">
               <div class="invoice-label">Transaction</div>
               <a href="https://mempool.space/tx/${esc(data.detected_txid)}"
                  target="_blank" rel="noopener">
                 ${esc(data.detected_txid)} ↗
               </a>
             </div>`
          : ''
      }

      ${
        data.status === 'confirmed'
          ? `<p class="message success" style="margin-top:24px;">
               Payment confirmed. Your listing is now active on the merchant leaderboard.
             </p>`
          : ''
      }

      <p class="dim" style="margin-top:32px; font-size:0.9rem;">
        Keep this page open — it refreshes every 10 seconds and will update the moment
        we detect your transaction.
      </p>
    </section>
  `;

  document.getElementById('copy-address')?.addEventListener('click', () => {
    navigator.clipboard.writeText(data.receive_address);
    flash('Address copied');
  });

  document.getElementById('copy-amount')?.addEventListener('click', () => {
    navigator.clipboard.writeText(btcFormatted);
    flash('Amount copied');
  });

  // Bitcoin URI link on the address itself
  document.getElementById('invoice-address')?.addEventListener('click', () => {
    location.href = btcUri;
  });
}

function flash(text) {
  const div = document.createElement('div');
  div.className = 'message success';
  div.style.position = 'fixed';
  div.style.bottom = '20px';
  div.style.right = '20px';
  div.style.zIndex = '9999';
  div.textContent = text;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1500);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
