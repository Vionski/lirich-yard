(() => {
  'use strict';
  const root = document.getElementById('app');
  const authKey = 'lirich-yard-supervisor-auth';
  let auth = null;

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(window.YARD_SUPABASE_URL || '') &&
      typeof window.YARD_SUPABASE_ANON_KEY === 'string' && window.YARD_SUPABASE_ANON_KEY.length > 20 &&
      /^https:\/\//.test(window.YARD_API || '');
  }
  function save(value) {
    auth = value;
    if (value) sessionStorage.setItem(authKey, JSON.stringify(value)); else sessionStorage.removeItem(authKey);
  }
  function load() {
    try { auth = JSON.parse(sessionStorage.getItem(authKey) || 'null'); } catch { auth = null; }
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('access_token')) {
      save({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + Number(h.get('expires_in') || 3600) });
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  async function refresh() {
    if (!auth?.refresh_token) return false;
    const r = await fetch(window.YARD_SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: window.YARD_SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refresh_token })
    });
    if (!r.ok) return false;
    const d = await r.json();
    save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + Number(d.expires_in || 3600) });
    return true;
  }
  function login(message = '') {
    root.innerHTML = '<section class="auth"><h1>Lirich Yard Supervisor</h1><p class="note">Use your approved Lirich email address. We will email you a secure sign-in link.</p><form><label for="email">Work email</label><input id="email" type="email" autocomplete="email" required><button>Send sign-in link</button><p class="note status"></p></form></section>';
    const form = root.querySelector('form'), status = root.querySelector('.status');
    if (message) { status.textContent = message; status.className = 'note status error'; }
    form.addEventListener('submit', async e => {
      e.preventDefault(); const button = form.querySelector('button'); button.disabled = true; status.className = 'note status'; status.textContent = 'Sending…';
      try {
        const redirect = location.origin + location.pathname;
        const r = await fetch(window.YARD_SUPABASE_URL + '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), {
          method: 'POST', headers: { apikey: window.YARD_SUPABASE_ANON_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({ email: form.email.value.trim(), create_user: false })
        });
        if (!r.ok) throw new Error('Sign-in could not be started. Check that this is an approved supervisor email.');
        status.textContent = 'Check your email and open the sign-in link on this device.';
      } catch (err) { status.textContent = err.message; status.className = 'note status error'; }
      finally { button.disabled = false; }
    });
  }
  async function start() {
    if (!configured()) return login('The dashboard has not been configured yet.');
    load();
    if (auth && auth.expires_at <= Math.floor(Date.now() / 1000) + 60 && !(await refresh())) save(null);
    if (!auth?.access_token) return login();
    root.innerHTML = '<div class="top"><button class="signout">Sign out</button></div><section id="yard-hr"></section>';
    root.querySelector('.signout').onclick = () => { save(null); login(); };
    window.LirichYardHR.mount(document.getElementById('yard-hr'), { api: window.YARD_API, accessToken: () => auth.access_token });
  }
  start().catch(() => { save(null); login('Sign-in expired. Please try again.'); });
})();
