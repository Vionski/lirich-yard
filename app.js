// Lirich Yard — worker app. No data is stored on the phone except the short-lived session in memory.
const API = window.YARD_API;
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtT = iso => iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '—';
const fmtD = d => new Date(d + 'T12:00:00+08:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });
const sgToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());
// Match the Driver App's personal-link pattern: ?u=<worker>. The link only
// selects one worker; it never replaces the PIN or creates a session.
const PERSONAL_WORKERS = Object.freeze({ rasu: 'Rasu', teh: 'Teh', yue: 'Yue', prabu: 'Prabu' });
const personalKey = (() => {
  try { return new URLSearchParams(location.search).get('u')?.trim().toLowerCase() || null; }
  catch { return null; }
})();
const personalWorker = personalKey ? PERSONAL_WORKERS[personalKey] || null : null;
let S = { token: null, name: null, me: null, tab: 'today', busy: false, offset: 0 };
let idleTimer = null;
const IDLE_MS = 120000;

function toast(msg, bad = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 4000); }
function idle() { clearTimeout(idleTimer); if (S.token) idleTimer = setTimeout(() => { if (!S.busy) signOut('Signed out after 2 minutes without activity.'); else idle(); }, IDLE_MS); }
['pointerdown', 'keydown', 'input'].forEach(ev => addEventListener(ev, idle, { passive: true }));
function netBanner() { $('#net').hidden = navigator.onLine; }
addEventListener('online', netBanner); addEventListener('offline', netBanner); netBanner();
setInterval(() => { const n = new Date(Date.now() + S.offset); $('#clock').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(n); }, 1000);

async function api(action, body = {}) {
  if (!navigator.onLine) throw new Error('No internet connection. Nothing was saved. Try again when online.');
  let r;
  try {
    r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', ...(S.token ? { 'x-yard-session': S.token } : {}) }, body: JSON.stringify({ ...body, action }) });
  } catch { throw new Error('Could not reach the server. Nothing was saved. Try again.'); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && action !== 'pin.change') { signOut('Please sign in again.'); throw new Error('Please sign in again.'); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}
function signOut(msg) { if (S.token) api('logout').catch(() => {}); S = { ...S, token: null, name: null, me: null, tab: 'today' }; clearTimeout(idleTimer); home(); if (msg) toast(msg); }

// ---------- screens ----------
async function home() {
  app.innerHTML = `<h1>${personalWorker ? `Hi ${esc(personalWorker)}` : 'Who are you?'}</h1><div class="names" id="names"><p class="muted">Loading…</p></div><p class="muted small center" style="margin-top:18px">${personalWorker ? 'This is your personal Yard link. Your PIN is still required.' : 'Tap your name, then enter onboarding PIN 1111 or your private 6-digit PIN.'}</p>`;
  try {
    const { workers } = await api('public');
    const visible = personalWorker ? workers.filter(n => n === personalWorker) : workers;
    if (personalWorker && !visible.length) throw new Error('This worker link is not active. Ask the office for help.');
    $('#names').innerHTML = visible.map(n => `<button class="name" data-n="${esc(n)}">${esc(n)}</button>`).join('');
    $('#names').onclick = e => { const b = e.target.closest('[data-n]'); if (b) pinScreen(b.dataset.n); };
  } catch (e) { $('#names').innerHTML = `<p class="muted">${esc(e.message)}</p><button class="btn" id="retry">Try again</button>`; $('#retry').onclick = home; }
}
function keypad(title, sub, onDone, back = home, allowFour = false) {
  let v = '';
  app.innerHTML = `<button class="btn ghost" id="back" style="width:auto;padding:8px 14px;margin:0 0 6px">‹ Back</button><h1>${esc(title)}</h1><p class="muted">${esc(sub)}</p>
    <div class="dots">${'<span class="dot"></span>'.repeat(6)}</div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button class="alt" data-k="c">Clear</button><button data-k="0">0</button><button class="alt" data-k="b">⌫</button></div>
    ${allowFour ? '<button class="btn ghost" id="submit4" hidden>Continue with onboarding PIN</button>' : ''}`;
  $('#back').onclick = back;
  const dots = [...app.querySelectorAll('.dot')];
  const submitFour = allowFour ? app.querySelector('#submit4') : null;
  const draw = () => { dots.forEach((d, i) => d.classList.toggle('on', i < v.length)); if (submitFour) submitFour.hidden = v.length !== 4; };
  const submit = async () => { const p = v; v = ''; setTimeout(draw, 150); await onDone(p); };
  if (submitFour) submitFour.onclick = () => v.length === 4 && submit();
  app.querySelector('.pad').onclick = async e => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    if (k === 'c') v = ''; else if (k === 'b') v = v.slice(0, -1); else if (v.length < 6) v += k;
    draw();
    if (v.length === 6) await submit();
  };
}
function pinScreen(name) {
  keypad(`Hi ${name}`, 'Enter your PIN', async pin => {
    try {
      const r = await api('login', { name, pin });
      S.token = r.token; S.name = r.name; idle();
      if (r.mustChange) return changePin(pin, true);
      await load(); main();
    } catch (e) { toast(e.message, true); }
  }, home, true);
}
function changePin(oldPin, first) {
  keypad(first ? 'Make your own PIN' : 'New PIN', 'Choose 6 digits only you know. Not 111111 or 123456.', p1 => {
    keypad('Enter it again', 'Type the same 6 digits again.', async p2 => {
      if (p1 !== p2) { toast('The two PINs did not match. Try again.', true); return changePin(oldPin, first); }
      try { await api('pin.change', { oldPin, pin: p1 }); toast('PIN saved. Use it next time.'); await load(); main(); }
      catch (e) { toast(e.message, true); changePin(oldPin, first); }
    }, () => signOut());
  }, () => signOut());
}
async function load() { S.me = await api('me'); S.offset = Date.parse(S.me.now) - Date.now(); }

