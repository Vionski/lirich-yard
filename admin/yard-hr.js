/* Lirich Yard — HR tab for the operator console.
   Usage: LirichYardHR.mount(containerEl, { api: YARD_FUNCTION_URL, token: () => LR_TOKEN })
   Standalone dashboard: pass accessToken instead; it is sent as an OAuth bearer token.
   Visible to Michelle, Qris, Sheryl. The server re-checks identity on every call. */
(function () {
  'use strict';
  var CSS = '.yhr{font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14213d}.yhr *{box-sizing:border-box}' +
    '.yhr h2{font-size:18px;margin:4px 0 10px;color:#0a1b4d}.yhr h3{font-size:15px;margin:16px 0 8px;color:#0a1b4d}' +
    '.yhr .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.yhr .sp{flex:1}' +
    '.yhr .sub{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;border-bottom:2px solid #e9edf8}.yhr .sub button{border:0;background:transparent;padding:8px 12px;font-weight:700;color:#6e7691;cursor:pointer;border-radius:8px 8px 0 0}' +
    '.yhr .sub button.on{background:#e9edf8;color:#0a1b4d}.yhr .n{display:inline-block;min-width:18px;padding:0 5px;margin-left:4px;border-radius:9px;background:#b3261e;color:#fff;font-size:11px;text-align:center}' +
    '.yhr table{border-collapse:collapse;width:100%;background:#fff}.yhr th,.yhr td{border-bottom:1px solid #e6e8ef;padding:7px 8px;text-align:left;vertical-align:top}.yhr th{background:#f4f6fb;font-size:12px;color:#5b6478;font-weight:700}' +
    '.yhr .b{border:1px solid #c9cfdf;background:#fff;color:#0a1b4d;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer}.yhr .b.p{background:#0a1b4d;color:#fff;border-color:#0a1b4d}.yhr .b.g{background:#1e7a46;color:#fff;border-color:#1e7a46}.yhr .b.r{background:#b3261e;color:#fff;border-color:#b3261e}.yhr .b:disabled{opacity:.5}' +
    '.yhr .chip{display:inline-block;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:700;background:#eceff6;color:#13265a;margin:1px 2px 1px 0}.yhr .chip.ok{background:#e3f3e9;color:#1e7a46}.yhr .chip.w{background:#fff1db;color:#a86400}.yhr .chip.x{background:#fbe5e3;color:#b3261e}' +
    '.yhr .card{background:#fff;border:1px solid #e6e8ef;border-radius:10px;padding:12px;margin-bottom:10px}.yhr .muted{color:#5b6478}.yhr .small{font-size:12px}' +
    '.yhr input,.yhr select,.yhr textarea{font:inherit;padding:6px 8px;border:1px solid #c9cfdf;border-radius:8px;background:#fff}.yhr textarea{width:100%;min-height:60px}.yhr label{font-weight:600;display:inline-block;margin:6px 10px 4px 0}' +
    '.yhr .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.yhr .ov{position:fixed;inset:0;background:rgba(10,27,77,.45);display:flex;align-items:flex-start;justify-content:center;z-index:99999;overflow:auto;padding:40px 12px}' +
    '.yhr .dlg{background:#fff;border-radius:12px;max-width:620px;width:100%;padding:18px}.yhr .msg{padding:8px 12px;border-radius:8px;margin-bottom:10px;font-weight:600}.yhr .msg.e{background:#fbe5e3;color:#b3261e}.yhr .msg.o{background:#e3f3e9;color:#1e7a46}' +
    '.yhr .pin{font-size:40px;font-weight:800;letter-spacing:.2em;text-align:center;color:#0a1b4d;margin:14px 0}.yhr .off{color:#a86400;font-weight:700}.yhr .ovr{color:#13265a;font-weight:700}';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tSG(iso) { return iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '—'; }
  function dSG(iso) { return iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date(iso)) : ''; }
  function fD(d) { return new Date(d + 'T12:00:00+08:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' }); }
  function sched(s) { return s.off ? '<span class="off">Off</span>' : (s.source === 'override' ? '<span class="ovr" title="Changed timing">' : '<span>') + esc(s.start) + '–' + esc(s.end) + '</span>'; }
  function hrs(m) { return m == null ? '' : (m / 60).toFixed(2) + ' h'; }
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function mount(root, opts) {
    if (!document.getElementById('yhr-css')) { var st = document.createElement('style'); st.id = 'yhr-css'; st.textContent = CSS; document.head.appendChild(st); }
    root.classList.add('yhr');
    var S = { tab: 'today', date: null, me: null, dash: null, timing: null };
    function call(action, body) {
      var headers = { 'content-type': 'application/json' };
      if (opts.token) headers['x-lr-token'] = opts.token();
      if (opts.accessToken) headers.authorization = 'Bearer ' + opts.accessToken();
      return fetch(opts.api, { method: 'POST', headers: headers, body: JSON.stringify(Object.assign({}, body || {}, { action: action })) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ('Error ' + r.status)); return j; }); });
    }
    function showMsg() { var m = root.querySelector('#yhr-msg'); if (!m) return; var on = S.msg && S.msg.until > Date.now(); m.hidden = !on; if (on) { m.className = 'msg ' + (S.msg.bad ? 'e' : 'o'); m.textContent = S.msg.text; } }
    function flash(msg, bad) { S.msg = { text: msg, bad: !!bad, until: Date.now() + 7000 }; showMsg(); clearTimeout(flash.t); flash.t = setTimeout(showMsg, 7100); }
    function dialog(html, wire) {
      var ov = document.createElement('div'); ov.className = 'yhr'; ov.innerHTML = '<div class="ov"><div class="dlg">' + html + '</div></div>';
      document.body.appendChild(ov); var close = function () { ov.remove(); };
      ov.querySelector('.ov').addEventListener('click', function (e) { if (e.target.classList.contains('ov')) close(); });
      wire(ov, close); return ov;
    }
    function frame() {
      var p = S.dash ? S.dash.pending.length : 0, x = S.dash ? S.dash.exceptions.length : 0;
      root.innerHTML = '<div class="bar"><h2 style="margin:0">Yard HR</h2><span class="sp"></span><span class="muted small">' + (S.me ? 'Signed in as <b>' + esc(S.me.user.name) + '</b>' : '') + '</span>' +
        '<label style="margin:0">Date <input type="date" id="yhr-date" value="' + esc(S.date || '') + '"></label><button class="b" id="yhr-ref">Refresh</button></div>' +
        '<div id="yhr-msg" class="msg" hidden></div>' +
        '<div class="sub">' + [['today', 'Attendance'], ['exc', 'Exceptions' + (x ? '<span class="n">' + x + '</span>' : '')], ['leave', 'Leave' + (p ? '<span class="n">' + p + '</span>' : '')], ['timing', 'Work timing'], ['pins', 'Workers & PINs'], ['export', 'Export & audit']]
          .map(function (t) { return '<button data-t="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div id="yhr-body"></div>';
      root.querySelector('.sub').onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { S.tab = b.dataset.t; render(); } };
      root.querySelector('#yhr-ref').onclick = function () { load().then(render); };
      showMsg();
      root.querySelector('#yhr-date').onchange = function (e) { S.date = e.target.value; load().then(render); };
    }
    function load() {
      var p = S.me ? Promise.resolve(S.me) : call('hr.me').then(function (m) { S.me = m; S.date = S.date || m.today; return m; });
      return p.then(function () { return call('hr.dashboard', { date: S.date }); }).then(function (d) { S.dash = d; })
        .catch(function (e) { root.innerHTML = '<div class="msg e">' + esc(e.message) + '</div><button class="b" id="yhr-retry">Try again</button>'; root.querySelector('#yhr-retry').onclick = start; throw e; });
    }
    function render() {
      frame(); var body = root.querySelector('#yhr-body');
      ({ today: today, exc: exc, leave: leave, timing: timing, pins: pins, export: exp })[S.tab](body);
    }
    function attRows(rows, withDate) {
      return '<table><tr>' + (withDate ? '<th>Date</th>' : '') + '<th>Worker</th><th>Timing</th><th>Clocked in</th><th>Clocked out</th><th>CCTV</th><th>Approved</th><th>Flags</th><th></th></tr>' +
        rows.map(function (r) {
          var out = r.out_missing ? '<span class="chip x">No clock-out</span>' : (r.clock_out ? tSG(r.clock_out) + (dSG(r.clock_out) !== r.work_date ? ' <span class="small">(+1)</span>' : '') : '—');
          var cctv = (r.cctv_earliest || r.cctv_latest) ? esc(r.cctv_earliest || '?') + '–' + esc(r.cctv_latest || '?') + (r.cctv_lights_out ? '<div class="small muted">lights ' + esc(r.cctv_lights_out) + '</div>' : '') : '<span class="muted">—</span>';
          var ap = r.approved_in ? '<span class="chip ok">' + esc(r.approved_in) + '–' + esc(r.approved_out) + (r.approved_out_next_day ? ' +1' : '') + '</span><div class="small muted">' + hrs(r.approvedPaidMinutes) + ' · ' + esc(r.approved_by) + '</div>' : '<span class="muted">—</span>';
          var lv = r.leave ? '<span class="chip ' + (r.leave.status === 'Approved' ? 'ok' : 'w') + '">' + esc(r.leave.leave_type) + (r.leave.status !== 'Approved' ? ' (' + esc(r.leave.status) + ')' : '') + '</span>' : '';
          var fl = r.flags.map(function (f) { return '<span class="chip ' + (r.resolved ? '' : 'w') + '">' + esc(f) + '</span>'; }).join('') + lv;
          return '<tr>' + (withDate ? '<td>' + esc(fD(r.work_date)) + '</td>' : '') + '<td><b>' + esc(r.name) + '</b></td><td>' + sched(r.schedule) + '</td><td>' + tSG(r.clock_in) + '</td><td>' + out + '</td><td>' + cctv + '</td><td>' + ap + '</td><td>' + (fl || '<span class="muted">—</span>') +
            '</td><td><button class="b" data-rv="' + esc(r.worker_id) + '|' + esc(r.work_date) + '">Review</button></td></tr>';
        }).join('') + '</table>';
    }
    function wireReview(el, rows) {
      el.onclick = function (e) { var b = e.target.closest('[data-rv]'); if (!b) return; var k = b.dataset.rv.split('|'); review(rows.find(function (r) { return r.worker_id === k[0] && r.work_date === k[1]; })); };
    }
    function today(body) {
      var d = S.dash; body.innerHTML = '<h3>' + esc(fD(d.date)) + (d.date === d.today ? ' (today)' : '') + '</h3>' + attRows(d.rows, false) +
        '<p class="small muted">Times shown in Singapore time. Clocked times are what the worker pressed and can never be edited. Approved times are used for pay. Paid hours subtract 1 hour break when the shift is 6 hours or longer.</p>';
      wireReview(body, d.rows);
    }
    function exc(body) {
      var x = S.dash.exceptions;
      body.innerHTML = x.length ? '<h3>Needs review (last 14 days)</h3>' + attRows(x, true) : '<div class="card">No open exceptions in the last 14 days.</div>';
      wireReview(body, x);
    }
    function review(r) {
      if (r.work_date > S.dash.today) { flash('Future dates cannot be reviewed.', true); return; }
      var nextDefault = r.clock_out && dSG(r.clock_out) !== r.work_date;
      dialog('<h2>' + esc(r.name) + ' · ' + esc(fD(r.work_date)) + '</h2>' +
        '<div class="card small">Timing: ' + sched(r.schedule) + ' · Clocked in <b>' + tSG(r.clock_in) + '</b> · Clocked out <b>' + (r.out_missing ? 'none' : tSG(r.clock_out)) + '</b>' + (r.flags.length ? '<div style="margin-top:4px">' + r.flags.map(function (f) { return '<span class="chip w">' + esc(f) + '</span>'; }).join('') + '</div>' : '') + '</div>' +
        '<h3>CCTV evidence (optional)</h3><div class="grid"><label>Earliest activity<br><input type="time" id="ce" value="' + esc(r.cctv_earliest || '') + '"></label><label>Latest activity<br><input type="time" id="cl" value="' + esc(r.cctv_latest || '') + '"></label><label>Lights out<br><input type="time" id="co" value="' + esc(r.cctv_lights_out || '') + '"></label>' +
        '<label>Shows<br><select id="cs"><option value="">—</option><option value="yard"' + (r.cctv_scope === 'yard' ? ' selected' : '') + '>Yard activity only</option><option value="worker"' + (r.cctv_scope === 'worker' ? ' selected' : '') + '>This worker identified</option></select></label></div>' +
        '<p class="small muted">CCTV is supporting evidence only. It never changes what the worker clocked.</p>' +
        '<h3>Approval</h3><label><input type="checkbox" id="ap"' + (r.approved_in || !r.flags.length ? ' checked' : '') + '> Approve times for pay</label>' +
        '<div class="grid"><label>Start<br><input type="time" id="ai" value="' + esc(r.approved_in || (r.clock_in ? tSG(r.clock_in) : (r.schedule.start || ''))) + '"></label><label>End<br><input type="time" id="ao" value="' + esc(r.approved_out || (r.clock_out ? tSG(r.clock_out) : (r.schedule.end || ''))) + '"></label>' +
        '<label style="align-self:end"><input type="checkbox" id="nd"' + (r.approved_out_next_day || nextDefault ? ' checked' : '') + '> Ends next day</label></div>' +
        '<label>Note (required)<br></label><textarea id="nt" placeholder="e.g. Confirmed with CCTV camera 2; worker forgot to clock out">' + esc(r.review_note || '') + '</textarea>' +
        '<div id="err" class="msg e" hidden></div><div class="bar" style="margin-top:10px"><span class="sp"></span><button class="b" id="cx">Cancel</button><button class="b p" id="sv">Save</button></div>',
        function (ov, close) {
          var q = function (s) { return ov.querySelector(s); };
          q('#cx').onclick = close;
          q('#sv').onclick = function () {
            q('#sv').disabled = true;
            call('hr.review', { workerId: r.worker_id, date: r.work_date, version: r.version, note: q('#nt').value,
              cctv: { earliest: q('#ce').value, latest: q('#cl').value, lightsOut: q('#co').value, scope: q('#cs').value },
              approve: q('#ap').checked, approvedIn: q('#ai').value, approvedOut: q('#ao').value, nextDay: q('#nd').checked })
              .then(function () { close(); flash('Saved.'); return load(); }).then(render)
              .catch(function (e) { q('#err').hidden = false; q('#err').textContent = e.message; q('#sv').disabled = false; });
          };
        });
    }
    function leaveCard(l, act) {
      var days = Math.round((Date.parse(l.date_to) - Date.parse(l.date_from)) / 864e5) + 1;
      return '<div class="card"><div class="bar" style="margin:0"><b>' + esc(l.name) + '</b><span class="chip">' + esc(l.leave_type) + '</span><span class="chip ' + (l.status === 'Approved' ? 'ok' : l.status === 'Rejected' ? 'x' : 'w') + '">' + esc(l.status) + '</span><span class="sp"></span><span class="small muted">' + esc(l.reference) + '</span></div>' +
        '<div style="margin-top:6px">' + esc(fD(l.date_from)) + (days > 1 ? ' – ' + esc(fD(l.date_to)) : '') + ' · <b>' + days + ' day' + (days > 1 ? 's' : '') + '</b></div>' +
        (l.note ? '<div class="small" style="margin-top:4px">Worker: ' + esc(l.note) + '</div>' : '') +
        (l.documents.length ? '<div style="margin-top:6px">' + l.documents.map(function (d) { return d.purged ? '<span class="chip">' + esc(d.file_name) + ' (removed)</span>' : '<button class="b" data-doc="' + esc(d.id) + '">Open ' + esc(d.file_name) + '</button> '; }).join('') + '</div>' : '') +
        '<details style="margin-top:6px"><summary class="small muted">History</summary>' + (l.history || []).map(function (h) { return '<div class="small">' + esc(new Date(h.at).toLocaleString('en-GB', { timeZone: 'Asia/Singapore' })) + ' · ' + esc(h.actor) + ' · ' + esc(h.status) + (h.note ? ' — ' + esc(h.note) : '') + '</div>'; }).join('') + '</details>' +
        (act ? '<div class="bar" style="margin:8px 0 0"><button class="b g" data-dec="Approved" data-id="' + esc(l.id) + '">Approve</button><button class="b" data-dec="Awaiting information" data-id="' + esc(l.id) + '">Ask for information</button><button class="b r" data-dec="Rejected" data-id="' + esc(l.id) + '">Reject</button></div>' : '') + '</div>';
    }
    function leave(body) {
      var d = S.dash;
      body.innerHTML = '<h3>Waiting for a decision</h3>' + (d.pending.length ? d.pending.map(function (l) { return leaveCard(l, !!S.me.user.canApprove); }).join('') : '<div class="card muted">Nothing waiting.</div>') +
        '<h3>Decided in the last 45 days</h3>' + (d.recent.length ? d.recent.map(function (l) { return leaveCard(l, false); }).join('') : '<div class="card muted">None.</div>') +
        '<p class="small muted">Michelle, Qris and Sheryl can view HR records. Qris is the leave approver. Each decision is recorded under the approver\'s name. New requests are emailed to Qris only.</p>';
      body.onclick = function (e) {
        var doc = e.target.closest('[data-doc]'), dec = e.target.closest('[data-dec]');
        if (doc) { var w = window.open('', '_blank'); call('hr.doc.url', { docId: doc.dataset.doc }).then(function (r) { if (w) w.location = r.url; else location.href = r.url; }).catch(function (er) { if (w) w.close(); flash(er.message, true); }); }
        if (dec) {
          var l = d.pending.find(function (x) { return x.id === dec.dataset.id; }), st = dec.dataset.dec;
          dialog('<h2>' + esc(st === 'Approved' ? 'Approve' : st === 'Rejected' ? 'Reject' : 'Ask for information') + ' · ' + esc(l.name) + '</h2><div class="small">' + esc(l.leave_type) + ' · ' + esc(l.date_from) + ' to ' + esc(l.date_to) + '</div>' +
            '<label>' + (st === 'Approved' ? 'Note (optional)' : st === 'Rejected' ? 'Reason (required, the worker will see it)' : 'Question for the worker (required)') + '</label><textarea id="nt"></textarea><div id="err" class="msg e" hidden></div>' +
            '<div class="bar" style="margin-top:10px"><span class="sp"></span><button class="b" id="cx">Cancel</button><button class="b ' + (st === 'Rejected' ? 'r' : st === 'Approved' ? 'g' : 'p') + '" id="sv">Confirm</button></div>',
            function (ov, close) {
              ov.querySelector('#cx').onclick = close;
              ov.querySelector('#sv').onclick = function () {
                ov.querySelector('#sv').disabled = true;
                call('hr.leave.decide', { id: l.id, version: l.version, status: st, note: ov.querySelector('#nt').value })
                  .then(function () { close(); flash('Decision saved.'); return load(); }).then(render)
                  .catch(function (er) { var m = ov.querySelector('#err'); m.hidden = false; m.textContent = er.message; ov.querySelector('#sv').disabled = false; });
              };
            });
        }
      };
    }
    function timing(body) {
      body.innerHTML = '<p class="muted">Loading…</p>';
      call('hr.schedule.get').then(function (t) {
        S.timing = t; var ws = S.me.workers;
        var active = t.overrides.filter(function (o) { return !o.cancelled_at && o.date_to >= t.today; });
        body.innerHTML = '<div class="card"><h3 style="margin-top:0">Change work timing</h3>' +
          '<div><b>For</b> <label><input type="radio" name="who" value="all" checked> Whole yard</label><label><input type="radio" name="who" value="some"> Chosen workers:</label>' +
          ws.map(function (w) { return '<label><input type="checkbox" class="wk" value="' + esc(w.id) + '" disabled> ' + esc(w.display_name) + '</label>'; }).join('') + '</div>' +
          '<div><b>When</b> <label><input type="radio" name="when" value="next" checked> Next work day</label><label><input type="radio" name="when" value="date"> One date</label><label><input type="radio" name="when" value="range"> From – to</label>' +
          '<span id="wd1" hidden><input type="date" id="d1" min="' + esc(t.today) + '"></span><span id="wd2" hidden> to <input type="date" id="d2" min="' + esc(t.today) + '"></span></div>' +
          '<div><b>Timing</b> <label>Start <input type="time" id="st" value="08:00"></label><label>End <input type="time" id="en" value="18:00"></label><label><input type="checkbox" id="off"> Day off (no work)</label></div>' +
          '<div><label>Note (shown to workers)</label><input id="nt" style="width:100%" maxlength="300" placeholder="e.g. Early start for vessel job"></div>' +
          '<p class="small muted">After the chosen dates, the normal timing comes back automatically. Changes can only start today or later.</p><button class="b p" id="sv">Save timing</button></div>' +
          '<h3>Changes in force or coming up</h3>' + (active.length ? '<table><tr><th>Dates</th><th>For</th><th>Timing</th><th>Note</th><th>Set by</th><th></th></tr>' + active.map(function (o) {
            return '<tr><td>' + esc(fD(o.date_from)) + (o.date_to !== o.date_from ? ' – ' + esc(fD(o.date_to)) : '') + '</td><td>' + (o.worker_ids ? esc(o.worker_ids.map(function (id) { var w = ws.find(function (x) { return x.id === id; }); return w ? w.display_name : id; }).join(', ')) : 'Whole yard') + '</td><td>' + (o.off ? '<span class="off">Day off</span>' : esc(o.start_time) + '–' + esc(o.end_time)) + '</td><td>' + esc(o.note) + '</td><td class="small">' + esc(o.created_by) + '</td><td><button class="b" data-cancel="' + esc(o.id) + '">Cancel</button></td></tr>';
          }).join('') + '</table>' : '<div class="card muted">None — normal timing applies.</div>') +
          '<h3>Next 14 days</h3><table><tr><th>Date</th>' + ws.map(function (w) { return '<th>' + esc(w.display_name) + '</th>'; }).join('') + '</tr>' + t.next14.map(function (d) { return '<tr><td>' + esc(fD(d.date)) + '</td>' + d.workers.map(function (w) { return '<td>' + sched(w) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>' +
          '<h3>Normal weekly timing</h3><table><tr><th>Day</th><th>Start</th><th>End</th><th>Off</th></tr>' + t.defaults.map(function (d) { return '<tr><td>' + DAYS[d.weekday] + '</td><td><input type="time" class="ds" data-w="' + d.weekday + '" value="' + esc(d.start_time || '') + '"></td><td><input type="time" class="de" data-w="' + d.weekday + '" value="' + esc(d.end_time || '') + '"></td><td><input type="checkbox" class="do" data-w="' + d.weekday + '"' + (d.off ? ' checked' : '') + '></td></tr>'; }).join('') + '</table>' +
          '<button class="b" id="svd" style="margin-top:8px">Save normal timing</button><p class="small muted">Changing the normal timing affects every future week. For one-off changes use “Change work timing” above.</p>';
        var q = function (s) { return body.querySelector(s); }, qa = function (s) { return [].slice.call(body.querySelectorAll(s)); };
        body.onchange = function () {
          var some = q('input[name=who]:checked').value === 'some'; qa('.wk').forEach(function (c) { c.disabled = !some; });
          var when = q('input[name=when]:checked').value; q('#wd1').hidden = when === 'next'; q('#wd2').hidden = when !== 'range';
          q('#st').disabled = q('#en').disabled = q('#off').checked;
        };
        q('#sv').onclick = function () {
          var when = q('input[name=when]:checked').value, some = q('input[name=who]:checked').value === 'some';
          var ids = some ? qa('.wk:checked').map(function (c) { return c.value; }) : null;
          if (some && !ids.length) { flash('Tick at least one worker.', true); return; }
          var b = { mode: when, date: q('#d1').value, from: q('#d1').value, to: q('#d2').value, start: q('#st').value, end: q('#en').value, off: q('#off').checked, workerIds: ids, note: q('#nt').value };
          q('#sv').disabled = true;
          call('hr.schedule.create', b).then(function (o) { flash('Timing saved for ' + o.date_from + (o.date_to !== o.date_from ? ' to ' + o.date_to : '') + '.'); return load(); }).then(function () { S.tab = 'timing'; render(); })
            .catch(function (e) { flash(e.message, true); q('#sv').disabled = false; });
        };
        body.onclick = function (e) {
          var c = e.target.closest('[data-cancel]'); if (!c) return;
          dialog('<h2>Cancel this timing change?</h2><p>Days already passed stay as they were. Normal timing applies from today.</p><div class="bar"><span class="sp"></span><button class="b" id="cx">Keep</button><button class="b r" id="ok">Cancel change</button></div>', function (ov, close) {
            ov.querySelector('#cx').onclick = close;
            ov.querySelector('#ok').onclick = function () { call('hr.schedule.cancel', { id: c.dataset.cancel }).then(function () { close(); flash('Timing change cancelled.'); return load(); }).then(render).catch(function (er) { close(); flash(er.message, true); }); };
          });
        };
        q('#svd').onclick = function () {
          var days = [0, 1, 2, 3, 4, 5, 6].map(function (w) { return { weekday: w, start: q('.ds[data-w="' + w + '"]').value, end: q('.de[data-w="' + w + '"]').value, off: q('.do[data-w="' + w + '"]').checked }; });
          call('hr.schedule.default.set', { days: days }).then(function () { flash('Normal timing saved.'); return load(); }).then(render).catch(function (e) { flash(e.message, true); });
        };
      }).catch(function (e) { body.innerHTML = '<div class="msg e">' + esc(e.message) + '</div>'; });
    }
    function pins(body) {
      body.innerHTML = '<div class="card"><p>For supervised first-time setup, unclaimed workers may all start with onboarding PIN <b>1111</b>. Each worker must immediately replace it with a private 6-digit PIN. This never overwrites an existing PIN.</p><button class="b p" id="onboard">Set 1111 for unclaimed workers</button></div>' +
        '<div class="card"><p>You can instead issue a random temporary PIN for one worker. Issuing a new individual PIN signs that worker out everywhere.</p></div>' +
        '<table><tr><th>Worker</th><th></th></tr>' + S.me.workers.map(function (w) { return '<tr><td><b>' + esc(w.display_name) + '</b></td><td><button class="b" data-pin="' + esc(w.id) + '">Issue temporary PIN</button></td></tr>'; }).join('') + '</table>';
      body.onclick = function (e) {
        if (e.target.closest('#onboard')) {
          dialog('<h2>Enable onboarding PIN 1111?</h2><p>Only worker accounts that have no PIN yet will be changed. Supervise setup and have each worker choose a private 6-digit PIN immediately.</p><div class="bar"><span class="sp"></span><button class="b" id="cx">Cancel</button><button class="b p" id="ok">Enable 1111</button></div>', function (ov, close) {
            ov.querySelector('#cx').onclick = close;
            ov.querySelector('#ok').onclick = function () { call('hr.pin.onboard').then(function (r) { close(); flash(r.workers.length ? 'Onboarding PIN enabled for ' + r.workers.join(', ') + '.' : 'No unclaimed accounts were changed.'); }).catch(function (er) { close(); flash(er.message, true); }); };
          }); return;
        }
        var b = e.target.closest('[data-pin]'); if (!b) return;
        var w = S.me.workers.find(function (x) { return x.id === b.dataset.pin; });
        dialog('<h2>Issue a new PIN for ' + esc(w.display_name) + '?</h2><p>Their current PIN stops working immediately.</p><div class="bar"><span class="sp"></span><button class="b" id="cx">Cancel</button><button class="b p" id="ok">Issue PIN</button></div>', function (ov, close) {
          ov.querySelector('#cx').onclick = close;
          ov.querySelector('#ok').onclick = function () {
            call('hr.pin.issue', { workerId: w.id }).then(function (r) {
              ov.querySelector('.dlg').innerHTML = '<h2>Temporary PIN for ' + esc(r.worker) + '</h2><div class="pin">' + esc(r.pin) + '</div><p>' + esc(r.note) + '</p><div class="bar"><span class="sp"></span><button class="b p" id="dn">Done — hide PIN</button></div>';
              ov.querySelector('#dn').onclick = close;
            }).catch(function (er) { close(); flash(er.message, true); });
          };
        });
      };
    }
    function exp(body) {
      var m = (S.dash.today || '').slice(0, 7);
      body.innerHTML = '<div class="card"><h3 style="margin-top:0">Monthly attendance for payroll (CSV)</h3><label>Month <input type="month" id="mo" value="' + esc(m) + '"></label> <button class="b p" id="dl">Download CSV</button>' +
        '<p class="small muted">Lists every work day with clocked, CCTV and approved times, paid hours (break deducted when 6 h or more), normal vs extra hours, off-day hours, leave and any open flags. Opens in Excel.</p></div>' +
        '<div class="card"><h3 style="margin-top:0">Audit trail</h3><button class="b" id="ver">Check audit trail is intact</button> <button class="b" id="aud">Show latest 200 entries</button><div id="av" style="margin-top:8px"></div></div>' +
        '<p class="small muted">Retention: attendance, leave and audit kept 2 years (MOM minimum for current employees); medical document files kept 1 year.</p>';
      body.querySelector('#dl').onclick = function () {
        call('hr.export', { month: body.querySelector('#mo').value }).then(function (r) {
          var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' })); a.download = r.filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        }).catch(function (e) { flash(e.message, true); });
      };
      body.querySelector('#ver').onclick = function () { call('hr.audit.verify').then(function (v) { flash(v.intact ? 'Audit trail intact (' + v.rows + ' entries).' : 'Audit trail BROKEN at entry ' + v.firstBrokenId + ' — tell Michelle.', !v.intact); }).catch(function (e) { flash(e.message, true); }); };
      body.querySelector('#aud').onclick = function () {
        call('hr.audit', { limit: 200 }).then(function (r) {
          body.querySelector('#av').innerHTML = '<table><tr><th>When</th><th>Who</th><th>What</th><th>Record</th></tr>' + r.rows.map(function (a) { return '<tr><td class="small">' + esc(new Date(a.at).toLocaleString('en-GB', { timeZone: 'Asia/Singapore' })) + '</td><td>' + esc(a.actor) + '</td><td>' + esc(a.action) + '</td><td class="small">' + esc(a.target) + '</td></tr>'; }).join('') + '</table>';
        }).catch(function (e) { flash(e.message, true); });
      };
    }
    function start() { root.innerHTML = '<p class="muted">Loading Yard HR…</p>'; load().then(render).catch(function () {}); }
    start();
    return { refresh: start };
  }
  window.LirichYardHR = { mount: mount };
})();
