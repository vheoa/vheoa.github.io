// ============================================================
// VHEOA — Merchant submission form
// ============================================================

import { sb } from './supabase.js';
import { COUNTRIES } from './countries.js';

const form = document.getElementById('merchant-form');
const msg  = document.getElementById('merchant-msg');
const btn  = document.getElementById('merchant-submit');

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