function main() {
  const m = S.me;
  app.innerHTML = `<div class="status"><h1 style="margin:0">${esc(m.name)}</h1><button class="btn ghost" id="out" style="width:auto;margin:0;padding:8px 14px">Done</button></div>
    <div class="tabs" style="margin-top:12px"><button data-t="today">Today</button><button data-t="history">My attendance</button><button data-t="leave">Leave</button></div><div id="tab"></div>`;
  $('#out').onclick = () => signOut('Signed out.');
  app.querySelector('.tabs').onclick = e => { const t = e.target.closest('[data-t]')?.dataset.t; if (t) { S.tab = t; main(); } };
  app.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === S.tab));
  ({ today, history, leave })[S.tab]();
}
const schedText = s => s.off ? 'Off day' : `${s.start} – ${s.end}${s.source === 'override' ? ' (changed)' : ''}`;
function today() {
  const m = S.me, rec = m.todayRecord, open = m.open;
  const onShift = !!open, finished = rec && (rec.clock_out || rec.out_missing);
  const openOld = open && open.work_date !== m.today;
  $('#tab').innerHTML = `<div class="card"><div class="status"><div><div class="muted small">Today's timing</div><div style="font-weight:700">${esc(schedText(m.schedule))}</div></div>
      <span class="chip ${onShift ? 'ok' : finished ? '' : 'warn'}">${onShift ? 'At work' : finished ? 'Done for today' : 'Not clocked in'}</span></div>
      ${m.schedule.note ? `<p class="small muted" style="margin-top:6px">${esc(m.schedule.note)}</p>` : ''}</div>
    ${openOld ? `<div class="card" style="border-color:var(--warn)"><b>You did not clock out on ${esc(fmtD(open.work_date))}.</b><p class="small">Clock out now only if you are still working that shift. To start today, press Clock in — your supervisor will fix the missed clock-out.</p></div>` : ''}
    <div class="card center"><div class="muted small">In</div><div class="time">${fmtT(rec?.clock_in)}</div><div class="muted small" style="margin-top:6px">Out</div><div class="time">${rec?.out_missing ? '—' : fmtT(rec?.clock_out)}</div></div>
    ${onShift ? '<button class="btn big red" id="punch-out">Clock out</button>' : ''}
    ${(!rec?.clock_in) ? '<button class="btn big gold" id="punch-in">Clock in</button>' : ''}
    <h2>Next days</h2><div class="card">${m.upcoming.map(u => `<div class="row"><span>${esc(fmtD(u.date))}</span><b>${esc(schedText(u))}</b></div>`).join('')}</div>`;
  $('#punch-in')?.addEventListener('click', () => confirmPunch('in'));
  $('#punch-out')?.addEventListener('click', () => confirmPunch('out'));
}
function confirmPunch(type) {
  const el = document.createElement('div'); el.className = 'sheet';
  const now = fmtT(new Date(Date.now() + S.offset).toISOString());
  el.innerHTML = `<div class="card"><h1>${type === 'in' ? 'Clock in' : 'Clock out'} now?</h1><p class="muted">Time will be recorded by the server, about <b>${now}</b>.</p>
    <button class="btn big ${type === 'in' ? 'gold' : 'red'}" id="yes">Yes, ${type === 'in' ? 'clock in' : 'clock out'}</button><button class="btn ghost" id="no">Cancel</button></div>`;
  document.body.append(el);
  el.querySelector('#no').onclick = () => el.remove();
  el.querySelector('#yes').onclick = async e => {
    e.target.disabled = true;
    try {
      const r = await api('punch', { type });
      el.querySelector('.card').innerHTML = `<div class="done">✓</div><h1 class="center">${type === 'in' ? 'Clocked in' : 'Clocked out'} at ${fmtT(type === 'in' ? r.clock_in : r.clock_out)}</h1><p class="center muted">Saved. You will be signed out in a few seconds.</p><button class="btn" id="ok">Done</button>`;
      const fin = () => { el.remove(); signOut(); };
      el.querySelector('#ok').onclick = fin; setTimeout(() => el.isConnected && fin(), 6000);
    } catch (err) { el.remove(); toast(err.message, true); try { await load(); main(); } catch {} }
  };
}
function history() {
  const rows = S.me.attendance;
  $('#tab').innerHTML = `<div class="card">${rows.length ? rows.map(r => `<div class="row"><div><b>${esc(fmtD(r.work_date))}</b><div class="small muted">Your times: ${fmtT(r.clock_in)} – ${r.out_missing ? 'no clock-out' : fmtT(r.clock_out)}</div></div>
      <div class="small" style="text-align:right">${r.approved_in ? `<span class="chip ok">Approved</span><div>${esc(r.approved_in)} – ${esc(r.approved_out)}${r.approved_out_next_day ? ' (+1)' : ''}</div>` : '<span class="chip">Not yet approved</span>'}</div></div>`).join('') : '<p class="muted">No records yet.</p>'}</div>
    <p class="small muted">Showing the last 2 months. Approved times are what your supervisor confirmed for pay.</p>`;
}
const statusChip = s => `<span class="chip ${s === 'Approved' ? 'ok' : s === 'Rejected' ? 'bad' : s === 'Cancelled' ? '' : 'warn'}">${esc(s)}</span>`;
function leave() {
  const ls = S.me.leaves;
  $('#tab').innerHTML = `<button class="btn gold" id="new">Apply for leave</button><h2>My requests</h2>
    ${ls.length ? ls.map(l => `<div class="card"><div class="status"><b>${esc(l.leave_type)}</b>${statusChip(l.status)}</div>
      <div class="small">${esc(fmtD(l.date_from))}${l.date_to !== l.date_from ? ' – ' + esc(fmtD(l.date_to)) : ''} · ${esc(l.reference)}</div>
      ${l.decision_note ? `<p class="small" style="margin-top:6px"><b>${esc(l.decided_by || 'HR')}:</b> ${esc(l.decision_note)}</p>` : ''}
      ${l.documents.length ? `<div class="files">${l.documents.map(d => `<span>${d.purged ? '(removed) ' : ''}${esc(d.file_name)}</span>`).join('')}</div>` : ''}
      ${['Pending', 'Awaiting information'].includes(l.status) ? `<div class="two" style="margin-top:6px"><button class="btn ghost" data-reply="${esc(l.id)}">Add photo / reply</button><button class="btn ghost" data-cancel="${esc(l.id)}">Cancel request</button></div>` : ''}</div>`).join('') : '<p class="muted">No leave requests.</p>'}`;
  $('#new').onclick = () => leaveForm();
  $('#tab').onclick = async e => {
    const r = e.target.closest('[data-reply]')?.dataset.reply, c = e.target.closest('[data-cancel]')?.dataset.cancel;
    if (r) leaveForm(ls.find(x => x.id === r));
    if (c) { const l = ls.find(x => x.id === c); if (!confirmBox('Cancel this leave request?')) return; try { await api('leave.cancel', { id: l.id, version: l.version }); toast('Request cancelled.'); await load(); main(); } catch (err) { toast(err.message, true); } }
  };
}
function confirmBox(msg) { return window.confirm(msg); }

