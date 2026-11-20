// App
(() => {
  const D = window.KR_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const screenEl = $('#screen');
  const backBtn = $('#backBtn');
  const brandSub = $('#brandSub');
  const bottomNav = $('#bottomNav');
  const toastEl = $('#toast');
  const sheetEl = $('#sheet');
  const sheetBody = $('#sheetBody');

  // Storage
  const store = {
    get(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    remove(key) {
      localStorage.removeItem(key);
    }
  };

  const SB = window.KR_SB;
  const GUEST = { name: 'Guest', email: 'guest', guest: true };
  let account = null; // { id, name, email, role } when logged in through Supabase
  const Session = {
    email: () => (account ? account.email : 'guest'),
    user: () => (account ? { ...account, guest: false } : GUEST),
    id: () => (account ? account.id : null),
    isGuest: () => !account,
    set(sbUser, profile) {
      if (!sbUser) { account = null; return; }
      const meta = sbUser.user_metadata || {};
      account = {
        id: sbUser.id,
        email: (sbUser.email || '').toLowerCase(),
        name: (profile && profile.name) || meta.name || meta.full_name || (sbUser.email || '').split('@')[0],
        role: (profile && profile.role) || 'passenger'
      };
    }
  };
  // Pulls the account's saved places and searches from Supabase into this device.
  async function pullAccountData() {
    if (!account || !SB) return;
    const remote = await SB.sync.pull(account.id);
    if (!remote) return;
    if (remote.saved.home || remote.saved.work || remote.saved.others.length) store.set(`kr_saved_${account.email}`, remote.saved);
    if (remote.recent.length) store.set(`kr_recent_${account.email}`, remote.recent);
  }
  async function startSession(sbUser) {
    const profile = sbUser && SB ? await SB.auth.profile(sbUser.id) : null;
    if (profile && profile.blocked) { await SB.auth.signOut(); account = null; toast('This account has been blocked by the administrator.'); return false; }
    Session.set(sbUser, profile);
    return true;
  }
  // Carries what a guest saved on this device into an account that has nothing yet.
  function adoptGuestData(email) {
    for (const name of ['saved', 'recent', 'settings', 'draft', 'trip']) {
      const guestKey = `kr_${name}_guest`, userKey2 = `kr_${name}_${email}`;
      const g = store.get(guestKey, null);
      if (g !== null && store.get(userKey2, null) === null) store.set(userKey2, g);
      store.remove(guestKey);
    }
  }

  const userKey = (name) => `kr_${name}_${Session.email()}`;
  const Saved = {
    get() {
      const raw = store.get(userKey('saved'), { home: null, work: null, others: [] });
      const norm = (v) => {
        if (!v) return null;
        if (typeof v === 'string') { const d = D.findDestination(v); return d ? placeFromDest(d) : null; }
        return v;
      };
      return { home: norm(raw.home), work: norm(raw.work), others: (raw.others || []).map(norm).filter(Boolean) };
    },
    set(v) {
      store.set(userKey('saved'), v);
      if (account && SB) SB.sync.pushSaved(account.id, v).catch((e) => console.warn('sync saved:', e.message));
    }
  };
  function placeFromDest(d) { return { destId: d.id, name: d.name, lat: d.lat, lng: d.lng }; }
  function placeFromPoint(pos, name) { return { destId: null, name: name || D.describePoint(pos), lat: pos.lat, lng: pos.lng }; }
  function placeParams(pl, label) { return pl.destId ? { to: pl.destId } : { to: 'custom', toPoint: { lat: pl.lat, lng: pl.lng }, toName: label || pl.name }; }
  const Recent = {
    get: () => store.get(userKey('recent'), []),
    add(entry) {
      const same = (r) => r.from === entry.from && r.to === entry.to;
      const list = Recent.get().filter((r) => !same(r));
      list.unshift({ ...entry, at: Date.now() });
      store.set(userKey('recent'), list.slice(0, 10));
      if (account && SB) SB.sync.pushRecent(account.id, entry).catch((e) => console.warn('sync recent:', e.message));
    },
    clear: () => store.set(userKey('recent'), [])
  };
  const Draft = {
    get: () => store.get(userKey('draft'), null),
    set: (v) => store.set(userKey('draft'), v),
    clear: () => store.remove(userKey('draft'))
  };
  const HIDDEN_TYPES = ['elementary', 'kinder'];
  const passengerTypes = () => (D.DISCOUNTS && D.DISCOUNTS.length ? D.DISCOUNTS : D.DEFAULT_DISCOUNTS).filter((t) => !HIDDEN_TYPES.includes(t.id));
  const isPrivileged = (t) => !!t && (t.discount > 0 || t.amount > 0);
  const Settings = {
    get: () => ({ passenger: 'regular', people: 1, discounted: 1, ...store.get(userKey('settings'), {}) }),
    set: (patch) => store.set(userKey('settings'), { ...Settings.get(), ...patch })
  };
  const MAX_PEOPLE = 6;
  const people = () => Math.min(MAX_PEOPLE, Math.max(1, Settings.get().people || 1));
  const discountedCount = () => Math.min(people(), Math.max(0, Settings.get().discounted ?? 1));
  function groupFare(f) {
    const n = people();
    const d = f.discounted ? discountedCount() : 0;
    return { n, d, low: f.low * d + f.regularLow * (n - d), high: f.high * d + f.regularHigh * (n - d) };
  }
  const rangeTxt = (lo, hi) => (lo === hi ? D.peso(lo) : `${D.peso(lo)}–${D.peso(hi)}`);
  function groupLine(f) {
    const g = groupFare(f);
    if (g.n === 1) return '';
    const parts = [];
    if (g.d) parts.push(`${g.d} × ${rangeTxt(f.low, f.high)} ${esc(passengerType().label.toLowerCase())}`);
    if (g.n - g.d) parts.push(`${g.n - g.d} × ${rangeTxt(f.regularLow, f.regularHigh)} regular`);
    const moto = f.vehicle.id === 'habal' ? ` · ${g.n} motorcycles` : '';
    return `Total for ${g.n}: ${rangeTxt(g.low, g.high)} (${parts.join(' + ')})${moto}`;
  }
  function peopleStepper() {
    const n = people(), d = discountedCount(), disc = isPrivileged(passengerType());
    return `<div class="field"><label>Passengers</label>
      <div class="stepper-row">
        <div class="stepper"><button data-step="people" data-dir="-1" ${n <= 1 ? 'disabled' : ''}>−</button><span>${n} ${n === 1 ? 'person' : 'people'}</span><button data-step="people" data-dir="1" ${n >= MAX_PEOPLE ? 'disabled' : ''}>+</button></div>
        ${disc && n > 1 ? `<div class="stepper"><button data-step="discounted" data-dir="-1" ${d <= 0 ? 'disabled' : ''}>−</button><span>${d} with discount ID</span><button data-step="discounted" data-dir="1" ${d >= n ? 'disabled' : ''}>+</button></div>` : ''}
      </div>
      ${n > 1 ? `<div class="hint">${disc ? 'Passengers without a valid ID pay the regular fare.' : 'Fares are per passenger; the total is shown for the whole group.'}</div>` : ''}
    </div>`;
  }
  function bindPeopleStepper(onChange) {
    $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
      const cur = Settings.get();
      if (b.dataset.step === 'people') {
        const n = Math.min(MAX_PEOPLE, Math.max(1, people() + Number(b.dataset.dir)));
        Settings.set({ people: n, discounted: Math.min(n, cur.discounted ?? 1) });
      } else {
        Settings.set({ discounted: Math.min(people(), Math.max(0, discountedCount() + Number(b.dataset.dir))) });
      }
      onChange();
    }));
  }
  const passengerType = () => passengerTypes().find((t) => t.id === Settings.get().passenger) || passengerTypes()[0];
  const fareOpts = (extra = {}) => ({ discount: passengerType().discount, type: passengerType(), ...extra });
  const routeOpts = (r) => (r ? { km: r.km, kmOut: r.kmOut } : { km: 0 });
  const fareNote = (f) => (f.discounted ? ` · ${passengerType().label} fare, ${f.offText} (regular ${rangeTxt(f.regularLow, f.regularHigh)})` : '');
  function passengerChips() {
    const cur = passengerType().id;
    return `<div class="field"><label>Passenger type</label><div class="chips" id="paxChips">${passengerTypes().map((t) =>
      `<button class="chip ${t.id === cur ? 'active' : ''}" data-pax="${t.id}">${esc(t.label)}</button>`).join('')}</div>
      <div class="hint">Tricycle fares for students, senior citizens and PWDs follow the city ordinance. Other vehicles give them a discount. Show a valid ID to the driver.</div></div>`;
  }
  function bindPassengerChips(onChange) {
    $$('[data-pax]').forEach((b) => b.addEventListener('click', () => {
      Settings.set({ passenger: b.dataset.pax });
      toast(`${passengerTypes().find((t) => t.id === b.dataset.pax).label} fare selected`);
      onChange();
    }));
  }
  const Trip = {
    get: () => store.get(userKey('trip'), null),
    set: (v) => store.set(userKey('trip'), v),
    clear: () => store.remove(userKey('trip'))
  };

  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch { /* not supported or denied: ignore */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Trip.get()) keepAwake(true);
  });


  // Tiny utilities
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 2200);
  }

  function openSheet(html, bind) {
    sheetBody.innerHTML = html;
    sheetEl.hidden = false;
    if (bind) bind(sheetBody);
  }
  function closeSheet() {
    sheetEl.hidden = true;
    sheetBody.innerHTML = '';
  }
  sheetEl.addEventListener('click', (e) => {
    if (e.target === sheetEl) closeSheet();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheetEl.hidden) closeSheet(); });

  function confirmSheet(title, message, okLabel, onOk, danger = true) {
    openSheet(
      `<h3>${esc(title)}</h3>
       <p class="muted small" style="margin:0 0 14px">${esc(message)}</p>
       <button class="btn ${danger ? 'danger' : ''}" id="cfOk">${esc(okLabel)}</button>
       <button class="btn outline" id="cfCancel">Cancel</button>`,
      (root) => {
        $('#cfOk', root).onclick = () => { closeSheet(); onOk(); };
        $('#cfCancel', root).onclick = closeSheet;
      }
    );
  }

  function requireAccount(what) {
    if (!Session.isGuest()) return true;
    openSheet(
      `<h3>Create an account to ${esc(what)}</h3>
       <p class="muted small" style="margin:0 0 14px">Saved places are kept with your account so they follow you to any phone. Finding fares, viewing routes and tracking trips stay free to use as a guest.</p>
       <button class="btn" id="raSignup">Create account</button>
       <button class="btn secondary" id="raLogin">Log in</button>
       <button class="btn outline" id="raNo">Not now</button>`,
      (root) => {
        $('#raSignup', root).onclick = () => go('signup');
        $('#raLogin', root).onclick = () => go('login');
        $('#raNo', root).onclick = closeSheet;
      }
    );
    return false;
  }

  window.addEventListener('error', (e) => {
    console.error(e.error || e.message);
    toast('Something went wrong. Please try again.');
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error(e.reason);
  });

  const Net = { online: navigator.onLine };
  function updateNetBanner() {
    let bar = $('#netBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'netBar';
      bar.className = 'net-bar';
      $('.phone').insertBefore(bar, screenEl);
    }
    bar.textContent = 'No internet connection. Map, road routes and new fares may be unavailable.';
    bar.hidden = Net.online;
  }
  window.addEventListener('online', () => { Net.online = true; updateNetBanner(); toast('Back online'); });
  window.addEventListener('offline', () => { Net.online = false; updateNetBanner(); });

  function timeAgo(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    return `${Math.round(h / 24)} day(s) ago`;
  }

  const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

  // Live location
  const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const platform = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  };
  function locationHelpSheet() {
    const app = isStandalone();
    const steps = {
      android: [
        'Swipe down from the top of the screen and turn on <strong>Location</strong>.',
        'Open the phone <strong>Settings → Apps → Chrome → Permissions → Location</strong>. Choose <strong>Allow only while using the app</strong> and turn on <strong>Use precise location</strong>.',
        app
          ? 'Press and hold the <strong>Koronadal Ride</strong> icon → <strong>App info</strong> (or <strong>Site settings</strong>) → <strong>Permissions → Location → Allow</strong>.'
          : 'In Chrome, tap the icon at the left of the address bar → <strong>Permissions → Location → Allow</strong>.',
        'Go outdoors or near a window and wait a few seconds for the GPS to settle.'
      ],
      ios: [
        'Open <strong>Settings → Privacy &amp; Security → Location Services</strong> and turn it on.',
        'In the same list, tap <strong>Safari Websites</strong>. Choose <strong>While Using the App</strong> and turn on <strong>Precise Location</strong>.',
        app ? 'Tap <strong>Try again</strong> below, then choose <strong>Allow</strong> when the phone asks. If it never asks, remove the Koronadal Ride icon from the Home Screen and add it again from Safari.' : 'Reload this page and tap <strong>Allow</strong> when Safari asks for your location.',
        'Go outdoors or near a window and wait a few seconds for the GPS to settle.'
      ],
      desktop: [
        'Click the icon at the left of the address bar → <strong>Site settings</strong> → set <strong>Location</strong> to <strong>Allow</strong>, then reload this page.',
        '<strong>Mac:</strong> System Settings → Privacy &amp; Security → Location Services → turn it on and tick your browser.',
        'A laptop has no GPS, so its position comes from Wi-Fi and may be off by a few hundred metres. Use ✎ on the map for an exact starting point.'
      ]
    }[platform()];
    openSheet(
      `<h3>Get an accurate location</h3>
       <p class="muted small" style="margin:0 0 10px">The app needs the device's precise location. Check these in order:</p>
       <ol class="tips-list" style="margin-bottom:10px">${steps.map((t) => `<li>${t}</li>`).join('')}</ol>
       <p class="muted small" style="margin:0 0 14px">Phone's answer: ${esc(Loc.diagText())}</p>
       <button class="btn" id="lhRetry">Try again</button>
       <button class="btn outline" id="lhManual">Set my location on the map instead</button>`,
      (root) => {
        $('#lhRetry', root).onclick = () => { closeSheet(); Loc.useDevice(); };
        $('#lhManual', root).onclick = () => { closeSheet(); toast('Press ✎ on the map, then tap where you are'); };
      }
    );
  }
  function askLocationSheet() {
    openSheet(
      `<h3>Turn on live location</h3>
       <p class="muted small" style="margin:0 0 14px">Tap the button, then choose <strong>Allow</strong> when the phone asks.</p>
       <button class="btn" id="laGo">Turn on live location</button>
       <button class="btn outline" id="laManual">Set my location on the map instead</button>`,
      (root) => {
        $('#laGo', root).onclick = () => { closeSheet(); Loc.askFirst = false; Loc.asked = true; Loc.start(); toast('Locating with the device…'); };
        $('#laManual', root).onclick = () => { closeSheet(); toast('Press ✎ on the map, then tap where you are'); };
      }
    );
  }
  const Loc = {
    blocked: false,
    askFirst: false,
    askShown: false,
    asked: false,
    startedAt: 0,
    diag: null,
    pos: null,
    source: null,
    status: 'idle',
    error: '',
    lastError: '',
    watchId: null,
    coarseId: null,
    restarts: 0,
    fixAt: 0,
    shown: null,
    shownAt: 0,
    deniedAt: 0,
    ipPos: null,
    fellBack: false,
    held: false,
    heldAt: 0,
    selectAt: 0,
    selectEl: null,
    pending: false,
    listeners: new Set(),

    on(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    },
    busy() {
      const now = Date.now();
      if (this.held && now - this.heldAt < 8000) return true;
      const a = document.activeElement;
      if (!a || a.tagName !== 'SELECT') { this.selectEl = null; return false; }
      if (this.selectEl !== a) { this.selectEl = a; this.selectAt = now; }
      return now - this.selectAt < 15000;
    },
    emit() {
      if (this.busy()) { this.pending = true; return; }
      this.pending = false;
      this.shown = this.pos ? { ...this.pos } : null;
      this.shownAt = Date.now();
      this.listeners.forEach((fn) => {
        try { fn(this); } catch (err) { console.error(err); }
      });
    },
    flush() {
      if (this.pending) this.emit();
    },
    setPos(lat, lng, accuracy, source) {
      const wasLive = this.source === 'gps' && this.status === 'ok';
      if (source === 'gps') this.lastError = '';
      this.pos = { lat, lng, accuracy: accuracy || null };
      this.source = source;
      this.status = 'ok';
      this.error = '';
      if (source === 'gps' && wasLive && this.shown && !this.pending) {
        const moved = D.haversineKm(this.shown, this.pos) * 1000;
        const before = this.shown.accuracy || 0;
        const steady = Math.abs(before - (accuracy || 0)) < Math.max(10, before * 0.3);
        if (moved < 8 && steady && Date.now() - this.shownAt < 20000) return;
      }
      this.emit();
    },
    accept(p) {
      if (this.source === 'manual') return;
      const c = p.coords;
      const acc = c.accuracy || 9999;
      const now = Date.now();
      if (this.source === 'gps' && this.pos && this.pos.accuracy) {
        const fresh = now - this.fixAt < 20000;
        if (fresh && acc > 60 && acc > this.pos.accuracy * 2) return;
      }
      this.fixAt = now;
      this.setPos(c.latitude, c.longitude, acc, 'gps');
    },
    quality() {
      if (this.source !== 'gps' || !this.pos || !this.pos.accuracy) return null;
      const a = this.pos.accuracy;
      return a <= 60 ? 'good' : a <= 250 ? 'fair' : 'poor';
    },
    accText() {
      const a = this.pos && this.pos.accuracy;
      if (!a || this.source !== 'gps') return '';
      return a < 1000 ? `±${Math.max(5, Math.round(a / 5) * 5)} m` : `±${(a / 1000).toFixed(1)} km`;
    },
    autoStart() {
      if (this.askFirst) {
        if (!this.askShown) { this.askShown = true; setTimeout(askLocationSheet, 500); }
        return;
      }
      if (this.blocked) return;
      if (this.deniedAt && Date.now() - this.deniedAt < 15000) return;
      this.start();
    },
    note(err) {
      this.diag = { code: err.code, message: String(err.message || '').slice(0, 90), ms: Date.now() - this.startedAt };
    },
    diagText() {
      const where = `${{ ios: 'iPhone', android: 'Android', desktop: 'Computer' }[platform()]}, ${isStandalone() ? 'Home Screen app' : 'browser'}`;
      if (this.source === 'gps' && this.pos) return `Working ${this.accText()} (${where})`;
      const d = this.diag;
      if (!d) return `${this.status === 'locating' ? 'No answer yet' : 'Not asked yet'} (${where})`;
      const what = { 1: 'Permission denied', 2: 'Position unavailable', 3: 'Timed out' }[d.code] || 'Error';
      return `${what} after ${(d.ms / 1000).toFixed(1)} s${d.message ? `: ${d.message}` : ''} (${where})`;
    },
    stop() {
      const geo = navigator.geolocation;
      if (geo && this.watchId !== null) geo.clearWatch(this.watchId);
      if (geo && this.coarseId !== null) geo.clearWatch(this.coarseId);
      this.watchId = null;
      this.coarseId = null;
    },
    start() {
      if (this.watchId !== null || this.source === 'manual' || this.status === 'locating') return;
      if (!navigator.geolocation) return this.fallback('Location is not supported on this device.');
      if (!window.isSecureContext) return this.fallback('Live GPS needs a secure (https) link. On this Wi-Fi test address, set your location with ✎ on the map instead.');
      this.status = 'locating';
      this.fellBack = false;
      this.restarts = 0;
      this.startedAt = Date.now();
      this.diag = null;
      this.emit();
      this.watchPrecise();
      this.watchCoarse();
    },
    denied() {
      this.stop();
      this.deniedAt = Date.now();
      this.blocked = true;
      this.status = 'idle';
      if (this.asked) { this.asked = false; setTimeout(locationHelpSheet, 400); }
      this.fallback('Location permission was denied. Allow location for this app in your phone or browser settings, then tap "Use device location".');
    },
    noFix(err) {
      if (this.source === 'gps' || this.fellBack) return;
      this.fellBack = true;
      this.fallback(err.code === 2 ? 'The device could not determine its position yet.' : 'Finding your location is taking long. Still trying…', true);
    },
    watchPrecise() {
      const geo = navigator.geolocation;
      this.watchId = geo.watchPosition(
        (p) => this.accept(p),
        (err) => {
          this.note(err);
          if (err.code === 1) return this.denied();
          if (this.coarseId === null) this.watchCoarse();
          if (this.source !== 'gps' && this.restarts < 6) {
            this.restarts += 1;
            geo.clearWatch(this.watchId);
            this.watchId = -1;
            setTimeout(() => { if (this.watchId === -1 && this.source !== 'manual') this.watchPrecise(); }, 4000);
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
    },
    watchCoarse() {
      this.coarseId = navigator.geolocation.watchPosition(
        (p) => this.accept(p),
        (err) => {
          if (this.source !== 'gps') this.note(err);
          if (err.code === 1) return this.denied();
          this.noFix(err);
        },
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }
      );
    },
    async fallback(reason, quiet) {
      if (this.source === 'manual' || this.source === 'gps') return;
      if (reason) this.lastError = reason;
      if (!this.ipPos) {
        try {
          const r = await fetch('https://ipapi.co/json/');
          const j = await r.json();
          if (j && typeof j.latitude === 'number') this.ipPos = { lat: j.latitude, lng: j.longitude };
        } catch { /* offline or blocked: fall through */ }
      }
      if (this.source === 'manual' || this.source === 'gps') return;
      if (this.ipPos) return this.setPos(this.ipPos.lat, this.ipPos.lng, 5000, 'ip');
      this.status = 'unavailable';
      this.error = reason || '';
      this.emit();
      if (this.error && !quiet) toast(this.error);
    },
    setManual(lat, lng) {
      this.stop();
      this.setPos(lat, lng, null, 'manual');
    },
    async useDevice() {
      if (!window.isSecureContext && navigator.geolocation) {
        toast('Live GPS is not available on this http address. Use ✎ on the map, or open the https version.');
        return;
      }
      if (platform() !== 'ios' && navigator.permissions && navigator.permissions.query) {
        try {
          const st = await navigator.permissions.query({ name: 'geolocation' });
          if (st.state === 'denied') {
            this.lastError = 'Location is blocked for this app.';
            this.emit();
            locationHelpSheet();
            return;
          }
        } catch { /* not supported */ }
      }
      if (this.blocked && platform() === 'ios') {
        try { sessionStorage.setItem('kr-loc-ask', '1'); } catch { /* private mode */ }
        location.reload();
        return;
      }
      this.lastError = '';
      this.deniedAt = 0;
      this.blocked = false;
      this.askFirst = false;
      this.stop();
      this.source = null;
      this.pos = null;
      this.status = 'idle';
      this.start();
      toast('Locating with the device…');
    },
    label() {
      if (this.status === 'locating') return 'Finding your location…';
      if (this.status === 'unavailable') return 'Location unavailable. Tap ✎ then the map to set it.';
      if (!this.pos) return 'Location off';
      let src = { gps: 'Live', manual: 'Set manually', ip: 'Approximate' }[this.source] || '';
      if (this.source === 'gps') src = `${this.quality() === 'poor' ? 'Weak GPS' : 'Live'} ${this.accText()}`.trim();
      const where = D.isInKoronadal(this.pos) ? D.describePoint(this.pos) : 'Outside Koronadal City';
      return `${src} · ${where}`;
    }
  };
  document.addEventListener('pointerdown', () => { Loc.held = true; Loc.heldAt = Date.now(); }, true);
  ['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, () => {
    setTimeout(() => { Loc.held = false; Loc.flush(); }, 150);
  }, true));
  ['focusout', 'change'].forEach((ev) => document.addEventListener(ev, () => setTimeout(() => Loc.flush(), 60), true));
  setInterval(() => Loc.flush(), 2000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Loc.source === 'manual' || Loc.blocked || Loc.askFirst) return;
    if (Loc.watchId === null && Loc.coarseId === null) return;
    const now = Date.now();
    if (now - Loc.fixAt > 30000 && now - Loc.startedAt > 30000) { Loc.stop(); Loc.status = 'idle'; Loc.start(); }
  });
  try {
    if (sessionStorage.getItem('kr-loc-ask')) { sessionStorage.removeItem('kr-loc-ask'); Loc.askFirst = true; }
  } catch { /* private mode */ }

  function originFromPoint(pos) {
    const n = D.nearestDestination(pos);
    return { id: 'me', name: 'Your location', sub: D.describePoint(pos), road: n.place.road, lat: pos.lat, lng: pos.lng, cat: [] };
  }
  function resolveFrom(p) {
    if (p.fromPoint) return originFromPoint(p.fromPoint);
    return D.findDestination(p.from);
  }
  function customDest(pos, name) {
    const n = D.nearestDestination(pos);
    return { id: 'custom', name: name || 'Pinned location', sub: D.describePoint(pos), road: n.place.road, lat: pos.lat, lng: pos.lng, cat: [] };
  }
  function resolveTo(id, point, name) {
    if (id === 'custom' && point) return customDest(point, name);
    return D.findDestination(id);
  }

  const GROUPS = [
    ['City center & landmarks', (d) => d.cat.includes('landmarks')],
    ['Terminals', (d) => d.cat.includes('terminals')],
    ['Malls', (d) => d.cat.includes('malls')],
    ['Schools', (d) => d.cat.includes('schools')],
    ['Hospitals', (d) => d.cat.includes('hospitals')],
    ['Barangays', (d) => d.cat.includes('barangays')]
  ];

  function destOptions(selectedId, placeholder, opts = {}) {
    let html = `<option value="">${esc(placeholder)}</option>`;
    if (opts.includeMe && Loc.pos) {
      html += `<option value="me" ${selectedId === 'me' ? 'selected' : ''}>📍 Your location (${esc(originFromPoint(Loc.pos).sub)})</option>`;
    }
    for (const [label, test] of GROUPS) {
      const items = D.DESTINATIONS.filter(test);
      if (!items.length) continue;
      html += `<optgroup label="${esc(label)}">`;
      for (const d of items) {
        html += `<option value="${d.id}" ${d.id === selectedId ? 'selected' : ''}>${esc(d.name)}</option>`;
      }
      html += '</optgroup>';
    }
    return html;
  }

  function fromParams(value) {
    return value === 'me' && Loc.pos ? { fromPoint: Loc.pos } : { from: value };
  }

  // Router
  const MAIN_TABS = ['home', 'explore', 'saved', 'profile'];
  const SUBTITLES = {
    signup: 'Create your passenger account',
    login: 'Welcome back',
    home: 'Your local route companion',
    explore: 'Discover places and transport options',
    saved: 'Your favorite places',
    profile: 'Your account and preferences',
    search: 'Find your route. Know your fare.',
    fares: 'Estimated fares',
    details: 'Route details',
    personal: 'Personal information',
    recent: 'Recent searches',
    pick: 'Choose a place on the map',
    about: 'How fares are estimated',
    ordinance: 'Official tricycle fares'
  };

  const state = { screen: 'login', params: {}, stack: [] };
  let cleanup = null;

  function go(screen, params = {}, opts = {}) {
    if (!opts.replace && !MAIN_TABS.includes(screen)) {
      state.stack.push({ screen: state.screen, params: state.params });
    }
    if (MAIN_TABS.includes(screen) || opts.replace) state.stack = [];
    state.screen = screen;
    state.params = params;
    render();
  }

  function back() {
    const prev = state.stack.pop();
    if (prev) {
      state.screen = prev.screen;
      state.params = prev.params;
    } else {
      state.screen = 'home';
      state.params = {};
    }
    render();
  }

  backBtn.addEventListener('click', back);
  $$('#bottomNav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.nav)));

  function render() {
    try {
      renderInner();
    } catch (err) {
      console.error(err);
      screenEl.innerHTML = `<div class="empty"><div class="big">⚠️</div>Something went wrong while opening this screen.<br><br><button class="btn" id="recover">Go to Home</button></div>`;
      $('#recover').onclick = () => { state.stack = []; go(Session.user() ? 'home' : 'login', {}, { replace: true }); };
    }
  }

  function renderInner() {
    if (cleanup) { try { cleanup(); } catch (err) { console.error(err); } cleanup = null; }
    Loc.autoStart();
    const isMain = MAIN_TABS.includes(state.screen);

    brandSub.textContent = SUBTITLES[state.screen] || '';
    screenEl.dataset.screen = state.screen;
    document.body.dataset.screen = state.screen;
    backBtn.hidden = isMain;
    bottomNav.hidden = false;
    $$('#bottomNav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === state.screen));

    closeSheet();
    screenEl.scrollTop = 0;
    (SCREENS[state.screen] || SCREENS.home)(state.params);

    const g = $('#googleBtn', screenEl);
    if (g) g.addEventListener('click', async () => {
      if (!SB || !SB.client) return toast('Accounts are unavailable right now.');
      g.disabled = true;
      if (!(await SB.auth.googleEnabled())) { g.disabled = false; toast('Google sign-in is not enabled yet. Please use email and password.'); return; }
      const { error } = await SB.auth.signInWithGoogle();
      if (error) { g.disabled = false; toast(/provider|enabled/i.test(error.message) ? 'Google sign-in is not enabled yet.' : error.message); }
    });
    $$('[data-go]', screenEl).forEach((el) =>
      el.addEventListener('click', () => {
        const params = el.dataset.params ? JSON.parse(el.dataset.params) : {};
        go(el.dataset.go, params);
      })
    );
  }

  // Shared pieces
  function popularTiles() {
    const items = D.DESTINATIONS.filter((d) => d.cat.includes('popular')).slice(0, 6);
    return `<div class="grid3">${items
      .map(
        (d) => `<button class="tile" data-go="search" data-params='${JSON.stringify({ to: d.id })}'>
          <div class="t">${esc(d.name)}</div><div class="s">${esc(d.sub)}</div></button>`
      )
      .join('')}</div>`;
  }

  function placeActionsSheet(d) {
    openSheet(
      `<h3>${esc(d.name)}</h3>
       <p class="muted small" style="margin:0 0 14px">${esc(d.sub)} · ${esc(d.road)}</p>
       ${Trip.get() ? '<button class="btn" id="shTrip">Change my trip destination to here</button>' : ''}
       ${Loc.pos ? `<button class="btn ${Trip.get() ? 'secondary' : ''}" id="shLive">Fare from my location</button>` : ''}
       <button class="btn ${Loc.pos ? 'secondary' : ''}" id="shGo">Get fare to this place</button>
       <button class="btn secondary" id="shFrom">Use as starting point</button>
       <button class="btn outline" id="shHere">📍 Set as my current location</button>
       <button class="btn outline" id="shSave">${Session.isGuest() ? 'Save this place (account needed)' : 'Save this place'}</button>`,
      (root) => {
        const live = $('#shLive', root);
        if (live) live.onclick = () => go('fares', { fromPoint: Loc.pos, to: d.id });
        const change = $('#shTrip', root);
        if (change) change.onclick = () => { closeSheet(); go('home', { changeTo: d.id }); };
        $('#shHere', root).onclick = () => {
          Loc.setManual(d.lat, d.lng);
          closeSheet();
          toast(`Your location is now ${d.name}`);
          render();
        };
        $('#shGo', root).onclick = () => go('search', { to: d.id });
        $('#shFrom', root).onclick = () => go('search', { from: d.id });
        $('#shSave', root).onclick = () => savePlaceSheet(d);
      }
    );
  }

  function savePlaceSheet(d) {
    if (!requireAccount('save places')) return;
    openSheet(
      `<h3>Save "${esc(d.name)}" as</h3>
       <button class="btn secondary" data-slot="home">⌂ Home</button>
       <button class="btn secondary" data-slot="work">▣ School / Work</button>
       <button class="btn outline" data-slot="other">♡ Other favorite place</button>`,
      (root) => {
        $$('[data-slot]', root).forEach((b) =>
          b.addEventListener('click', () => {
            const saved = Saved.get();
            const pl = d.id === 'custom' ? placeFromPoint(d, d.name) : placeFromDest(d);
            if (b.dataset.slot === 'other') {
              if (!saved.others.some((x) => x.name === pl.name)) saved.others.push(pl);
            } else {
              saved[b.dataset.slot] = pl;
            }
            Saved.set(saved);
            closeSheet();
            toast('Saved to your places');
            if (state.screen === 'saved') render();
          })
        );
      }
    );
  }

  function recentItem(r) {
    const a = r.fromPoint ? originFromPoint(r.fromPoint) : D.findDestination(r.from);
    const b = resolveTo(r.to, r.toPoint, r.toName);
    if (!a || !b) return '';
    const params = { ...(r.fromPoint ? { fromPoint: r.fromPoint } : { from: r.from }), to: r.to, ...(r.toPoint ? { toPoint: r.toPoint, toName: r.toName } : {}) };
    return `<button class="item" data-go="fares" data-params='${JSON.stringify(params)}'>
      <div class="icon">↻</div>
      <div class="body"><div class="title">${esc(a.name)} → ${esc(b.name)}</div><div class="sub">${timeAgo(r.at)}</div></div>
      <div class="chev">›</div></button>`;
  }

  // Routing
  function distToLineM(pos, coords) {
    const kx = 111320 * Math.cos(pos.lat * Math.PI / 180);
    const ky = 110540;
    let best = Infinity;
    for (let i = 1; i < coords.length; i += 1) {
      const ax = (coords[i - 1][1] - pos.lng) * kx, ay = (coords[i - 1][0] - pos.lat) * ky;
      const dx = (coords[i][1] - pos.lng) * kx - ax, dy = (coords[i][0] - pos.lat) * ky - ay;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) best = d;
    }
    return best;
  }
  const Route = {
    viaDone: new Map(),
    viaPending: new Map(),
    viaKey: (a, vias, b) => [a, ...vias, b].map((q) => `${q.lat.toFixed(4)},${q.lng.toFixed(4)}`).join('>'),
    viaCached(a, vias, b) {
      return this.viaDone.get(this.viaKey(a, vias, b)) || null;
    },
    viaGet(a, vias, b) {
      const k = this.viaKey(a, vias, b);
      if (this.viaDone.has(k)) return Promise.resolve(this.viaDone.get(k));
      if (this.viaPending.has(k)) return this.viaPending.get(k);
      const p = (async () => {
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 8000);
          const pts = [a, ...vias, b].map((q) => `${q.lng},${q.lat}`).join(';');
          const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson&continue_straight=false`, { signal: ctl.signal });
          clearTimeout(t);
          const j = await r.json();
          const rt = (j.routes || [])[0];
          if (!rt) return null;
          const coords = rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          if (coords.length < 2) return null;
          const res = { coords, km: Math.max(0.1, Math.round(rt.distance / 100) / 10), minutes: Math.round(rt.duration / 60), meters: rt.distance, kmOut: D.outsideKm(coords), key: k };
          this.viaDone.set(k, res);
          return res;
        } catch {
          return null;
        } finally {
          this.viaPending.delete(k);
        }
      })();
      this.viaPending.set(k, p);
      return p;
    },
    pending: new Map(),
    done: new Map(),
    failed: new Map(),
    key: (a, b) => `${a.lat.toFixed(3)},${a.lng.toFixed(3)}>${b.lat.toFixed(3)},${b.lng.toFixed(3)}`,
    cached(a, b) {
      return a && b ? this.done.get(this.key(a, b)) || null : null;
    },
    choose(a, b, i) {
      const k = this.key(a, b);
      const cur = this.done.get(k);
      if (!cur || !cur.options || !cur.options[i]) return cur || null;
      const next = { ...cur.options[i], options: cur.options, index: i };
      this.done.set(k, next);
      return next;
    },
    get(a, b) {
      const k = this.key(a, b);
      if (this.done.has(k)) return Promise.resolve(this.done.get(k));
      if (this.pending.has(k)) return this.pending.get(k);
      if (this.failed.has(k) && Date.now() - this.failed.get(k) < 30000) return Promise.resolve(null);
      const p = (async () => {
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 8000);
          const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&alternatives=3`;
          const r = await fetch(url, { signal: ctl.signal });
          clearTimeout(t);
          const j = await r.json();
          const found = (j.routes || []).map((rt) => ({
            coords: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
            km: Math.max(0.1, Math.round(rt.distance / 100) / 10),
            minutes: Math.round(rt.duration / 60),
            meters: rt.distance
          })).map((o) => ({ ...o, kmOut: D.outsideKm(o.coords) })).filter((o) => o.coords.length > 1).sort((x, y) => x.meters - y.meters);
          if (!found.length) { this.failed.set(k, Date.now()); return null; }
          const mid = (o) => o.coords[Math.floor(o.coords.length / 2)];
          const same = (x, y) => Math.abs(x.meters - y.meters) < 60 && D.haversineKm({ lat: mid(x)[0], lng: mid(x)[1] }, { lat: mid(y)[0], lng: mid(y)[1] }) < 0.08;
          const options = [];
          for (const o of found) if (options.length < 3 && !options.some((x) => same(x, o))) options.push(o);
          const res = { ...options[0], options, index: 0 };
          this.done.set(k, res);
          return res;
        } catch {
          this.failed.set(k, Date.now());
          return null;
        } finally {
          this.pending.delete(k);
        }
      })();
      this.pending.set(k, p);
      return p;
    }
  };

  // Map
  function createMap(container, opts) {
    const map = L.map(container, { zoomControl: false, attributionControl: true, scrollWheelZoom: opts.scrollWheelZoom !== false })
      .setView([D.KORONADAL.center.lat, D.KORONADAL.center.lng], D.KORONADAL.zoom);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    let tileWarned = false;
    tiles.on('tileerror', () => {
      if (tileWarned) return;
      tileWarned = true;
      toast('Map images could not load. Check your internet connection.');
    });
    if (opts.showZone && D.RULES && D.RULES.zone && D.RULES.zone.length >= 3) {
      L.polygon(D.RULES.zone, { color: '#b4235a', weight: 2, dashArray: '7 6', fillColor: '#b4235a', fillOpacity: 0.04, interactive: false }).addTo(map);
    }
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.setMaxBounds(D.KORONADAL.bounds);
    map.setMinZoom(11);

    const pins = {};
    for (const d of D.DESTINATIONS) {
      const m = L.marker([d.lat, d.lng], { icon: L.divIcon({ className: 'pin', iconSize: [14, 14] }), title: d.name }).addTo(map);
      m.bindPopup(`<b>${esc(d.name)}</b><br><span style="color:#6b7585">${esc(d.sub)}</span><br><button class="btn sm" data-pick="${d.id}">${esc(opts.pickLabel || 'Set as destination')}</button>`);
      pins[d.id] = m;
    }
    map.on('popupopen', (e) => {
      const btn = e.popup.getElement().querySelector('[data-pick]');
      if (btn) btn.onclick = () => { map.closePopup(); opts.onPick(btn.dataset.pick); };
    });

    let me = null, ring = null;
    function showUser(pos, center) {
      if (!pos) return;
      const ll = [pos.lat, pos.lng];
      if (!me) {
        me = L.marker(ll, { icon: L.divIcon({ className: 'me-dot', iconSize: [18, 18] }), zIndexOffset: 1000, title: 'You are here' }).addTo(map);
      } else me.setLatLng(ll);
      if (pos.accuracy && pos.accuracy < 2000) {
        if (!ring) ring = L.circle(ll, { radius: pos.accuracy, color: '#2b56d6', weight: 1, fillOpacity: 0.08 }).addTo(map);
        else { ring.setLatLng(ll); ring.setRadius(pos.accuracy); }
      } else if (ring) { ring.remove(); ring = null; }
      if (center && D.isInKoronadal(pos)) map.setView(ll, Math.max(map.getZoom(), 15));
    }
    function highlight(id) {
      Object.entries(pins).forEach(([k, m]) =>
        m.setIcon(L.divIcon({ className: k === id ? 'pin selected' : 'pin', iconSize: k === id ? [18, 18] : [14, 14] }))
      );
    }
    let custom = null;
    function setCustom(pos) {
      if (!pos) { if (custom) { custom.remove(); custom = null; } return; }
      const ll = [pos.lat, pos.lng];
      if (!custom) custom = L.marker(ll, { icon: L.divIcon({ className: 'pin selected', iconSize: [18, 18] }), title: 'Pinned destination' }).addTo(map);
      else custom.setLatLng(ll);
    }
    let startPin = null;
    function setStart(pos) {
      if (!pos) { if (startPin) { startPin.remove(); startPin = null; } return; }
      const ll = [pos.lat, pos.lng];
      if (!startPin) {
        startPin = L.marker(ll, {
          icon: L.divIcon({ className: 'start-pin', html: '<span>Start</span>', iconSize: [48, 24], iconAnchor: [24, 32] }),
          zIndexOffset: 900, interactive: false, keyboard: false, title: 'Where this trip started'
        }).addTo(map);
      } else startPin.setLatLng(ll);
    }
    let lines = [];
    let lineSig = null;
    let fitSig = null;
    function clearLines() {
      lines.forEach((l) => l.remove());
      lines = [];
    }
    function drawLine(from, to, follow) {
      if (!from || !to) { clearLines(); lineSig = null; fitSig = null; return; }
      const key = Route.key(from, to);
      const cached = Route.cached(from, to);
      const sig = cached ? `${key}|${cached.index || 0}|${(cached.options || []).length}|${follow ? follow.key : ''}` : `${key}|pending`;
      if (sig === lineSig) return;
      clearLines();
      lineSig = sig;
      if (!cached) {
        const dashed = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: '#1f8a4c', weight: 3, dashArray: '6 6', interactive: false }).addTo(map);
        lines.push(dashed);
        if (fitSig !== sig) { fitSig = sig; map.fitBounds(dashed.getBounds(), { padding: [40, 40], maxZoom: 16 }); }
        Route.get(from, to).then((r) => { if (r && lineSig === sig) drawLine(from, to, follow); });
        return;
      }
      const options = cached.options && cached.options.length ? cached.options : [cached];
      const chosen = follow ? -1 : cached.index || 0;
      options.forEach((o, i) => {
        if (i === chosen) return;
        const pick = () => {
          if (opts.routesLocked && opts.routesLocked()) return;
          const r = Route.choose(from, to, i);
          drawLine(from, to);
          if (opts.onRoute) opts.onRoute(r);
        };
        const faded = L.polyline(o.coords, { color: '#6f7f9c', weight: 5, opacity: 0.5, lineCap: 'round' }).addTo(map);
        const touch = L.polyline(o.coords, { color: '#000', weight: 26, opacity: 0 }).addTo(map);
        faded.on('click', pick);
        touch.on('click', pick);
        lines.push(faded, touch);
      });
      const mainCoords = follow ? follow.coords : options[chosen].coords;
      const guard = L.polyline(mainCoords, { color: '#000', weight: 18, opacity: 0 }).addTo(map);
      const main = L.polyline(mainCoords, { color: '#1f8a4c', weight: 5, lineCap: 'round' }).addTo(map);
      lines.push(guard, main);
      const fitKey = `${key}|routes`;
      if (fitSig !== fitKey) {
        fitSig = fitKey;
        const box = L.latLngBounds([]);
        options.forEach((o) => box.extend(L.polyline(o.coords).getBounds()));
        map.fitBounds(box, { padding: [40, 40], maxZoom: 16 });
      }
    }
    return { map, showUser, highlight, drawLine, setCustom, setStart, destroy: () => map.remove() };
  }

  // Screens
  const SCREENS = {};

  SCREENS.signup = () => {
    screenEl.innerHTML = `
      <div class="card">
        <h1>Create an account</h1>
        <p class="lead">Save favorite places and find routes more easily.</p>
        <form id="f" novalidate>
          <div class="field"><label>Full name</label><input name="name" placeholder="Enter your full name" autocomplete="name" /></div>
          <div class="field"><label>Email address</label><input name="email" type="email" placeholder="you@example.com" autocomplete="email" /></div>
          <div class="field"><label>Password</label><input name="password" type="password" placeholder="Create a password (at least 6 characters)" /></div>
          <div class="field"><label>Confirm password</label><input name="confirm" type="password" placeholder="Re-enter your password" /></div>
          <label class="check"><input type="checkbox" name="agree" /> I agree to the Terms of Use and Privacy Policy</label>
          <div class="form-error" id="err" hidden></div>
          <button class="btn" type="submit">Create account</button>
        </form>
        <div class="or"><span>or</span></div>
        <button class="btn outline google" id="googleBtn" type="button"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.1 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg> Continue with Google</button>
        <div class="auth-footer">Already have an account? <button class="link" data-go="login">Log in</button></div>
      </div>
      <button class="btn outline" data-go="home" style="margin-top:14px">Continue without an account</button>
      <p class="muted small center" style="margin-top:16px">Your account is stored securely in the Koronadal Ride database and used only to keep your saved places.</p>`;

    $('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const name = f.get('name').trim();
      const email = f.get('email').trim().toLowerCase();
      const pw = f.get('password');
      const err = $('#err');
      let msg = '';
      if (name.length < 2) msg = 'Please enter your full name.';
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) msg = 'Please enter a valid email address.';
      else if (pw.length < 6) msg = 'Password must be at least 6 characters.';
      else if (pw !== f.get('confirm')) msg = 'Passwords do not match.';
      else if (!f.get('agree')) msg = 'Please agree to the Terms of Use and Privacy Policy.';
      else if (!SB || !SB.client) msg = 'Accounts are unavailable right now. Please try again later.';
      if (msg) {
        err.textContent = msg;
        err.hidden = false;
        return;
      }
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Creating account…';
      SB.auth.signUp(name, email, pw).then(async ({ data, error }) => {
        if (error) {
          err.textContent = /already|registered/i.test(error.message) ? 'An account with this email already exists.'
            : /rate limit/i.test(error.message) ? 'Sign-ups are paused for a moment because too many confirmation emails were sent. Please try again in an hour.'
            : error.message;
          err.hidden = false; btn.disabled = false; btn.textContent = 'Create account';
          return;
        }
        if (!data.session) {
          err.textContent = 'Account created. Check your email for a confirmation link, then log in.';
          err.hidden = false; err.style.color = '#1f8a4c'; btn.disabled = false; btn.textContent = 'Create account';
          return;
        }
        adoptGuestData(email);
        await startSession(data.user);
        const saved = Saved.get();
        if (saved.home || saved.work || saved.others.length) Saved.set(saved);
        toast(`Welcome, ${name.split(' ')[0]}!`);
        go('home');
      }).catch((ex) => { err.textContent = 'Could not reach the server. Check your internet connection.'; err.hidden = false; btn.disabled = false; btn.textContent = 'Create account'; console.warn(ex); });
    });
  };

  SCREENS.login = () => {
    screenEl.innerHTML = `
      <div class="card">
        <h1>Log in to your account</h1>
        <p class="lead">Access saved places and recent searches.</p>
        <form id="f" novalidate>
          <div class="field"><label>Email address</label><input name="email" type="email" placeholder="you@example.com" autocomplete="email" /></div>
          <div class="field"><label>Password</label><input name="password" type="password" placeholder="Enter your password" /></div>
          <div class="form-error" id="err" hidden></div>
          <button class="btn" type="submit">Log in</button>
        </form>
        <div class="or"><span>or</span></div>
        <button class="btn outline google" id="googleBtn" type="button"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.1 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg> Continue with Google</button>
        <div class="auth-footer">Don't have an account? <button class="link" data-go="signup">Sign up</button></div>
      </div>
      <button class="btn outline" data-go="home" style="margin-top:14px">Continue without an account</button>
      <div class="tip" style="margin-top:14px">
        <strong>No account needed for fares</strong>
        You can find fares, see the map and track trips as a guest. An account is needed only to save places.
      </div>
      `;

    $('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const err = $('#err');
      if (!String(f.get('email')).trim() || !f.get('password')) {
        err.textContent = 'Please enter your email and password.';
        err.hidden = false;
        return;
      }
      if (!SB || !SB.client) { err.textContent = 'Accounts are unavailable right now. Please try again later.'; err.hidden = false; return; }
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Logging in…';
      SB.auth.signIn(String(f.get('email')).trim().toLowerCase(), f.get('password')).then(async ({ data, error }) => {
        if (error) {
          err.textContent = /confirm/i.test(error.message) ? 'Please confirm your email first (check your inbox).' : 'Incorrect email or password.';
          err.hidden = false; btn.disabled = false; btn.textContent = 'Log in';
          return;
        }
        const email = (data.user.email || '').toLowerCase();
        adoptGuestData(email);
        if (!(await startSession(data.user))) { btn.disabled = false; btn.textContent = 'Log in'; return; }
        await pullAccountData();
        toast(`Welcome back, ${Session.user().name.split(' ')[0]}!`);
        go('home');
      }).catch((ex) => { err.textContent = 'Could not reach the server. Check your internet connection.'; err.hidden = false; btn.disabled = false; btn.textContent = 'Log in'; console.warn(ex); });
    });
  };

  SCREENS.home = (p) => {
    const user = Session.user();
    const existing = Trip.get();
    const draft = Draft.get();
    let toId = p.to !== undefined ? p.to : existing ? existing.toId : draft ? draft.toId : '';
    let toPoint = p.toPoint !== undefined ? p.toPoint : existing ? existing.toPoint || null : draft ? draft.toPoint || null : null;
    let mode = null;

    screenEl.innerHTML = `
      <h1>${user.guest ? 'Welcome to Koronadal Ride!' : `Hello, ${esc(user.name.split(' ')[0])}!`}</h1>
      <p class="lead">Your location is shown on the map. Pick a destination to see the fare.</p>
      <div class="map-wrap" id="mapWrap">
        <div id="map"></div>
        <div class="map-status" id="locStatus"><span class="dot"></span><span class="txt"></span></div>
        <div class="map-tools">
          <button class="map-btn" id="locate" title="Center on my location">◎</button>
          <button class="map-btn" id="manual" title="Set my location by tapping the map">✎</button>
          <button class="map-btn" id="pickDest" title="Set destination by tapping the map">⚑</button>
        </div>
        <div class="map-hint" id="mapHint" hidden></div>
      </div>
      <div id="tripPanel"></div>
      <h2>Popular places</h2>
      ${popularTiles()}
      <h2>Travel tip</h2>
      <div class="tip"><strong>Tricycle fares follow the city ordinance.</strong> Inside the Downtown Base-Fare Zone the regular fare is ${D.peso((D.VEHICLES.find((v) => v.id === 'tricycle') || { base: 15 }).base)} per passenger, however far you go. Habal-habal and multicab fares are estimates, so confirm them with the driver.</div>`;

    const view = createMap($('#map'), {
      onPick: (id) => { if (Trip.get()) return askChange(id, null); toId = id; drawPanel(); },
      routesLocked: () => !!mode,
      onRoute: (r) => {
        if (!r) return;
        if (Trip.get()) setTripRoute(r); else toast(`Route selected · ${fmtKm(r.km)}`);
        drawPanel();
      }
    });
    setTimeout(() => view.map.invalidateSize(), 50);

    function routeChips(r, followed) {
      if (!r || !r.options || (r.options.length < 2 && !followed)) return '';
      return `<div class="field"><label>Route the driver is taking</label>
        <div class="chips" id="routeChips">${followed ? `<button class="chip active" disabled>Road taken · ${fmtKm(followed.km)}</button>` : ''}${r.options.map((o, i) =>
          `<button class="chip ${!followed && i === r.index ? 'active' : ''}" data-route="${i}">${i === 0 ? 'Shortest' : `Route ${i + 1}`} · ${fmtKm(o.km)}</button>`).join('')}</div>
        <div class="hint">The green line is the route used for the fare. During a trip the app follows the road the driver takes and updates the fare by itself. You can also tap a grey line on the map or choose a route here.</div></div>`;
    }
    function setTripRoute(r, auto) {
      const t = Trip.get();
      if (!t || !r) return;
      const dest = resolveTo(t.toId, t.toPoint, t.toName);
      const all = dest ? D.estimateFaresBetween(t.start, dest, fareOpts(routeOpts(r))) : [];
      const f = all.find((x) => x.vehicle.id === t.vehicleId) || all[0];
      const updated = { ...t, km: r.km, kmOut: r.kmOut, routeIndex: r.via ? t.routeIndex || 0 : r.index || 0, vehicleId: f ? f.vehicle.id : t.vehicleId, via: r.via || undefined, hold: !auto };
      Trip.set(updated);
      if (SB && updated.remoteId && f) SB.sync.tripUpdate(updated.remoteId, { toId: t.toId, toPoint: t.toPoint, toName: t.toName, vehicleId: updated.vehicleId, km: r.km, fare: f }).catch(() => {});
      const g = f ? groupFare(f) : null;
      toast(`${auto ? 'The driver took another road. Route updated' : 'Route changed'} · ${fmtKm(r.km)}${g ? ` · ${rangeTxt(g.low, g.high)}` : ''}`);
    }
    const follow = { off: 0, since: 0, busy: false, wait: 0 };
    function followTrip() {
      const t = Trip.get();
      const pos = Loc.pos;
      if (!t || !pos || follow.busy || mode) return;
      if (Loc.source === 'ip' || (Loc.source === 'gps' && (!pos.accuracy || pos.accuracy > 60))) return;
      const to = resolveTo(t.toId, t.toPoint, t.toName);
      const base = to ? Route.cached(t.start, to) : null;
      if (!to || !base) return;
      if (D.haversineKm(pos, t.start) < 0.06 || D.haversineKm(pos, to) < 0.12) { follow.off = 0; return; }
      const vias = t.via || [];
      const followed = vias.length ? Route.viaCached(t.start, vias, to) : null;
      if (vias.length && !followed) return;
      const options = base.options && base.options.length ? base.options : [base];
      const tol = 40 + Math.min(pos.accuracy || 0, 25);
      const current = followed ? followed.coords : (options[t.routeIndex || 0] || options[0]).coords;
      if (distToLineM(pos, current) <= tol) {
        follow.off = 0;
        if (t.hold) Trip.set({ ...t, hold: false });
        return;
      }
      if (t.hold) return;
      const now = Date.now();
      if (!follow.off) follow.since = now;
      follow.off += 1;
      const sure = Loc.source === 'manual' || (follow.off >= 2 && now - follow.since >= 4000);
      if (!sure || now < follow.wait) return;
      if (!vias.length) {
        let best = -1, bestD = Infinity;
        options.forEach((o, i) => { const d = distToLineM(pos, o.coords); if (d <= tol && d < bestD) { best = i; bestD = d; } });
        if (best >= 0) {
          follow.off = 0;
          setTripRoute(Route.choose(t.start, to, best), true);
          return;
        }
      }
      const here = { lat: Number(pos.lat.toFixed(5)), lng: Number(pos.lng.toFixed(5)) };
      const next = vias.slice();
      const last = next[next.length - 1];
      if (last && (D.haversineKm(last, here) < 0.1 || next.length >= 8)) next[next.length - 1] = here; else next.push(here);
      follow.busy = true;
      Route.viaGet(t.start, next, to).then((r) => {
        follow.busy = false;
        const cur = Trip.get();
        if (!cur || cur.hold || cur.startedAt !== t.startedAt || cur.toId !== t.toId || JSON.stringify(cur.toPoint || null) !== JSON.stringify(t.toPoint || null)) return;
        const chain = [t.start, ...next, to];
        let crow = 0;
        for (let i = 1; i < chain.length; i += 1) crow += D.haversineKm(chain[i - 1], chain[i]);
        if (!r || r.meters / 1000 > crow * 2.2 + 0.6) { follow.wait = Date.now() + 30000; return; }
        follow.off = 0;
        setTripRoute({ ...r, via: next }, true);
        drawPanel();
      });
    }

    function askChange(id, point) {
      const trip = Trip.get();
      if (!trip) return;
      const next = resolveTo(id, point);
      if (!next) return;
      if (id !== 'custom' && id === trip.toId) { toast('That is already your destination'); return; }
      if (D.haversineKm(trip.start, next) < 0.05) { toast('That is where this trip started. Pick another place.'); return; }
      confirmSheet(
        'Change destination?',
        `Your trip continues to ${next.name}. The fare will be recomputed from where the trip started.`,
        'Change destination',
        () => applyChange(id, point, next),
        false
      );
    }
    async function applyChange(id, point, next) {
      if (!Trip.get()) return;
      toast('Updating your trip…');
      const r = await Route.get(Trip.get().start, next);
      const t = Trip.get();
      if (!t) return;
      const km = r ? r.km : 0;
      const all = D.estimateFaresBetween(t.start, next, fareOpts(r ? routeOpts(r) : { km }));
      if (!all.length) { toast('No vehicle covers that distance from where you started.'); return; }
      const f = all.find((x) => x.vehicle.id === t.vehicleId) || all[0];
      const switched = f.vehicle.id !== t.vehicleId;
      const updated = { ...t, toId: id, toPoint: id === 'custom' ? point : null, toName: undefined, km, kmOut: r ? r.kmOut : undefined, routeIndex: r ? r.index || 0 : 0, vehicleId: f.vehicle.id, arrivedNotified: false, changed: (t.changed || 0) + 1, via: undefined, hold: true };
      Trip.set(updated);
      toId = id;
      toPoint = updated.toPoint;
      Recent.add({ from: 'me', fromPoint: t.start, to: id, toPoint: updated.toPoint });
      if (SB && updated.remoteId) SB.sync.tripUpdate(updated.remoteId, { toId: id, toPoint: updated.toPoint, vehicleId: f.vehicle.id, km, fare: f }).catch(() => {});
      const g = groupFare(f);
      toast(`Destination changed · ${rangeTxt(g.low, g.high)}${switched ? ` · now ${f.vehicle.name}` : ''}`);
      drawPanel();
    }
    function setMode(next) {
      mode = mode === next ? null : next;
      $('#manual').classList.toggle('active', mode === 'manual');
      $('#pickDest').classList.toggle('active', mode === 'dest');
      $('#mapWrap').classList.toggle('manual', !!mode);
      const hint = $('#mapHint');
      hint.hidden = !mode;
      hint.textContent = mode === 'manual' ? 'Tap anywhere on the map to set YOUR location' : 'Tap anywhere on the map to set your DESTINATION';
    }
    view.map.on('click', (e) => {
      if (!mode) return;
      if (mode === 'manual') {
        Loc.setManual(e.latlng.lat, e.latlng.lng);
        toast('Your location was set');
      } else {
        if (Trip.get()) { setMode(null); askChange('custom', { lat: e.latlng.lat, lng: e.latlng.lng }); return; }
        toPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
        toId = 'custom';
        toast('Destination pinned');
        drawPanel();
      }
      setMode(null);
    });
    $('#pickDest').addEventListener('click', () => setMode('dest'));

    $('#locate').addEventListener('click', () => {
      if (Loc.pos) {
        view.map.flyTo([Loc.pos.lat, Loc.pos.lng], Math.max(view.map.getZoom(), 16), { duration: 0.8 });
        toast('Centered on your location');
      } else if (Loc.status !== 'locating' || Date.now() - Loc.startedAt > 20000) {
        Loc.useDevice();
        toast('Locating…');
      } else {
        toast('Still locating…');
      }
    });
    $('#manual').addEventListener('click', () => setMode('manual'));

    function updateStatus() {
      const s = $('#locStatus');
      if (!s) return;
      s.className = `map-status ${Loc.status}`;
      $('.txt', s).textContent = Loc.label();
    }

    function drawPanel() {
      const panel = $('#tripPanel');
      if (!panel) return;
      if (state.screen === 'home') state.params = { ...state.params, to: toId, toPoint };
      if (toId) Draft.set({ toId, toPoint }); else Draft.clear();
      const trip = Trip.get();

      if (trip) {
        const to = resolveTo(trip.toId, trip.toPoint, trip.toName);
        if (!to) { Trip.clear(); return drawPanel(); }
        view.setCustom(trip.toId === 'custom' ? to : null);
        view.setStart(trip.start);
        const startedAt = trip.startedAt ? new Date(trip.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
        let tripRoute = Route.cached(trip.start, to);
        if (!tripRoute) Route.get(trip.start, to).then((r) => { if (r && Trip.get()) drawPanel(); });
        else if (trip.routeIndex && tripRoute.index !== trip.routeIndex && tripRoute.options && tripRoute.options[trip.routeIndex]) tripRoute = Route.choose(trip.start, to, trip.routeIndex);
        const vias = trip.via || [];
        const followed = vias.length ? Route.viaCached(trip.start, vias, to) : null;
        if (vias.length && !followed) Route.viaGet(trip.start, vias, to).then((r) => { if (r && Trip.get()) drawPanel(); });
        const v = D.VEHICLES.find((x) => x.id === trip.vehicleId) || D.VEHICLES[0];
        const all = D.estimateFaresBetween(trip.start, to, fareOpts({ km: trip.km || 0, kmOut: trip.kmOut }));
        const fare = all.find((f) => f.vehicle.id === v.id) || all[0];
        const liveRoute = Loc.pos ? Route.cached(Loc.pos, to) : null;
        if (Loc.pos && !liveRoute) Route.get(Loc.pos, to).then((r) => { if (r && Trip.get()) drawPanel(); });
        const remaining = Loc.pos ? (liveRoute ? liveRoute.km : D.roadDistanceKm(Loc.pos, to)) : null;
        const total = Math.max(0.1, trip.km || D.roadDistanceKm(trip.start, to));
        const pct = remaining === null ? 0 : Math.min(100, Math.max(0, Math.round((1 - remaining / total) * 100)));
        const arrived = remaining !== null && D.haversineKm(Loc.pos, to) < 0.12 && (Loc.source !== 'gps' || !Loc.pos.accuracy || Loc.pos.accuracy <= 150);

        panel.innerHTML = `
          <div class="card trip-active">
            <span class="pill">${arrived ? 'You have arrived' : 'Trip in progress'}</span>
            <div class="trip-line"><div class="dot a"></div><div><div class="k">Started at</div><div class="v">${esc(D.describePoint(trip.start))}</div><div class="muted small">${startedAt ? `${esc(startedAt)} · ` : ''}marked "Start" on the map</div></div></div>
            <div class="trip-line"><div class="dot b"></div><div><div class="k">Destination${trip.changed ? ' (changed)' : ''}</div><div class="v">${esc(to.name)}</div><div class="muted small">${esc(to.road)}</div></div></div>
            <div class="stat-row">
              <div class="stat"><div class="n">${remaining === null ? '—' : fmtKm(remaining)}</div><div class="l">Remaining</div></div>
              <div class="stat"><div class="n">${remaining === null ? '—' : '~' + (Math.round((remaining / v.speedKph) * 60) + 1) + ' min'}</div><div class="l">Time left</div></div>
              <div class="stat"><div class="n">${fare ? rangeTxt(groupFare(fare).low, groupFare(fare).high) : '—'}</div><div class="l">${esc(v.name)} fare${people() > 1 ? ` · ${people()} people` : ''}</div></div>
            </div>
            <div class="progress"><div style="width:${pct}%"></div></div>
            <div class="muted small">${pct}% of the trip completed · fare computed from where the trip started (${fmtKm(total)}${followed ? ', along the road taken' : ''})${fare ? esc(fareNote(fare)) : ''}</div>
            ${fare && groupLine(fare) ? `<div class="muted small">${groupLine(fare)}</div>` : ''}
            <div class="field" style="margin-top:12px"><label>Vehicle you are riding</label>
              <select id="tripVehicle">${D.VEHICLES.map((x) => `<option value="${x.id}" ${x.id === v.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
            ${routeChips(tripRoute, followed)}
            <div class="field"><label>Changed your mind? Choose a new destination</label>
              <select id="tripTo">${trip.toId === 'custom' ? `<option value="custom" selected>⚑ Pinned location (${esc(to.sub)})</option>` : ''}${destOptions(trip.toId, 'Choose a new destination')}</select>
              <div class="hint">You can also tap a pin on the map, or press ⚑ and tap any spot. The trip keeps going and the fare is recomputed from where it started.</div></div>
            <button class="btn ${arrived ? '' : 'danger'}" id="endTrip">${arrived ? 'Finish trip' : 'End trip'}</button>
          </div>`;
        view.highlight(to.id);
        view.drawLine(trip.start, to, followed);
        $('#tripVehicle').onchange = (e) => { Trip.set({ ...(Trip.get() || trip), vehicleId: e.target.value }); drawPanel(); };
        $$('[data-route]', panel).forEach((b) => (b.onclick = () => {
          const r = Route.choose(trip.start, to, Number(b.dataset.route));
          setTripRoute(r);
          drawPanel();
        }));
        $('#tripTo').onchange = (e) => {
          const picked = e.target.value;
          e.target.value = trip.toId;
          if (picked && picked !== 'custom') askChange(picked, null);
        };
        keepAwake(true);
        if (arrived && !trip.arrivedNotified) { Trip.set({ ...trip, arrivedNotified: true }); toast('You have arrived at your destination'); }
        $('#endTrip').onclick = () => {
          const finish = () => { const rid = (Trip.get() || trip).remoteId; if (SB && rid) SB.sync.tripEnd(rid, arrived).catch(() => {}); Trip.clear(); keepAwake(false); toId = ''; toast(arrived ? 'Trip finished' : 'Trip ended'); drawPanel(); };
          if (arrived) return finish();
          confirmSheet('End this trip?', 'Tracking will stop and the locked fare will be cleared.', 'End trip', finish);
        };
        return;
      }

      const to = toId ? resolveTo(toId, toPoint) : null;
      view.setCustom(to && to.id === 'custom' ? to : null);
      view.setStart(null);
      const hasLoc = !!Loc.pos;
      const route = hasLoc && to ? Route.cached(Loc.pos, to) : null;
      let routing = false;
      if (hasLoc && to && !route) {
        const want = Route.key(Loc.pos, to);
        routing = Route.pending.has(want) || !(Route.failed.has(want) && Date.now() - Route.failed.get(want) < 30000);
        Route.get(Loc.pos, to).then((r) => { if (Loc.pos && to && Route.key(Loc.pos, to) === want && !Trip.get()) drawPanel(); });
      }
      const outside = hasLoc && !D.isInKoronadal(Loc.pos);
      const fares = hasLoc && to ? D.estimateFaresBetween(Loc.pos, to, fareOpts(routeOpts(route))) : [];
      panel.innerHTML = `
        <div class="card">
          <div class="card-title">Plan a trip from where you are</div>
          <div class="field"><label>Starting point</label>
            <div class="origin-row">
              ${hasLoc
                ? (outside
                  ? `<div class="origin-box" style="background:#fff7e6">⚠️ <div>Outside Koronadal City<div class="sub">Approximate position. Tap ✎ on the map to set where you really are.</div></div></div>`
                  : `<div class="origin-box">📍 <div>Your location<div class="sub">${esc(originFromPoint(Loc.pos).sub)}</div></div></div>`)
                : `<div class="origin-box" style="background:#fff7e6">⏳ <div>Waiting for your location<div class="sub">Tap ✎ on the map to set it manually</div></div></div>`}
              <button class="btn sm secondary" id="useDevice" title="Use the device's GPS / location service">Use device location</button>
            </div>
            ${Loc.lastError && Loc.source !== 'gps' ? `<div class="form-error" style="margin:8px 0 0">Device location: ${esc(Loc.lastError)} <button class="link" id="locHelp">How to fix</button></div>` : ''}${Loc.quality() === 'poor' ? `<div class="loc-warn">Your device is only giving a rough position (${Loc.accText()}), so the starting point may be wrong. Turn on precise location, go near a window or outdoors, or tap ✎ on the map to set it yourself. <button class="link" id="locHelp">How to fix</button></div>` : Loc.quality() === 'fair' ? `<div class="loc-note">GPS is still settling (${Loc.accText()}). It gets more exact after a few seconds outdoors.</div>` : ''}
          </div>
          ${passengerChips()}
          ${peopleStepper()}
          <div class="field"><div class="row-between"><label>Destination</label>${toId ? '<button class="link small" id="clearDest">✕ Clear</button>' : ''}</div><select id="to">${toPoint ? `<option value="custom" ${toId === 'custom' ? 'selected' : ''}>⚑ Pinned location (${esc(customDest(toPoint).sub)})</option>` : ''}${destOptions(toId, 'Choose destination, tap a pin, or use ⚑ on the map')}</select>
            <div class="hint">Tip: press ⚑ on the map, then tap any spot to set a destination that is not in the list.</div></div>
          ${to && hasLoc && !fares.length ? `<div class="form-error" style="margin:0 0 12px">${outside ? 'Your location is outside Koronadal City, so no fare can be estimated.' : 'This trip is too far for the vehicles covered by this app.'}</div>` : ''}
          ${to && hasLoc && routing && !route ? `<div class="muted small" style="margin:0 0 10px">⏳ Finding the road route…</div>` : ''}
          ${to && hasLoc ? `<div class="quote">${fares.map((f) => `<div class="quote-row"><div class="vletter" style="background:${f.vehicle.color}">${f.vehicle.letter}</div><div class="n">${esc(f.vehicle.name)}<div class="muted small">${f.km} km ${route ? 'by road' : '(est.)'} · ~${f.minutes} min${f.discounted ? ` · <s>${rangeTxt(f.regularLow, f.regularHigh)}</s>` : ''}${f.ruleText ? `<br>${esc(f.ruleText)}` : ''}</div></div><div class="p">${people() > 1 ? rangeTxt(groupFare(f).low, groupFare(f).high) : rangeTxt(f.low, f.high)}</div></div>${groupLine(f) ? `<div class="muted small group-line">${groupLine(f)}</div>` : ''}`).join('')}</div>${fares.some((f) => f.discounted) ? `<div class="muted small" style="margin:-8px 0 12px">${esc(passengerType().label)} fare applied. Show a valid ID to the driver.</div>` : ''}` : ''}
          ${to && hasLoc && fares.length ? routeChips(route) : ''}
          <button class="btn" id="startTrip">Start trip & track fare</button>
          <button class="btn secondary" id="allRoutes" style="margin-top:8px">View route details</button>
        </div>`;
      view.highlight(toId);
      view.drawLine(hasLoc && to ? Loc.pos : null, to);
      $$('[data-route]', panel).forEach((b) => (b.onclick = () => {
        const r = Route.choose(Loc.pos, to, Number(b.dataset.route));
        if (r) toast(`Route selected · ${fmtKm(r.km)}`);
        drawPanel();
      }));
      $('#to').onchange = (e) => { toId = e.target.value; drawPanel(); };
      bindPassengerChips(drawPanel);
      bindPeopleStepper(drawPanel);
      const clr = $('#clearDest');
      if (clr) clr.onclick = () => { toId = ''; toPoint = null; drawPanel(); toast('Destination cleared'); };
      $('#useDevice').onclick = () => { Loc.useDevice(); };
      const lh = $('#locHelp');
      if (lh) lh.onclick = locationHelpSheet;
      const ready = () => {
        if (!hasLoc) { toast('Waiting for your location. Tap ✎ on the map to set it.'); return false; }
        if (outside) { toast('Set your real location in Koronadal first (✎ on the map).'); return false; }
        if (!to) { toast('Choose a destination first'); $('#to').focus(); return false; }
        if (!fares.length) { toast('No vehicle in this app covers that distance.'); return false; }
        return true;
      };
      $('#startTrip').onclick = () => {
        if (!ready()) return;
        const f = fares[0];
        const tp = toId === 'custom' ? toPoint : null;
        const newTrip = { toId, toPoint: tp, vehicleId: f.vehicle.id, start: { lat: Loc.pos.lat, lng: Loc.pos.lng }, km: route ? route.km : 0, kmOut: route ? route.kmOut : undefined, routeIndex: route ? route.index || 0 : 0, startedAt: Date.now() };
        Trip.set(newTrip);
        Recent.add({ from: 'me', fromPoint: Loc.pos, to: toId, toPoint: tp });
        if (SB) SB.sync.tripStart(newTrip, Session.id(), f, passengerType().id, people()).then((id) => { const t = Trip.get(); if (t && id) Trip.set({ ...t, remoteId: id }); }).catch(() => {});
        toast(f ? `Trip started · ${rangeTxt(groupFare(f).low, groupFare(f).high)}` : 'Trip started');
        drawPanel();
      };
      $('#allRoutes').onclick = () => { if (ready()) go('fares', { fromPoint: Loc.pos, to: toId, ...(toId === 'custom' ? { toPoint } : {}) }); };
    }

    const unsub = Loc.on(() => {
      updateStatus();
      view.showUser(Loc.pos, Loc.source !== 'gps' || !view._centered);
      if (Loc.pos) view._centered = true;
      followTrip();
      drawPanel();
    });
    updateStatus();
    view.showUser(Loc.pos, true);
    if (Loc.pos) view._centered = true;
    drawPanel();

    if (p.changeTo && Trip.get()) {
      state.params = { ...state.params, changeTo: undefined };
      setTimeout(() => { if (state.screen === 'home') askChange(p.changeTo, null); }, 250);
    }

    cleanup = () => { unsub(); view.destroy(); };
  };

  SCREENS.search = (p) => {
    const fromSel = p.from || (Loc.pos && !p.from ? 'me' : '');
    screenEl.innerHTML = `
      <span class="pill">Passenger</span>
      <h1>Where are you going?</h1>
      <p class="lead">Choose a starting point and destination.</p>
      <div class="card">
        <div class="field"><label>Starting point</label><select id="from">${destOptions(fromSel, 'Select pickup point', { includeMe: true })}</select></div>
        <div class="swap-row"><button class="swap-btn" id="swap" title="Swap">⇅</button></div>
        <div class="field"><label>Destination</label><select id="to">${destOptions(p.to || '', 'Select destination')}</select>
          <div class="hint">Rizal Park · Public Market · Bus Terminal · KCC Mall</div></div>
        <button class="btn" id="find">Find available routes</button>
      </div>
      <h2>Popular destinations</h2>
      ${popularTiles()}`;

    $('#swap').addEventListener('click', () => {
      const a = $('#from'), b = $('#to');
      if (a.value === 'me') return toast('Your live location can only be the starting point');
      [a.value, b.value] = [b.value, a.value];
    });
    $('#find').addEventListener('click', () => {
      const from = $('#from').value, to = $('#to').value;
      if (!from || !to) return toast('Please choose both places');
      if (from === to) return toast('Starting point and destination must be different');
      go('fares', { ...fromParams(from), to });
    });
  };

  SCREENS.fares = (p) => {
    const from = resolveFrom(p), to = resolveTo(p.to, p.toPoint, p.toName);
    if (!from || !to) return go('search', {}, { replace: true });
    Recent.add({ ...(p.fromPoint ? { from: 'me', fromPoint: p.fromPoint } : { from: from.id }), to: to.id, ...(p.toPoint ? { toPoint: p.toPoint, toName: p.toName } : {}) });
    const route = Route.cached(from, to);
    if (!route) {
      const snapshot = JSON.stringify(state.params);
      Route.get(from, to).then((r) => { if (r && state.screen === 'fares' && JSON.stringify(state.params) === snapshot) render(); });
    }
    const fares = D.estimateFaresBetween(from, to, fareOpts(routeOpts(route)));
    const km = (route ? route.km : D.roadDistanceKm(from, to)).toFixed(1);

    screenEl.innerHTML = `
      <span class="pill">Estimated fares</span>
      <h1>Available routes</h1>
      <p class="lead">${esc(from.name)}${from.id === 'me' ? ` (${esc(from.sub)})` : ''} → ${esc(to.name)}${to.id === 'custom' ? ` (${esc(to.sub)})` : ''} · ${km} km ${route ? 'by road' : '(estimated)'}</p>

      <div class="card" style="margin-bottom:14px">${passengerChips()}${peopleStepper()}</div>
      ${!fares.length ? `<div class="empty"><div class="big">🛺</div>No vehicle in this app covers this distance (${km} km).<br>Try a closer destination or a different starting point.</div>` : ''}
      ${!route && fares.length ? `<p class="muted small" style="margin:-8px 0 12px">⏳ Finding the road route for a more exact distance…</p>` : ''}
      <div class="list">
        ${fares
          .map(
            (f, i) => `<button class="fare-card" data-go="details" data-params='${JSON.stringify({ ...p, vehicle: f.vehicle.id })}'>
            <div class="head">
              <div class="vletter" style="background:${f.vehicle.color}">${f.vehicle.letter}</div>
              <div><div class="vname">${esc(f.vehicle.name)}</div><div class="vtag">${esc(f.vehicle.tagline)}</div></div>
              ${i === 0 ? '<span class="badge-cheapest">Cheapest</span>' : ''}
            </div>
            <div class="price">${people() > 1 ? rangeTxt(groupFare(f).low, groupFare(f).high) : rangeTxt(f.low, f.high)}${f.discounted && people() === 1 ? ` <span class="muted small" style="font-weight:500"><s>${rangeTxt(f.regularLow, f.regularHigh)}</s></span>` : ''}</div>
            ${groupLine(f) ? `<div class="muted small" style="margin-bottom:6px">${groupLine(f)}</div>` : ''}
            <div class="meta"><span>${people() > 1 ? `Total for ${people()} passengers` : f.discounted ? esc(passengerType().label) + ` fare (${f.offText})` : f.rule ? 'Ordinance fare' : 'Estimated fare'} · ~${f.minutes} min</span><span class="view">View details ›</span></div>
          </button>`
          )
          .join('')}
      </div>
      <p class="muted small center" style="margin-top:16px">Fare ranges are estimates. Confirm with the driver before travelling.</p>`;
    bindPassengerChips(render);
    bindPeopleStepper(render);
  };

  SCREENS.details = (p) => {
    const from = resolveFrom(p), to = resolveTo(p.to, p.toPoint, p.toName);
    if (!from || !to) return go('search', {}, { replace: true });
    const route = Route.cached(from, to);
    if (!route) {
      const snapshot = JSON.stringify(state.params);
      Route.get(from, to).then((r) => { if (r && state.screen === 'details' && JSON.stringify(state.params) === snapshot) render(); });
    }
    const fare = D.estimateFaresBetween(from, to, fareOpts(routeOpts(route))).find((f) => f.vehicle.id === p.vehicle);
    if (!fare) return go('search', {}, { replace: true });
    const v = fare.vehicle;

    screenEl.innerHTML = `
      <h1>${esc(v.name)} route</h1>
      <p class="lead">${esc(v.tagline)}</p>

      <div class="card fare-hero">
        <div class="label">${people() > 1 ? `Estimated total for ${people()} passengers` : 'Estimated fare per passenger'}</div>
        <div class="big">${people() > 1 ? rangeTxt(groupFare(fare).low, groupFare(fare).high) : rangeTxt(fare.low, fare.high)}</div>
        ${groupLine(fare) ? `<div class="muted small" style="margin-bottom:6px">${groupLine(fare)}</div>` : ''}
        <div class="sub">${fare.discounted ? `${esc(passengerType().label)} fare, ${fare.offText} · regular ${rangeTxt(fare.regularLow, fare.regularHigh)}` : 'Regular fare'}${fare.ruleText ? ` · ${esc(fare.ruleText)}` : ''}${fare.special ? ` · Special trip approx. ${D.peso(fare.special)}` : ''}</div>
        <div class="stat-row">
          <div class="stat"><div class="n">${fare.km} km</div><div class="l">${route ? 'Road distance' : 'Est. distance'}</div></div>
          <div class="stat"><div class="n">~${fare.minutes} min</div><div class="l">Travel time</div></div>
          <div class="stat"><div class="n">${D.peso(v.base)}</div><div class="l">Minimum fare</div></div>
        </div>
      </div>

      <h2>Your trip</h2>
      <div class="card">
        <div class="trip-line"><div class="dot a"></div><div><div class="k">Starting point</div><div class="v">${esc(from.name)}</div><div class="muted small">${esc(from.id === 'me' ? from.sub : from.road)}</div></div></div>
        <div class="trip-connector"></div>
        <div class="trip-line"><div class="dot b"></div><div><div class="k">Destination</div><div class="v">${esc(to.name)}</div><div class="muted small">${esc(to.id === 'custom' ? to.sub : to.road)}</div></div></div>
        <div class="muted small" style="margin-top:10px">Route: ${esc(D.describeRoute(from, to))}</div>
      </div>

      <h2>Vehicle information</h2>
      <div class="card">
        <div class="head" style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
          <div class="vletter" style="background:${v.color}">${v.letter}</div><div style="font-weight:700">${esc(v.name)}</div>
        </div>
        <p style="margin:0" class="small">${esc(v.desc)}</p>
      </div>

      <h2>Before you ride</h2>
      <div class="card"><ul class="tips-list">${v.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>

      <div style="margin-top:18px">
        ${from.id === 'me' ? '<button class="btn" id="startHere">Start this trip & track it</button>' : ''}
        <button class="btn ${from.id === 'me' ? 'secondary' : ''}" data-go="search" style="margin-top:8px">Start a new search</button>
        <button class="btn outline" id="saveDest" style="margin-top:8px">${Session.isGuest() ? 'Save destination (account needed)' : 'Save destination'}</button>
      </div>
      <p class="muted small center" style="margin-top:12px">Confirm the current route and fare before departure.</p>`;

    const save = $('#saveDest');
    if (save) save.addEventListener('click', () => savePlaceSheet(to));
    const start = $('#startHere');
    if (start) start.addEventListener('click', () => {
      const begin = () => {
        const newTrip = { toId: to.id, toPoint: to.id === 'custom' ? { lat: to.lat, lng: to.lng } : null, toName: p.toName, vehicleId: v.id, start: { lat: from.lat, lng: from.lng }, km: route ? route.km : 0, startedAt: Date.now() };
        Trip.set(newTrip);
        if (SB) SB.sync.tripStart(newTrip, Session.id(), fare, passengerType().id, people()).then((id) => { const t = Trip.get(); if (t && id) Trip.set({ ...t, remoteId: id }); }).catch(() => {});
        toast('Trip started');
        go('home');
      };
      if (Trip.get()) return confirmSheet('Replace the current trip?', 'A trip is already being tracked. Starting a new one will end it.', 'Start new trip', begin, false);
      begin();
    });
  };

  SCREENS.explore = (p) => {
    let cat = p.cat || 'all';
    let query = '';
    screenEl.innerHTML = `
      <h1>Explore Koronadal</h1>
      <p class="lead" id="exploreLead"></p>
      <div class="search"><span>⌕</span><input id="q" placeholder="Search places, landmarks, barangays" /></div>
      <div class="chips" id="chips"></div>
      <div class="list" id="list"></div>`;

    const chipsEl = $('#chips'), listEl = $('#list');

    function draw() {
      const here = Loc.pos && D.isInKoronadal(Loc.pos) ? Loc.pos : null;
      const lead = $('#exploreLead');
      if (lead) lead.textContent = here
        ? `Places sorted from nearest to you (${Loc.label().split(' · ').slice(1).join(' · ')}). Fares are tricycle estimates.`
        : 'Browse places by category. Set your location in Koronadal on the Home map to see distances and fares.';

      chipsEl.innerHTML = [{ id: 'all', label: 'All', icon: '' }, ...D.CATEGORIES]
        .map((c) => `<button class="chip ${c.id === cat ? 'active' : ''}" data-cat="${c.id}">${c.icon ? c.icon + ' ' : ''}${c.label}</button>`)
        .join('');
      $$('[data-cat]', chipsEl).forEach((b) => (b.onclick = () => { cat = b.dataset.cat; draw(); }));

      const q = query.toLowerCase();
      let items = D.DESTINATIONS.filter((d) => (cat === 'all' || d.cat.includes(cat)) && (!q || d.name.toLowerCase().includes(q) || d.sub.toLowerCase().includes(q)));
      if (here) items = items.slice().sort((a, b) => D.haversineKm(here, a) - D.haversineKm(here, b));

      listEl.innerHTML = items.length
        ? items
            .map((d) => {
              let info = esc(d.sub);
              if (here) {
                const km = D.haversineKm(here, d) * 1.3;
                const f = D.estimateFaresBetween(here, d, fareOpts()).find((x) => x.vehicle.id === 'tricycle');
                info += ` · ${fmtKm(km)} away` + (f ? ` · ${rangeTxt(f.low, f.high)}` : '');
              }
              return `<button class="item" data-id="${d.id}">
              <div class="icon">${d.cat.includes('barangays') ? '⌂' : d.cat.includes('terminals') ? '⇄' : '◈'}</div>
              <div class="body"><div class="title">${esc(d.name)}</div><div class="sub">${info}</div></div>
              <div class="chev">›</div></button>`;
            })
            .join('')
        : `<div class="empty"><div class="big">⌕</div>No places match your search.</div>`;
      $$('[data-id]', listEl).forEach((b) => (b.onclick = () => placeActionsSheet(D.findDestination(b.dataset.id))));
    }
    $('#q').addEventListener('input', (e) => { query = e.target.value; draw(); });
    cleanup = Loc.on(draw);
    draw();
  };

  SCREENS.saved = () => {
    if (Session.isGuest()) {
      screenEl.innerHTML = `
        <h1>Saved places</h1>
        <p class="lead">Keep Home, School / Work and other places one tap away.</p>
        <div class="card">
          <div class="profile-head" style="margin-bottom:12px"><div class="avatar">♡</div>
            <div><div style="font-weight:700">Saved places need an account</div><div class="muted small">So they follow you to any phone.</div></div></div>
          <p class="small muted" style="margin:0 0 12px">Creating one takes a minute. Everything else in the app works without it.</p>
          <button class="btn" data-go="signup">Create account</button>
          <button class="btn secondary" data-go="login" style="margin-top:8px">Log in</button>
        </div>
        <h2>What you can do as a guest</h2>
        <div class="card"><ul class="tips-list">
          <li>See your location and the map of Koronadal</li>
          <li>Choose any destination and get the fare for each vehicle</li>
          <li>View route details and riding tips</li>
          <li>Start a trip and track the remaining distance</li>
          <li>Set your passenger type and group size</li>
        </ul></div>`;
      return;
    }
    const saved = Saved.get();
    const hasLoc = !!Loc.pos && D.isInKoronadal(Loc.pos);
    const fareLine = (pl) => {
      if (!hasLoc) return 'Tap to see the fare from your location';
      const f = D.estimateFaresBetween(Loc.pos, pl, fareOpts()).find((x) => x.vehicle.id === 'tricycle');
      const km = D.haversineKm(Loc.pos, pl) * 1.3;
      return f ? `${fmtKm(km)} away · ${rangeTxt(f.low, f.high)} by tricycle` : `${fmtKm(km)} away`;
    };
    const row = (key, label, icon, pl, hint) => pl
      ? `<div class="item saved-row">
           <button class="row-main" data-open="${key}"><div class="icon">${icon}</div>
             <div class="body"><div class="title">${esc(label)}</div><div class="sub">${esc(pl.name)}</div><div class="sub fare">${esc(fareLine(pl))}</div></div></button>
           <button class="more" data-more="${key}" title="Options">⋯</button>
         </div>`
      : `<button class="item" data-set="${key}"><div class="icon">${icon}</div><div class="body"><div class="title">${esc(label)}</div><div class="sub">${esc(hint)}</div></div><div class="chev">+</div></button>`;

    screenEl.innerHTML = `
      <h1>Saved places</h1>
      <p class="lead">${hasLoc ? 'Tap a place to see the fare from where you are now.' : 'Set your location on the Home map to see fares from where you are.'}</p>
      <div class="list">
        ${row('home', 'Home', '⌂', saved.home, 'Set your home location')}
        ${row('work', 'School / Work', '▣', saved.work, 'Set your school or workplace')}
        ${saved.others.map((pl, i) => row('o' + i, pl.name, '♡', { ...pl, name: pl.destId ? (D.findDestination(pl.destId) || pl).sub : D.describePoint(pl) }, '')).join('')}
      </div>
      <button class="btn secondary" id="addPlace" style="margin-top:14px">+ Add another place</button>
      <p class="muted small center" style="margin-top:12px">Saved places stay on this device so you can check the fare home anytime.</p>`;

    const getPlace = (key) => (key === 'home' || key === 'work') ? saved[key] : saved.others[Number(key.slice(1))];
    const labelOf = (key) => key === 'home' ? 'Home' : key === 'work' ? 'School / Work' : undefined;
    const setPlace = (key, value) => {
      const sv = Saved.get();
      if (key === 'home' || key === 'work') sv[key] = value;
      else if (value === null) sv.others.splice(Number(key.slice(1)), 1);
      else sv.others[Number(key.slice(1))] = value;
      Saved.set(sv);
    };

    $$('[data-set]').forEach((b) => b.addEventListener('click', () => go('pick', { slot: b.dataset.set })));
    $('#addPlace').addEventListener('click', () => go('pick', { slot: 'other' }));
    $$('[data-open]').forEach((b) =>
      b.addEventListener('click', () => {
        const pl = getPlace(b.dataset.open);
        if (!Loc.pos) { toast('Set your location on the Home map first'); return go('home'); }
        go('fares', { fromPoint: Loc.pos, ...placeParams(pl, labelOf(b.dataset.open)) });
      })
    );
    $$('[data-more]').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.more;
        const pl = getPlace(key);
        openSheet(
          `<h3>${esc(pl.name)}</h3>
           <button class="btn" id="m1">Fare from my location</button>
           <button class="btn secondary" id="m2">Change this place</button>
           <button class="btn outline" id="m3">I am here now (set as my location)</button>
           <button class="btn danger" id="m4">Remove</button>`,
          (root) => {
            $('#m1', root).onclick = () => { if (!Loc.pos) { toast('Set your location on the Home map first'); return go('home'); } go('fares', { fromPoint: Loc.pos, ...placeParams(pl, labelOf(key)) }); };
            $('#m2', root).onclick = () => go('pick', { slot: key === 'home' || key === 'work' ? key : 'other', index: key.startsWith('o') ? Number(key.slice(1)) : undefined, name: pl.name });
            $('#m3', root).onclick = () => { Loc.setManual(pl.lat, pl.lng); closeSheet(); toast(`Your location is now ${pl.name}`); render(); };
            $('#m4', root).onclick = () => confirmSheet(`Remove ${pl.name}?`, 'You can add it again later from this screen.', 'Remove', () => { setPlace(key, null); render(); toast('Removed'); });
          }
        );
      })
    );
    cleanup = Loc.on(() => { if (state.screen === 'saved') render(); });
  };

  SCREENS.pick = (p) => {
    if (Session.isGuest()) return go('saved', {}, { replace: true });
    const slot = p.slot || 'other';
    const title = slot === 'home' ? 'Set your Home' : slot === 'work' ? 'Set School / Work' : (p.index !== undefined ? 'Change this place' : 'Add a place');
    let chosen = null;

    screenEl.innerHTML = `
      <h1>${title}</h1>
      <p class="lead">Tap the map where the place is, tap a pin, choose from the list, or use your current location.</p>
      ${slot === 'other' ? `<div class="field"><label>Name of the place</label><input id="pname" placeholder="e.g. Lola's house, Gym, Office" value="${esc(p.name || '')}" /></div>` : ''}
      ${Loc.pos ? `<button class="btn secondary" id="useHere" style="margin-bottom:12px">📍 Use my current location (${esc(D.describePoint(Loc.pos))})</button>` : ''}
      <div class="map-wrap manual" style="height:280px"><div id="map"></div><div class="map-hint">Tap the map or a pin to choose the place</div></div>
      <div class="field" style="margin-top:12px"><label>Or pick from the list</label><select id="pickList">${destOptions('', 'Choose a place')}</select></div>
      <div class="card" id="chosenBox" style="margin-bottom:12px"><div class="muted small">Nothing selected yet</div></div>
      <button class="btn" id="savePick">Save place</button>`;

    const view = createMap($('#map'), {
      pickLabel: 'Choose this place',
      onPick: (id) => { chosen = placeFromDest(D.findDestination(id)); update(); }
    });
    setTimeout(() => view.map.invalidateSize(), 50);
    view.showUser(Loc.pos, !!Loc.pos && D.isInKoronadal(Loc.pos));
    let popupClosedAt = 0;
    view.map.on('popupclose', () => { popupClosedAt = Date.now(); });
    view.map.on('click', (e) => {
      if (Date.now() - popupClosedAt < 300) return;
      chosen = placeFromPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      update();
    });

    function update() {
      const box = $('#chosenBox');
      if (!box) return;
      box.innerHTML = chosen
        ? `<div class="pill">Selected</div><div style="font-weight:700">${esc(chosen.name)}</div><div class="muted small">${esc(D.describePoint(chosen))}</div>`
        : '<div class="muted small">Nothing selected yet</div>';
      view.setCustom(chosen && !chosen.destId ? chosen : null);
      view.highlight(chosen && chosen.destId ? chosen.destId : null);
      if (chosen) view.map.panTo([chosen.lat, chosen.lng]);
    }

    const useHere = $('#useHere');
    if (useHere) useHere.addEventListener('click', () => { chosen = placeFromPoint(Loc.pos); update(); toast('Using your current location'); });
    $('#pickList').addEventListener('change', (e) => { if (e.target.value) { chosen = placeFromDest(D.findDestination(e.target.value)); update(); } });
    $('#savePick').addEventListener('click', () => {
      if (!chosen) return toast('Choose a place first');
      const nameEl = $('#pname');
      const custom = nameEl ? nameEl.value.trim() : '';
      const pl = { ...chosen, name: custom || chosen.name };
      const sv = Saved.get();
      if (slot === 'home' || slot === 'work') sv[slot] = pl;
      else if (p.index !== undefined) sv.others[p.index] = pl;
      else sv.others.push(pl);
      Saved.set(sv);
      toast('Place saved');
      go('saved');
    });

    cleanup = () => view.destroy();
  };

  SCREENS.profile = () => {
    const u = Session.user();
    const row = (title, sub, go_) => `<button class="item" data-go="${go_}"><div class="body"><div class="title">${title}</div><div class="sub">${sub}</div></div><div class="chev">›</div></button>`;
    screenEl.innerHTML = `
      <h1>${u.guest ? 'Guest' : 'My profile'}</h1>
      ${u.guest ? `
      <div class="card">
        <div class="profile-head" style="margin-bottom:12px"><div class="avatar">G</div>
          <div><div style="font-weight:700">Using Koronadal Ride as a guest</div><div class="muted small">All features work without an account.</div></div></div>
        <p class="small muted" style="margin:0 0 12px">Fares, routes and trip tracking work as a guest. Create a free account to save Home, School / Work and other places.</p>
        <button class="btn" data-go="signup">Create account</button>
        <button class="btn secondary" data-go="login" style="margin-top:8px">Log in</button>
      </div>` : `
      <div class="card profile-head">
        <div class="avatar">${esc(u.name.charAt(0).toUpperCase())}</div>
        <div><div style="font-weight:700">${esc(u.name)}</div><div class="muted small">${esc(u.email)}</div><span class="pill blue" style="margin:6px 0 0">Passenger account</span></div>
      </div>`}
      <div class="section-label">${u.guest ? 'Preferences' : 'Account'}</div>
      <div class="list">
        ${u.guest ? '' : row('Personal information', 'Update your name and password', 'personal')}
        ${row('Saved places', 'Manage favorite destinations', 'saved')}
        ${row('Recent searches', 'Review previous route searches', 'recent')}
        <div class="item toggle"><div class="body"><div class="title">Passenger type</div><div class="sub">${esc(passengerType().label)}</div></div>
          <select id="paxSelect" class="btn sm secondary" style="width:auto">${passengerTypes().map((t) => `<option value="${t.id}" ${t.id === passengerType().id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></div>
        <div class="item toggle"><div class="body"><div class="title">Location</div><div class="sub">${esc(Loc.label())}</div></div>
          <button class="btn sm secondary" id="relocate">Use device location</button></div>
        ${row('Tricycle fare ordinance', 'Official fares, the downtown zone and your rights', 'ordinance')}
        ${row('About & how fares work', 'Fare model, limitations, app version', 'about')}
      </div>
      ${u.guest ? '' : '<button class="btn danger" id="logout" style="margin-top:20px">Log out</button>'}`;

    $('#relocate').addEventListener('click', () => { Loc.useDevice(); toast('Locating…'); });
    $('#paxSelect').addEventListener('change', (e) => { Settings.set({ passenger: e.target.value }); toast(`${passengerTypes().find((t) => t.id === e.target.value).label} fare selected`); render(); });
    const lo = $('#logout');
    if (lo) lo.addEventListener('click', () => confirmSheet('Log out?', 'You will continue as a guest. Your account data stays on this device for next time.', 'Log out', async () => { if (SB && SB.client) await SB.auth.signOut().catch(() => {}); Session.set(null); go('home', {}, { replace: true }); toast('Logged out. You are now a guest.'); }));
  };

  SCREENS.personal = () => {
    const u = Session.user();
    if (u.guest) return go('signup', {}, { replace: true });
    screenEl.innerHTML = `
      <h1>Personal information</h1>
      <p class="lead">Update your name or password.</p>
      <div class="card">
        <form id="f" novalidate>
          <div class="field"><label>Full name</label><input name="name" value="${esc(u.name)}" /></div>
          <div class="field"><label>Email address</label><input value="${esc(u.email)}" disabled /><div class="hint">Email cannot be changed.</div></div>
          <div class="field"><label>New password (optional)</label><input name="password" type="password" placeholder="Leave blank to keep current password" /></div>
          <div class="form-error" id="err" hidden></div>
          <button class="btn" type="submit">Save changes</button>
        </form>
      </div>`;
    $('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const name = f.get('name').trim(), pw = f.get('password');
      const err = $('#err');
      if (name.length < 2) { err.textContent = 'Please enter your full name.'; err.hidden = false; return; }
      if (pw && pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.hidden = false; return; }
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      (async () => {
        await SB.auth.updateName(u.id, name);
        if (pw) { const { error } = await SB.auth.updatePassword(pw); if (error) throw error; }
        account = { ...account, name };
        toast('Profile updated');
        back();
      })().catch((ex) => { err.textContent = ex.message || 'Could not save changes.'; err.hidden = false; btn.disabled = false; });
    });
  };

  SCREENS.recent = () => {
    const list = Recent.get();
    screenEl.innerHTML = `
      <div class="row-between"><h1>Recent searches</h1>${list.length ? '<button class="link" id="clear">Clear</button>' : ''}</div>
      <p class="lead">Tap a trip to see its fares again.</p>
      ${list.length ? `<div class="list">${list.map(recentItem).join('')}</div>` : `<div class="empty"><div class="big">↻</div>No searches yet. Find a route from the Home screen.</div>`}`;
    const c = $('#clear');
    if (c) c.addEventListener('click', () => confirmSheet('Clear recent searches?', 'Your saved places are not affected.', 'Clear', () => { Recent.clear(); render(); toast('Cleared'); }));
  };

  const ORDINANCE_FIXED = [
    ['City Mall, BDO (Morales)', 15],
    ['Iglesia Ni Cristo, YBL, Brigada FM', 15],
    ['New Leganes, Bagacay and Provincial Jail', 17],
    ['Bagong Sikat, Marville Homes, Agreville, MSST, Depita Subdivision, Doña Lourdes Subdivision', 17],
    ['Triniville Subdivision, Purok Reyes Highway and Crossing Sueno Village to Bridge, Paraiso Verde / Cinco Ninas', 17],
    ['DXKR, Green Valley, IBED, Hall of Justice and Depita Subdivision', 17],
    ['Purok Tuburan, Purok Nursery and Purok Hillside (Brgy. Sta. Cruz)', 17],
    ['Agan Homes, Roamceville, Agan East, San Antonio I & II, Agreville Phase III and Hernandez Farm', 19],
    ['Sueno Subdivision, Guanzon Subdivision, Purok Reyes and Barangay Morales Proper, EMR Center', 19],
    ['Gaisano and Crossing Diaz, Integrated Public Transport Terminal', 19],
    ['Crossing Barrio Dos and Purok Malipayon (Brgy. Sto. Niño)', 19],
    ['Purok Siodina and Purok Tambling', 19],
    ['Kings College Campus, Viajera', 21],
    ['SOCOTECO-I, KorBel, DXKI, Regency College and Southwind Subdivision', 23],
    ['New City Hall, Santos Subdivision, Villegas Subdivision, Purok Silangan and Allah Valley Hospital', 23],
    ['Agan North and Lauban Subdivision', 25],
    ['Bombo Radyo, BIR, NIA, Purok Tony Ko, Crossing Guadalupe, Crossing Megaland, Crossing Camella and Crossing Bo. 6', 25],
    ['Megaland Subdivision', 27],
    ['The Farm', 29],
    ['Regional Center', 31]
  ];
  SCREENS.ordinance = () => {
    const tri = D.VEHICLES.find((v) => v.id === 'tricycle') || { base: 15, perKm: 2, baseKm: 2 };
    const level = Math.max(0, Math.min(3, Number(D.RULES.fuelLevel) || 0));
    const types = passengerTypes();
    const zoneFare = (t) => Math.max(0, tri.base - (t.amount || 0)) + level * (t.fuelAdd || 0);
    screenEl.innerHTML = `
      <h1>Tricycle fare ordinance</h1>
      <p class="lead">City Ordinance No. 18, Series of 2026: the official fare rules for tricycles-for-hire in the City of Koronadal, as used by this app.</p>
      <img src="./ordinance-18-2026.jpg" alt="Ordinance No. 18, Series of 2026, City of Koronadal: an ordinance prescribing the provisional rates of fare for tricycles-for-hire" width="1200" height="1006" style="display:block;width:100%;height:auto;border-radius:16px;margin:0 0 10px" />
      <a class="btn secondary" href="https://www.facebook.com/share/p/1A2rVUywcE/" target="_blank" rel="noopener" style="display:flex;text-decoration:none;box-sizing:border-box;text-align:center;margin:0 0 14px">View the official post on Facebook</a>
      <div class="card">
        <div class="card-title">Downtown Base-Fare Zone</div>
        <p class="small" style="margin:0 0 10px">Inside this zone the tricycle fare is the same no matter how far you travel. The zone is the dashed outline on the map.</p>
        <div class="map-wrap" style="height:230px;margin-bottom:0"><div id="map"></div></div>
      </div>
      <div class="card">
        <div class="card-title">Fare inside the zone${level ? ' (with gasoline adjustment)' : ''}</div>
        <table class="fare-table">${types.map((t) => `<tr><td>${esc(t.label)}</td><td>${D.peso(zoneFare(t))}</td></tr>`).join('')}</table>
        <p class="small muted" style="margin:10px 0 0">Per passenger. Students, senior citizens and PWDs must show a valid ID.</p>
      </div>
      <div class="card">
        <div class="card-title">Going outside the zone</div>
        <ul class="tips-list">
          <li><strong>From the zone to a place outside it, or back:</strong> the zone fare plus ${D.peso(tri.perKm)} for every kilometre, or part of a kilometre, travelled outside the zone.</li>
          <li><strong>Both pick-up and drop-off outside the zone:</strong> ${D.peso(tri.base)} for the first ${tri.baseKm} km, then ${D.peso(tri.perKm)} for every kilometre or part of it.</li>
          <li><strong>Barangay-bound tricycles:</strong> fares approved by the barangay are followed.</li>
        </ul>
      </div>
      <div class="card">
        <div class="card-title">Fixed fares from the zone</div>
        <p class="small muted" style="margin:0 0 8px">Regular fare per passenger. High school and college students, senior citizens and PWDs pay ₱3 less.</p>
        <table class="fare-table">${ORDINANCE_FIXED.map(([place, fare]) => `<tr><td>${esc(place)}</td><td>${D.peso(fare)}</td></tr>`).join('')}</table>
      </div>
      <div class="card">
        <div class="card-title">Gasoline price adjustment</div>
        <p class="small" style="margin:0 0 8px">Fares rise automatically with the average price of regular gasoline in the city.</p>
        <table class="fare-table">
          <tr><td>₱71 to ₱100 per litre</td><td>+₱5</td></tr>
          <tr><td>₱101 to ₱130 per litre</td><td>+₱10</td></tr>
          <tr><td>₱131 to ₱160 per litre</td><td>+₱15</td></tr>
        </table>
        <p class="small muted" style="margin:10px 0 0">The increase is smaller for students, senior citizens and PWDs. In effect now: <strong>${esc((D.FUEL_LEVELS[level] || D.FUEL_LEVELS[0]).label)}</strong>.</p>
      </div>
      <div class="card">
        <div class="card-title">Your rights as a passenger</div>
        <ul class="tips-list">
          <li>The zone map and fare matrix must be posted inside every tricycle-for-hire.</li>
          <li>Overcharging is fined <strong>₱1,000</strong> for every offense.</li>
          <li>A tricycle with no fare matrix posted is fined ₱500.</li>
        </ul>
      </div>
      <p class="small muted">Source: Ordinance No. 18, Series of 2026, "An Ordinance Prescribing the Provisional Rates of Fare for Tricycles-for-Hire within the Territorial Jurisdiction of the City of Koronadal, Providing the Guidelines for Its Implementation and the Penalties for Violation Thereof", City Government of Koronadal. This page is a summary; the ordinance itself is the authority.</p>`;
    const view = createMap($('#map'), { onPick: () => {}, pickLabel: 'Close', scrollWheelZoom: false, showZone: true });
    setTimeout(() => {
      view.map.invalidateSize();
      if (D.RULES.zone && D.RULES.zone.length >= 3) view.map.fitBounds(L.latLngBounds(D.RULES.zone), { padding: [16, 16] });
    }, 60);
    cleanup = () => view.destroy();
  };

  SCREENS.about = () => {
    screenEl.innerHTML = `
      <h1>About Koronadal Ride</h1>
      <p class="lead">Vehicle Transportation Route & Fare Finder System for the City of Koronadal, South Cotabato.</p>
      <div class="card">
        <div class="card-title">How fares are estimated</div>
        <p class="small" style="margin:0 0 8px">The app measures the road distance from your location (or chosen starting point) to the destination using OpenStreetMap routing (or an estimate when offline), then applies each vehicle's fare rule:</p>
        <ul class="tips-list">${D.VEHICLES.map((x) => (x.id === 'tricycle'
          ? `<li><strong>${esc(x.name)}</strong>: the city fare ordinance. ${D.peso(x.base)} anywhere inside the Downtown Base-Fare Zone, plus ${D.peso(x.perKm)} for every kilometre or part of it outside the zone. This is an exact fare, not a range.</li>`
          : `<li><strong>${esc(x.name)}</strong>: ${D.peso(x.base)} minimum for the first ${x.baseKm} km, then about ${D.peso(x.perKm)} per extra km. Shown as a range.</li>`)).join('')}</ul>
        <p class="small muted" style="margin:10px 0 0">Habal-habal and multicab are not covered by the tricycle ordinance, so their fares are estimates; the upper value allows for traffic, night trips and driver discretion, and students, senior citizens and PWDs get 20% off.</p>
        <button class="btn secondary" data-go="ordinance" style="margin-top:12px">Read the tricycle fare ordinance</button>
      </div>
      <div class="card">
        <div class="card-title">Live location</div>
        <p class="small" style="margin:0">Your position comes from the device's location service (GPS or Wi-Fi). If that is unavailable, the app uses an approximate location from your internet connection, or a point you set on the map. When you start a trip, the fare is fixed from your starting point and the app tracks the remaining distance to your destination.</p>
      </div>
      <div class="card">
        <div class="card-title">Limitations</div>
        <p class="small" style="margin:0">Tricycle fares come from the city ordinance, but the zone boundary and distances in the app are computed from the map and can be slightly off near the edge of the zone. Other fares are estimates and may differ from what drivers charge. The app covers Koronadal City only and does not book rides or contact drivers. The map and road routing require an internet connection.</p>
      </div>
      <div class="card">
        <div class="card-title">Version</div>
        <p class="small muted" style="margin:0">Koronadal Ride 1.2.0 · Progressive Web App</p>
      </div>`;
  };

  // Boot
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch((err) => console.warn('Service worker not registered:', err));
  }
  updateNetBanner();
  state.screen = 'home';
  if (SB) SB.applyCache(D);
  render();
  (async () => {
    if (!SB || !SB.client) return;
    try {
      const sbUser = await SB.auth.current();
      if (sbUser && (await startSession(sbUser))) { await pullAccountData(); render(); }
    } catch (e) { console.warn('session:', e.message); }
    const res = await SB.loadReferenceData(D);
    if (res.changed) render();
    SB.auth.onChange(async (event, sbUser) => {
      if (event === 'SIGNED_IN' && sbUser && !account) { if (await startSession(sbUser)) { await pullAccountData(); render(); } }
      if (event === 'SIGNED_OUT' && account) { Session.set(null); render(); }
    });
  })();
})();
