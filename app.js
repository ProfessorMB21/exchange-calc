/* =====================================================================
   CONFIG
   ---------------------------------------------------------------------
   To add a currency, add ONE entry to CURRENCIES below.
     perBase  : how many units of this currency equal 1 unit of BASE
                (e.g. ZMW: 0.210434 means 1 RUB = 0.210434 ZMW)
     decimals : minor-unit digits (default 2)
     quick    : quick-amount chips shown when it's the sending currency
     grad     : badge gradient (keep to blues to match the theme)
   Any pair is supported automatically via the base currency.
   To fix the rate for a specific pair, add it to PAIR_OVERRIDES
   (e.g. 'RUB>ZMW': { rate: 0.2105, commission: 0.025 }). Both keys optional.
   ===================================================================== */
const CONFIG = {
  base: 'RUB',
  commission: 0.03,            // default commission: 3% of the amount sent
  defaultFrom: 'RUB',
  defaultTo: 'ZMW',
};
const CURRENCIES = {
  RUB: { name:'Russian Ruble',  symbol:'₽', badge:'₽', perBase:1,        decimals:2, quick:[1000,5000,10000,50000], grad:['#60a5fa','#1e3a8a'] },
  ZMW: { name:'Zambian Kwacha', symbol:'K', badge:'K', perBase:0.227977, decimals:2, quick:[200,1000,2500,10000],   grad:['#7dd3fc','#1d4ed8'] },
};
const PAIR_OVERRIDES = {
  // 'RUB>ZMW': { rate: 0.210434, commission: 0.03 },
};
/* ===================================================================== */

const $ = id => document.getElementById(id);
const state = { from: CONFIG.defaultFrom, to: CONFIG.defaultTo, mode: 'send' };
const codes = () => Object.keys(CURRENCIES);

/* ---------- number helpers ---------- */
const dp = c => CURRENCIES[c].decimals ?? 2;
const fmt = (n, c) => new Intl.NumberFormat('en-US',{minimumFractionDigits:dp(c),maximumFractionDigits:dp(c)}).format(n);
const rnd = (x, d) => { const f = 10 ** d; return Math.round((x + Number.EPSILON) * f) / f; };
const ceilTo = (x, d) => { const f = 10 ** d; return Math.ceil(x * f - 1e-9) / f; };
const rateStr = r => r >= 100 ? r.toFixed(4) : r.toFixed(6);
const pctOf = c => { const p = c * 100; return (Number.isInteger(p) ? p : +p.toFixed(2)) + '%'; };

/* ---------- pair config ---------- */
function pairInfo(from, to){
  const o = PAIR_OVERRIDES[`${from}>${to}`] || {};
  const rate = o.rate ?? (CURRENCIES[to].perBase / CURRENCIES[from].perBase);
  const commission = o.commission ?? CONFIG.commission;
  return { rate, commission };
}

/* ---------- calculations ---------- */
// Forward: amount sent -> amount received
function forward(send, from, to){
  const { rate, commission: c } = pairInfo(from, to);
  const commission = rnd(send * c, dp(from));
  const net = rnd(send - commission, dp(from));
  const received = rnd(net * rate, dp(to));
  return { send, commission, net, rate, c, received };
}
// Reverse: amount recipient must get -> amount to send
function reverse(target, from, to){
  const { rate, c } = { ...pairInfo(from, to), c: pairInfo(from, to).commission };
  const netNeeded = target / rate;            // what must survive the commission, in sending currency
  const gross = netNeeded / (1 - c);          // gross-up for the commission
  let send = ceilTo(gross, dp(from));         // never short-change the recipient
  let f = forward(send, from, to);
  const step = 1 / 10 ** dp(from);
  for (let i = 0; f.received < target - 1e-9 && i < 100; i++){ send = rnd(send + step, dp(from)); f = forward(send, from, to); }
  return { ...f, target, netNeeded, gross };
}

/* ---------- input handling ---------- */
function sanitize(raw, cur){
  let v = raw.replace(/[^\d.,]/g,'').replace(/,/g,'');
  const i = v.indexOf('.');
  const d = dp(cur);
  if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g,'').slice(0, d);
  if (d === 0) v = v.replace(/\./g,'');
  if (v.length > 13) v = v.slice(0, 13);
  return v;
}
const driverInput = () => state.mode === 'send' ? $('fromInput') : $('toInput');
const computedInput = () => state.mode === 'send' ? $('toInput') : $('fromInput');

/* ---------- currency picker ---------- */
const TICK = '<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const badgeHTML = c => { const d = CURRENCIES[c]; return `<div class="badge" style="background:linear-gradient(135deg,${d.grad[0]},${d.grad[1]})">${d.badge}</div>`; };