async function shrink(file) { // phone photos are large; resize to keep uploads under 5 MB
  if (file.type === 'application/pdf') { if (file.size > 5 * 1024 * 1024) throw new Error('PDF is larger than 5 MB.'); return { name: file.name, base64: await b64(file) }; }
  if (!/^image\//.test(file.type)) throw new Error('Use a photo or PDF.');
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) { if (file.size > 5 * 1024 * 1024) throw new Error('Photo is too large.'); return { name: file.name, base64: await b64(file) }; }
  const k = Math.min(1, 1800 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
  return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', base64: await b64(blob) };
}
const b64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });

function leaveForm(existing) {
  const t = sgToday(); let picked = [];
  const sub = crypto.randomUUID();
  $('#tab').innerHTML = `<div class="card"><h1>${existing ? 'Add photo or reply' : 'Apply for leave'}</h1>
    ${existing ? `<p class="small muted">${esc(existing.leave_type)} · ${esc(existing.reference)}</p>` : `
    <label for="type">Type</label><select id="type">${S.me.leaveTypes.map(x => `<option>${esc(x)}</option>`).join('')}</select>
    <div class="two"><div><label for="from">From</label><input id="from" type="date" value="${t}"></div><div><label for="to">To</label><input id="to" type="date" value="${t}"></div></div>
    <p class="small muted" id="hint" style="margin-top:6px"></p>`}
    <label for="note">${existing ? 'Reply' : 'Note (optional)'}</label><textarea id="note" maxlength="1000"></textarea>
    <label>Photo of MC or document (optional)</label>
    <div class="two"><button class="btn ghost" id="cam" type="button">Take photo</button><button class="btn ghost" id="gal" type="button">Choose file</button></div>
    <input id="camIn" type="file" accept="image/*" capture="environment" hidden><input id="galIn" type="file" accept="image/*,application/pdf" multiple hidden>
    <div class="files" id="list"></div>
    <button class="btn gold" id="send">${existing ? 'Send' : 'Submit request'}</button><button class="btn ghost" id="cancel">Back</button></div>`;
  const hint = () => { const h = $('#hint'); if (h) h.textContent = /Medical|Hospital/.test($('#type').value) ? 'Medical leave can be up to 14 days back.' : 'Leave starts today or later.'; };
  $('#type')?.addEventListener('change', hint); hint();
  const add = async files => { S.busy = true; try { for (const f of files) { if (picked.length >= 3) { toast('Up to 3 files at a time.', true); break; } picked.push(await shrink(f)); } } catch (e) { toast(e.message, true); } S.busy = false; $('#list').innerHTML = picked.map(p => `<span>${esc(p.name)}</span>`).join(''); };
  $('#cam').onclick = () => $('#camIn').click(); $('#gal').onclick = () => $('#galIn').click();
  $('#camIn').onchange = e => add([...e.target.files]); $('#galIn').onchange = e => add([...e.target.files]);
  $('#cancel').onclick = () => main();
  $('#send').onclick = async e => {
    e.target.disabled = true; S.busy = true;
    try {
      if (existing) await api('leave.reply', { id: existing.id, version: existing.version, note: $('#note').value, files: picked });
      else await api('leave.create', { type: $('#type').value, from: $('#from').value, to: $('#to').value, note: $('#note').value, files: picked, submissionId: sub });
      toast(existing ? 'Sent.' : 'Leave request sent. Your supervisor has been told.'); await load(); S.tab = 'leave'; main();
    } catch (err) { toast(err.message, true); e.target.disabled = false; }
    S.busy = false;
  };
}

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
home();