function renderPickers(){
  for (const side of ['from','to']){
    const cur = state[side];
    $(side + 'Cur').innerHTML = `${badgeHTML(cur)}<div><span>${cur}</span><small>${CURRENCIES[cur].name}</small></div>${CHEV}`;
    $(side + 'Menu').innerHTML = codes().map(c =>
      `<li role="option" tabindex="0" data-code="${c}" aria-selected="${c === cur}">${badgeHTML(c)}<div>${c}<small>${CURRENCIES[c].name}</small></div>${TICK}</li>`
    ).join('');
  }
}
function closeMenus(){
  for (const side of ['from','to']){
    $(side + 'Field').classList.remove('open');
    $(side + 'Cur').setAttribute('aria-expanded','false');
  }
}
function toggleMenu(side){
  const field = $(side + 'Field'), willOpen = !field.classList.contains('open');
  closeMenus();
  if (willOpen){
    field.classList.add('open');
    $(side + 'Cur').setAttribute('aria-expanded','true');
  }
}
function pickCurrency(side, code){
  const other = side === 'from' ? 'to' : 'from';
  if (code === state[other]) state[other] = state[side];   // picking the other currency swaps them
  state[side] = code;
  closeMenus();
  lastRes = 0;
  const d = driverInput();
  d.value = sanitize(d.value, state[state.mode === 'send' ? 'from' : 'to']);
  render();
}
for (const side of ['from','to']){
  $(side + 'Cur').addEventListener('click', e => { e.stopPropagation(); toggleMenu(side); });
  $(side + 'Menu').addEventListener('click', e => { const li = e.target.closest('li'); if (li) pickCurrency(side, li.dataset.code); });
  $(side + 'Menu').addEventListener('keydown', e => {
    const li = e.target.closest('li'); if (!li) return;
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); pickCurrency(side, li.dataset.code); $(side + 'Cur').focus(); }
    if (e.key === 'ArrowDown'){ e.preventDefault(); (li.nextElementSibling || li).focus(); }
    if (e.key === 'ArrowUp'){ e.preventDefault(); (li.previousElementSibling || li).focus(); }
  });
}
document.addEventListener('click', e => { if (!e.target.closest('.cur-wrap')) closeMenus(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });

/* ---------- result tween ---------- */
let tweenFrame, lastRes = 0;
function tweenTo(el, to, code){
  cancelAnimationFrame(tweenFrame);
  const from = lastRes, t0 = performance.now(), dur = 380;
  const step = now => {
    const p = Math.min(1,(now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.innerHTML = fmt(from + (to - from) * e, code) + `<em>${code}</em>`;
    if (p < 1) tweenFrame = requestAnimationFrame(step); else lastRes = to;
  };
  tweenFrame = requestAnimationFrame(step);
}

/* ---------- quick chips ---------- */
function renderQuick(){
  const side = state.mode === 'send' ? 'from' : 'to';
  const cur = state[side], d = CURRENCIES[cur];
  const { rate } = pairInfo(cur, cur === CONFIG.base ? codes().find(c => c !== CONFIG.base) : CONFIG.base);
  // Default quick amounts in base currency, converted to current currency
  const defaults = [1000, 5000, 10000, 50000];
  const amounts = (d.quick || defaults).map(n => {
    // If this is the base currency, use as-is; otherwise convert
    return cur === CONFIG.base ? n : Math.round(n * rate);
  });
  $('quick').innerHTML = amounts.map(n => `<button type="button" data-v="${n}">${d.symbol} ${n.toLocaleString('en-US')}</button>`).join('');
}

/* ---------- main render ---------- */
let current = null;
function render(source){
  const { from, to, mode } = state;
  const { rate, commission: c } = pairInfo(from, to);
  const fi = $('fromInput'), ti = $('toInput');

  // mode UI
  $('seg').dataset.mode = mode;
  $('tabSend').setAttribute('aria-selected', mode === 'send');
  $('tabReceive').setAttribute('aria-selected', mode === 'receive');
  const sendDrives = mode === 'send';
  $('fromField').classList.toggle('computed', !sendDrives);
  $('toField').classList.toggle('computed', sendDrives);
  fi.readOnly = !sendDrives; ti.readOnly = sendDrives;
  $('fromTag').hidden = sendDrives; $('toTag').hidden = !sendDrives;
  $('fromLabel').textContent = sendDrives ? 'You send' : 'You need to send';
  $('toLabel').textContent = sendDrives ? 'Recipient gets' : 'Recipient must get';
  fi.setAttribute('aria-label', sendDrives ? 'Amount you send' : 'Amount you need to send (calculated)');
  ti.setAttribute('aria-label', sendDrives ? 'Amount recipient gets (calculated)' : 'Amount recipient must get');

  renderPickers();

  $('rateMain').textContent = `1 ${from} = ${rateStr(rate)} ${to}`;
  $('commMain').textContent = `${pctOf(c)} of amount sent`;
  $('pillRate').textContent = `1 ${from} = ${rateStr(rate)} ${to}`;
  $('feeTile').textContent = `A single flat ${pctOf(c)} commission on every transaction, shown up front.`;

  // calculate
  const val = parseFloat(driverInput().value);
  let calc = null;
  if (val > 0){
    calc = sendDrives ? forward(val, from, to) : reverse(val, from, to);
    if (sendDrives) ti.value = calc.received.toFixed(dp(to));
    else fi.value = calc.send.toFixed(dp(from));
  } else {
    computedInput().value = '';
  }
  current = calc;

  // hero result
  if (sendDrives){
    $('resLabel').textContent = 'Your recipient receives';
    $('resSub').textContent = calc ? `after ${fmt(calc.commission, from)} ${from} commission` : '';
    tweenTo($('resBig'), calc ? calc.received : 0, to);
  } else {
    $('resLabel').textContent = 'You need to send';
    $('resSub').textContent = calc ? `so your recipient gets ${fmt(calc.received, to)} ${to} (commission ${fmt(calc.commission, from)} ${from} included)` : '';
    tweenTo($('resBig'), calc ? calc.send : 0, from);
  }
  $('resCode').textContent = sendDrives ? to : from;

  renderBreakdown(calc);
  if (source !== 'quick') renderQuick();

  const rates = codes().filter(x => x !== CONFIG.base).map(x => `1 ${CONFIG.base} = ${rateStr(CURRENCIES[x].perBase)} ${x}`).join(' · ');
  $('foot').textContent = `${rates} · Commission ${pctOf(CONFIG.commission)}`;
}

function renderBreakdown(calc){
  const { from, to, mode } = state;
  const bd = $('breakdown'), fm = $('formula');
  const { rate, commission: c } = pairInfo(from, to);
  const cp = pctOf(c);

  if (!calc){
    bd.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 7.5h7M8.5 12h2M13.5 12h2M8.5 16h2M13.5 16h2"/></svg>
      <p>Enter an amount to see the full calculation, step by step.</p></div>`;
    fm.innerHTML = mode === 'send'
      ? `<b>Formula</b><code>received = (amount sent − ${cp} commission) × rate</code>`
      : `<b>Formula</b><code>amount to send = (amount recipient gets ÷ rate) ÷ (1 − ${cp})</code>`;
    return;
  }

  const F = (n, cur) => fmt(n, cur);
  if (mode === 'send'){
    bd.innerHTML = `<ol class="steps">
      <li class="step"><div class="n">1</div>
        <div class="t"><b>Amount you send</b><span>The total you hand over</span></div>
        <div class="v">${F(calc.send, from)} ${from}</div></li>
      <li class="step"><div class="n">2</div>
        <div class="t"><b>Commission (${cp})</b><span>${F(calc.send, from)} × ${cp} = ${F(calc.commission, from)} ${from}</span></div>
        <div class="v minus">− ${F(calc.commission, from)} ${from}</div></li>
      <li class="step"><div class="n">3</div>
        <div class="t"><b>Amount converted</b><span>${F(calc.send, from)} − ${F(calc.commission, from)} = ${F(calc.net, from)} ${from}</span></div>
        <div class="v">${F(calc.net, from)} ${from}</div></li>
      <li class="step"><div class="n">4</div>
        <div class="t"><b>Exchange rate applied</b><span>Fixed rate</span></div>
        <div class="v">1 ${from} = ${rateStr(rate)} ${to}</div></li>
      <li class="step final"><div class="n">5</div>
        <div class="t"><b>Recipient receives</b><span>${F(calc.net, from)} × ${rateStr(rate)} = ${F(calc.received, to)} ${to}</span></div>
        <div class="v">${F(calc.received, to)} ${to}</div></li>
    </ol>`;
    fm.innerHTML = `<b>Formula</b><code>commission = ${F(calc.send, from)} × ${c}</code><br>` +
      `<code>received = (${F(calc.send, from)} − ${F(calc.commission, from)}) × ${rateStr(rate)} = ${F(calc.received, to)} ${to}</code>`;
  } else {
    bd.innerHTML = `<ol class="steps">
      <li class="step"><div class="n">1</div>
        <div class="t"><b>Recipient must get</b><span>The amount you want them to receive</span></div>
        <div class="v">${F(calc.target, to)} ${to}</div></li>
      <li class="step"><div class="n">2</div>
        <div class="t"><b>Exchange rate</b><span>Fixed rate, so we divide by it to go back to ${from}</span></div>
        <div class="v">1 ${from} = ${rateStr(rate)} ${to}</div></li>
      <li class="step"><div class="n">3</div>
        <div class="t"><b>Needed after commission</b><span>${F(calc.target, to)} ÷ ${rateStr(rate)} = ${F(calc.netNeeded, from)} ${from}</span></div>
        <div class="v">${F(calc.netNeeded, from)} ${from}</div></li>
      <li class="step"><div class="n">4</div>
        <div class="t"><b>Add the ${cp} commission</b><span>${F(calc.netNeeded, from)} ÷ (1 − ${c}) = ${F(calc.gross, from)} ${from}, rounded up to the next ${dp(from) ? 'cent' : 'unit'}</span></div>
        <div class="v">${F(calc.send, from)} ${from}</div></li>
      <li class="step final"><div class="n">5</div>
        <div class="t"><b>You need to send</b><span>Of which ${F(calc.commission, from)} ${from} is commission</span></div>
        <div class="v">${F(calc.send, from)} ${from}</div></li>
    </ol>`;
    fm.innerHTML = `<b>Check</b>` +
      `<code>commission = ${F(calc.send, from)} × ${c} = ${F(calc.commission, from)} ${from}</code><br>` +
      `<code>received = (${F(calc.send, from)} − ${F(calc.commission, from)}) × ${rateStr(rate)} = ${F(calc.received, to)} ${to}</code>` +
      (calc.received > calc.target ? `<br>Rounded up so the recipient gets at least ${F(calc.target, to)} ${to}.` : '');
  }
}

/* ---------- events ---------- */
function setMode(mode){
  if (mode === state.mode) return;
  // the figure that was calculated becomes the figure the client types
  state.mode = mode;
  lastRes = 0;
  render();
  driverInput().focus();
}
$('seg').addEventListener('click', e => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode); });
$('seg').addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ setMode(state.mode === 'send' ? 'receive' : 'send'); (state.mode === 'send' ? $('tabSend') : $('tabReceive')).focus(); }
});
// clicking the calculated field flips the mode so the client can type there directly
for (const [fieldId, mode] of [['fromField','receive'],['toField','send']]){
  $(fieldId).addEventListener('pointerdown', e => {
    if (e.target.closest('.cur-wrap')) return;
    const isComputed = $(fieldId).classList.contains('computed');
    if (isComputed){ e.preventDefault(); setMode(mode); }
  });
}

$('fromInput').addEventListener('input', e => { if (state.mode !== 'send') return; e.target.value = sanitize(e.target.value, state.from); render(); });
$('toInput').addEventListener('input',   e => { if (state.mode !== 'receive') return; e.target.value = sanitize(e.target.value, state.to); render(); });

$('swapBtn').addEventListener('click', () => {
  $('swapBtn').classList.toggle('spin');
  [state.from, state.to] = [state.to, state.from];
  lastRes = 0;
  const d = driverInput();
  d.value = sanitize(d.value, state[state.mode === 'send' ? 'from' : 'to']);
  render();
});

$('quick').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  driverInput().value = b.dataset.v;
  render('quick');
});

$('clearBtn').addEventListener('click', () => {
  $('fromInput').value = ''; $('toInput').value = ''; lastRes = 0; render();
  driverInput().focus();
});

function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2000);
}
$('copyBtn').addEventListener('click', async () => {
  if (!current){ toast('Enter an amount first'); return; }
  const c = current, f = state.from, t = state.to, cp = pctOf(c.c);
  const lines = [
    'A Tayant Pay — transfer summary',
    state.mode === 'receive' ? `Recipient must get: ${fmt(c.target, t)} ${t}` : null,
    `Amount sent:        ${fmt(c.send, f)} ${f}`,
    `Commission (${cp}):  ${fmt(c.commission, f)} ${f}`,
    `Amount converted:   ${fmt(c.net, f)} ${f}`,
    `Rate:               1 ${f} = ${rateStr(c.rate)} ${t}`,
    `Recipient receives: ${fmt(c.received, t)} ${t}`,
  ].filter(Boolean).join('\n');
  try { await navigator.clipboard.writeText(lines); toast('Summary copied'); }
  catch {
    const ta = document.createElement('textarea'); ta.value = lines; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Summary copied'); } catch { toast('Copy not supported'); }
    ta.remove();
  }
});

/* ---------- theme ---------- */
function setTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]').content = t === 'dark' ? '#050d1f' : '#0b3d91';
  try { localStorage.setItem('tayantpay-theme', t); } catch {}
}
(function(){
  let t = null;
  try { t = localStorage.getItem('tayantpay-theme'); } catch {}
  if (!t) t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(t);
})();
$('themeBtn').addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

render();
