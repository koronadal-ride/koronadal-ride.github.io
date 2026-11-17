// Admin
(() => {
  const SB = window.KR_SB;
  const sb = SB && SB.client;
  const D = window.KR_DATA;
  const app = document.getElementById('app');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peso = (n) => (n === null || n === undefined ? '—' : '₱' + Number(n).toLocaleString('en-PH'));
  const when = (iso) => (iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2500);
  }
  const fail = (e) => { console.error(e); toast(e.message || 'Something went wrong'); };

  let me = null;       // { id, email, name }
  let section = 'overview';
  let cleanup = null;

  // Login
  function renderLogin(msg) {
    app.innerHTML = `
      <div class="login card">
        <h1>Koronadal Ride Admin</h1>
        <p class="lead">Sign in with an administrator account.</p>
        <form id="f">
          <div class="field"><label>Email</label><input name="email" type="email" required /></div>
          <div class="field"><label>Password</label><input name="password" type="password" required /></div>
          <div class="form-error" id="err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</div>
          <button class="btn" type="submit" style="width:100%">Sign in</button>
        </form>
        <p class="muted small" style="margin-top:14px">Passenger app: <a href="./">open</a></p>
      </div>`;
    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const btn = e.target.querySelector('button'); btn.disabled = true;
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email: String(f.get('email')).trim().toLowerCase(), password: f.get('password') });
        if (error) throw new Error('Incorrect email or password.');
        await boot(data.user);
      } catch (ex) { renderLogin(ex.message); }
    });
  }

  async function boot(user) {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!profile || profile.role !== 'admin') {
      await sb.auth.signOut();
      return renderLogin('This account is not an administrator. Ask an existing admin to grant access.');
    }
    me = { id: user.id, email: user.email, name: profile.name || user.email };
    renderShell();
  }

  // Shell
  const NAV = [
    ['overview', 'Overview'], ['users', 'Users'], ['vehicles', 'Vehicles & fares'],
    ['discounts', 'Discounts'], ['places', 'Places'], ['trips', 'Trip log']
  ];
  function renderShell() {
    app.innerHTML = `
      <div class="layout">
        <aside class="sidebar">
          <div class="brand-row">
            <div class="brand">Koronadal Ride<small>Administrator dashboard</small></div>
            <button id="logout" class="signout">Sign out</button>
          </div>
          <nav class="nav">
            ${NAV.map(([id, label]) => `<button data-nav="${id}" class="${id === section ? 'active' : ''}">${label}</button>`).join('')}
          </nav>
          <div class="spacer"></div>
          <div class="who">${esc(me.name)}<br>${esc(me.email)}</div>
        </aside>
        <main class="main" id="main"></main>
      </div>`;
    $$('[data-nav]').forEach((b) => b.addEventListener('click', () => { section = b.dataset.nav; renderShell(); }));
    const act = $('.nav .active');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
    $('#logout').addEventListener('click', async () => { await sb.auth.signOut(); me = null; renderLogin(); });
    if (cleanup) { cleanup(); cleanup = null; }
    SECTIONS[section]($('#main')).catch(fail);
  }

  const SECTIONS = {};

  // Overview
  SECTIONS.overview = async (main) => {
    main.innerHTML = '<h1>Overview</h1><p class="lead">Loading…</p>';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [users, trips, tripsToday, recent] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('trips').select('id', { count: 'exact', head: true }),
      sb.from('trips').select('id', { count: 'exact', head: true }).gte('started_at', today.toISOString()),
      sb.from('trips').select('to_id,to_name,vehicle_id').order('started_at', { ascending: false }).limit(500)
    ]);
    const dest = {};
    (recent.data || []).forEach((t) => { const k = t.to_name || (D.findDestination(t.to_id) || {}).name || t.to_id; dest[k] = (dest[k] || 0) + 1; });
    const top = Object.entries(dest).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const veh = {};
    (recent.data || []).forEach((t) => { veh[t.vehicle_id] = (veh[t.vehicle_id] || 0) + 1; });
    main.innerHTML = `
      <h1>Overview</h1><p class="lead">What passengers are doing with Koronadal Ride.</p>
      <div class="grid">
        <div class="card stat"><div class="n">${users.count ?? 0}</div><div class="l">Registered users</div></div>
        <div class="card stat"><div class="n">${trips.count ?? 0}</div><div class="l">Trips tracked (all time)</div></div>
        <div class="card stat"><div class="n">${tripsToday.count ?? 0}</div><div class="l">Trips today</div></div>
        <div class="card stat"><div class="n">${D.DESTINATIONS.length}</div><div class="l">Places in the app</div></div>
      </div>
      <div class="grid" style="margin-top:14px;grid-template-columns:1fr 1fr">
        <div class="card"><h2 style="margin-top:0">Most searched destinations</h2>
          ${top.length ? `<table>${top.map(([k, n]) => `<tr><td>${esc(k)}</td><td style="text-align:right;font-weight:700">${n}</td></tr>`).join('')}</table>` : '<p class="muted">No trips yet.</p>'}</div>
        <div class="card"><h2 style="margin-top:0">Vehicles chosen</h2>
          ${Object.keys(veh).length ? `<table>${Object.entries(veh).map(([k, n]) => `<tr><td>${esc((D.VEHICLES.find((v) => v.id === k) || {}).name || k)}</td><td style="text-align:right;font-weight:700">${n}</td></tr>`).join('')}</table>` : '<p class="muted">No trips yet.</p>'}</div>
      </div>`;
  };

  // Users
  SECTIONS.users = async (main) => {
    main.innerHTML = '<h1>Users</h1><p class="lead">Loading…</p>';
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    main.innerHTML = `
      <h1>Users</h1><p class="lead">Registered passenger accounts. Guests are not listed because they have no account.</p>
      <div class="card">
        <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
        <tbody>${data.map((u) => `<tr>
          <td>${esc(u.name || '—')}</td><td>${esc(u.email)}</td>
          <td><span class="pill ${u.role === 'admin' ? 'blue' : 'grey'}">${u.role}</span></td>
          <td>${u.blocked ? '<span class="pill red">Blocked</span>' : '<span class="pill green">Active</span>'}</td>
          <td class="small muted">${when(u.created_at)}</td>
          <td class="row" style="justify-content:flex-end">
            ${u.id === me.id ? '<span class="muted small">(you)</span>' : `
            <button class="btn sm outline" data-role="${u.id}" data-to="${u.role === 'admin' ? 'passenger' : 'admin'}">${u.role === 'admin' ? 'Make passenger' : 'Make admin'}</button>
            <button class="btn sm ${u.blocked ? 'secondary' : 'danger'}" data-block="${u.id}" data-to="${u.blocked ? 'false' : 'true'}">${u.blocked ? 'Unblock' : 'Block'}</button>`}
          </td></tr>`).join('')}</tbody></table>
        ${data.length ? '' : '<p class="muted">No registered users yet.</p>'}
      </div>`;
    $$('[data-role]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`Change this user's role to ${b.dataset.to}?`)) return;
      const { error: e2 } = await sb.from('profiles').update({ role: b.dataset.to }).eq('id', b.dataset.role);
      if (e2) return fail(e2); toast('Role updated'); SECTIONS.users(main);
    }));
    $$('[data-block]').forEach((b) => b.addEventListener('click', async () => {
      const blocking = b.dataset.to === 'true';
      if (!confirm(blocking ? 'Block this user? They will be signed out and cannot log in.' : 'Unblock this user?')) return;
      const { error: e2 } = await sb.from('profiles').update({ blocked: blocking }).eq('id', b.dataset.block);
      if (e2) return fail(e2); toast(blocking ? 'User blocked' : 'User unblocked'); SECTIONS.users(main);
    }));
  };

  // Vehicles & fares
  SECTIONS.vehicles = async (main) => {
    main.innerHTML = '<h1>Vehicles & fares</h1><p class="lead">Loading…</p>';
    const [{ data: vehicles, error }, { data: history }] = await Promise.all([
      sb.from('vehicles').select('*').order('base'),
      sb.from('fare_history').select('*').order('changed_at', { ascending: false }).limit(30)
    ]);
    if (error) throw error;
    const num = (name, v, step = '0.01') => `<input class="num" type="number" step="${step}" name="${name}" value="${v}" />`;
    main.innerHTML = `
      <h1>Vehicles & fares</h1><p class="lead">Edit a row and press Save. Every phone gets the new rates the next time the app opens.</p>
      <div class="card" style="overflow:auto">
        <table><thead><tr><th>Vehicle</th><th>Minimum fare (₱)</th><th>Covers (km)</th><th>Per extra km (₱)</th><th>Range width (₱)</th><th>Active</th><th></th></tr></thead>
        <tbody>${vehicles.map((v) => `<tr data-id="${v.id}">
          <td><strong>${esc(v.name)}</strong><br><span class="muted small">${esc(v.tagline)}</span></td>
          <td>${num('base', v.base)}</td><td>${num('base_km', v.base_km, '0.1')}</td><td>${num('per_km', v.per_km)}</td><td>${num('spread', v.spread)}</td>
          <td><input type="checkbox" name="active" ${v.active ? 'checked' : ''} /></td>
          <td><button class="btn sm" data-save="${v.id}">Save</button></td></tr>`).join('')}</tbody></table>
      </div>
      <h2>How the fare is computed</h2>
      <div class="card small">Fare range per passenger = <strong>minimum fare</strong> for the first <strong>covered km</strong>, plus <strong>per extra km</strong> for the distance beyond that. The upper value adds the <strong>range width</strong> and rounds up to ₱5. Discounted passenger types reduce both values by the percentage set under Discounts.</div>
      <h2>Fare change history</h2>
      <div class="card">${history && history.length ? `<table><thead><tr><th>When</th><th>Vehicle</th><th>Minimum</th><th>Covers</th><th>Per km</th><th>Range</th></tr></thead><tbody>
        ${history.map((h) => `<tr><td class="small muted">${when(h.changed_at)}</td><td>${esc((vehicles.find((v) => v.id === h.vehicle_id) || {}).name || h.vehicle_id)}</td><td>${peso(h.base)}</td><td>${h.base_km} km</td><td>${peso(h.per_km)}</td><td>+${peso(h.spread)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No changes recorded yet.</p>'}</div>`;
    $$('[data-save]').forEach((b) => b.addEventListener('click', async () => {
      const tr = b.closest('tr');
      const val = (n) => Number($(`[name=${n}]`, tr).value);
      const patch = { base: val('base'), base_km: val('base_km'), per_km: val('per_km'), spread: val('spread'), active: $('[name=active]', tr).checked };
      if ([patch.base, patch.base_km, patch.per_km, patch.spread].some((x) => !(x >= 0))) return toast('Please enter valid numbers');
      b.disabled = true;
      const { error: e2 } = await sb.from('vehicles').update(patch).eq('id', b.dataset.save);
      b.disabled = false;
      if (e2) return fail(e2); toast('Fare saved'); SECTIONS.vehicles(main);
    }));
  };

  // Discounts
  SECTIONS.discounts = async (main) => {
    main.innerHTML = '<h1>Discounts</h1><p class="lead">Loading…</p>';
    const { data, error } = await sb.from('discount_rules').select('*').order('sort_order');
    if (error) throw error;
    main.innerHTML = `
      <h1>Discounts</h1><p class="lead">Passenger types shown in the app and the percentage taken off the regular fare.</p>
      <div class="card">
        <table><thead><tr><th>ID</th><th>Label shown in app</th><th>Discount %</th><th>Active</th><th></th></tr></thead>
        <tbody>${data.map((r) => `<tr data-id="${r.id}">
          <td class="muted">${esc(r.id)}</td>
          <td><input name="label" value="${esc(r.label)}" /></td>
          <td><input class="num" type="number" step="1" min="0" max="100" name="percent" value="${r.percent}" ${r.id === 'regular' ? 'disabled' : ''} /></td>
          <td><input type="checkbox" name="active" ${r.active ? 'checked' : ''} ${r.id === 'regular' ? 'disabled' : ''} /></td>
          <td><button class="btn sm" data-save="${r.id}">Save</button></td></tr>`).join('')}</tbody></table>
        <p class="muted small" style="margin:12px 0 0">The 20% discount for students, senior citizens and persons with disability is set by law; change it here only if the regulation changes.</p>
      </div>`;
    $$('[data-save]').forEach((b) => b.addEventListener('click', async () => {
      const tr = b.closest('tr');
      const patch = { label: $('[name=label]', tr).value.trim(), percent: Number($('[name=percent]', tr).value), active: $('[name=active]', tr).checked };
      if (!patch.label || !(patch.percent >= 0 && patch.percent <= 100)) return toast('Please enter a label and a percentage from 0 to 100');
      const { error: e2 } = await sb.from('discount_rules').update(patch).eq('id', b.dataset.save);
      if (e2) return fail(e2); toast('Discount saved'); SECTIONS.discounts(main);
    }));
  };

  // Places
  const CATS = ['popular', 'landmarks', 'terminals', 'malls', 'schools', 'hospitals', 'barangays'];
  const PAGE_SIZE = 10;
  let placesPage = 1;
  SECTIONS.places = async (main) => {
    main.innerHTML = '<h1>Places</h1><p class="lead">Loading…</p>';
    const { data, error } = await sb.from('places').select('*').order('name');
    if (error) throw error;
    let query = '';
    main.innerHTML = `
      <h1>Places</h1><p class="lead">Destinations passengers can choose. Tap the map to set a new place's position.</p>
      <div class="row" style="margin-bottom:14px"><input class="search" id="q" placeholder="Search places" /><span class="muted small">${data.length} places</span><span style="flex:1"></span><button class="btn" id="add">+ Add place</button></div>
      <div id="editor"></div>
      <div class="card" style="overflow:auto"><table><thead><tr><th>Name</th><th>Description</th><th>Categories</th><th>Road</th><th>Coordinates</th><th>Active</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
      <div class="pager" id="pager"></div>`;
    const rows = $('#rows');
    const draw = () => {
      const q = query.toLowerCase();
      const found = data.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sub || '').toLowerCase().includes(q));
      const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
      placesPage = Math.min(Math.max(1, placesPage), pages);
      const first = (placesPage - 1) * PAGE_SIZE;
      const shown = found.slice(first, first + PAGE_SIZE);
      const pager = $('#pager');
      pager.innerHTML = `<span class="muted small">${found.length ? `Showing ${first + 1}–${first + shown.length} of ${found.length}` : 'No places match your search'}</span><span style="flex:1"></span>`
        + (pages > 1
          ? `<button class="btn sm outline" data-page="${placesPage - 1}" ${placesPage === 1 ? 'disabled' : ''}>‹ Prev</button>`
            + Array.from({ length: pages }, (_, i) => `<button class="btn sm ${i + 1 === placesPage ? '' : 'outline'}" data-page="${i + 1}">${i + 1}</button>`).join('')
            + `<button class="btn sm outline" data-page="${placesPage + 1}" ${placesPage === pages ? 'disabled' : ''}>Next ›</button>`
          : '');
      $$('[data-page]', pager).forEach((b) => b.addEventListener('click', () => { placesPage = Number(b.dataset.page); draw(); }));
      rows.innerHTML = shown.map((p) => `<tr>
        <td><strong>${esc(p.name)}</strong></td><td>${esc(p.sub)}</td><td class="small">${(p.cat || []).join(', ')}</td><td class="small">${esc(p.road)}</td>
        <td class="small muted">${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}</td>
        <td>${p.active ? '<span class="pill green">Yes</span>' : '<span class="pill grey">Hidden</span>'}</td>
        <td class="row" style="justify-content:flex-end"><button class="btn sm outline" data-edit="${p.id}">Edit</button><button class="btn sm danger" data-del="${p.id}">Delete</button></td></tr>`).join('');
      $$('[data-edit]', rows).forEach((b) => b.addEventListener('click', () => editor(data.find((p) => p.id === b.dataset.edit))));
      $$('[data-del]', rows).forEach((b) => b.addEventListener('click', async () => {
        const p = data.find((x) => x.id === b.dataset.del);
        if (!confirm(`Delete "${p.name}"? Passengers will no longer see it.`)) return;
        const { error: e2 } = await sb.from('places').delete().eq('id', p.id);
        if (e2) return fail(e2); toast('Place deleted'); SECTIONS.places(main);
      }));
    };
    $('#q').addEventListener('input', (e) => { query = e.target.value; placesPage = 1; draw(); });
    $('#add').addEventListener('click', () => editor(null));

    let map = null;
    function editor(p) {
      const isNew = !p;
      p = p || { id: '', name: '', sub: '', cat: [], lat: D.KORONADAL.center.lat, lng: D.KORONADAL.center.lng, road: '', active: true };
      $('#editor').innerHTML = `<div class="card" style="margin-bottom:14px">
        <h2 style="margin-top:0">${isNew ? 'Add a place' : 'Edit place'}</h2>
        <div class="grid" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>Name</label><input id="pName" value="${esc(p.name)}" /></div>
          <div class="field"><label>Short description (e.g. Shopping, School)</label><input id="pSub" value="${esc(p.sub)}" /></div>
          <div class="field"><label>Road / street</label><input id="pRoad" value="${esc(p.road)}" /></div>
          <div class="field"><label>ID (letters, numbers, dashes)</label><input id="pId" value="${esc(p.id)}" ${isNew ? '' : 'disabled'} placeholder="e.g. new-mall" /></div>
        </div>
        <div class="field"><label>Categories</label><div class="row">${CATS.map((c) => `<label class="small"><input type="checkbox" value="${c}" ${(p.cat || []).includes(c) ? 'checked' : ''} class="cat" /> ${c}</label>`).join('')}</div></div>
        <div class="field"><label>Position: tap the map, or type coordinates</label>
          <div class="row"><input id="pLat" class="num" type="number" step="0.0001" value="${p.lat}" style="width:130px" /><input id="pLng" class="num" type="number" step="0.0001" value="${p.lng}" style="width:130px" /><label class="small"><input type="checkbox" id="pActive" ${p.active ? 'checked' : ''} /> Visible to passengers</label></div>
          <div id="pickMap"></div></div>
        <div class="row"><button class="btn" id="pSave">${isNew ? 'Add place' : 'Save changes'}</button><button class="btn outline" id="pCancel">Cancel</button></div></div>`;
      if (map) { map.remove(); map = null; }
      map = L.map('pickMap').setView([p.lat, p.lng], isNew ? 14 : 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      data.forEach((o) => { if (o.id !== p.id) L.marker([o.lat, o.lng], { icon: L.divIcon({ className: 'pin', iconSize: [12, 12] }), title: o.name }).addTo(map); });
      const marker = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'pin selected', iconSize: [18, 18] }), draggable: true }).addTo(map);
      const setLL = (lat, lng) => { $('#pLat').value = lat.toFixed(5); $('#pLng').value = lng.toFixed(5); marker.setLatLng([lat, lng]); };
      map.on('click', (e) => setLL(e.latlng.lat, e.latlng.lng));
      marker.on('dragend', () => { const ll = marker.getLatLng(); setLL(ll.lat, ll.lng); });
      $('#pCancel').addEventListener('click', () => { $('#editor').innerHTML = ''; if (map) { map.remove(); map = null; } });
      $('#pSave').addEventListener('click', async () => {
        const rec = {
          id: isNew ? $('#pId').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') : p.id,
          name: $('#pName').value.trim(), sub: $('#pSub').value.trim(), road: $('#pRoad').value.trim(),
          cat: $$('.cat').filter((c) => c.checked).map((c) => c.value),
          lat: Number($('#pLat').value), lng: Number($('#pLng').value), active: $('#pActive').checked
        };
        if (!rec.id || !rec.name) return toast('Please enter an ID and a name');
        if (!rec.cat.length) return toast('Choose at least one category');
        if (!D.isInKoronadal(rec)) return toast('That position is outside Koronadal City');
        const { error: e2 } = isNew ? await sb.from('places').insert(rec) : await sb.from('places').update(rec).eq('id', p.id);
        if (e2) return fail(e2); toast(isNew ? 'Place added' : 'Place saved'); if (map) { map.remove(); map = null; } SECTIONS.places(main);
      });
    }
    cleanup = () => { if (map) { map.remove(); map = null; } };
    draw();
  };

  // Trip log
  SECTIONS.trips = async (main) => {
    main.innerHTML = '<h1>Trip log</h1><p class="lead">Loading…</p>';
    const { data, error } = await sb.from('trips').select('*').order('started_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ids = [...new Set(data.map((t) => t.user_id).filter(Boolean))];
    const { data: profs } = ids.length ? await sb.from('profiles').select('id,name,email').in('id', ids) : { data: [] };
    const byId = Object.fromEntries((profs || []).map((p) => [p.id, p]));
    data.forEach((t) => { t.profiles = t.user_id ? byId[t.user_id] || null : null; });
    main.innerHTML = `
      <h1>Trip log</h1><p class="lead">The last ${data.length} trips started in the app. Guests appear as anonymous devices.</p>
      <div class="card" style="overflow:auto">
        <table><thead><tr><th>Started</th><th>Passenger</th><th>Destination</th><th>Vehicle</th><th>Distance</th><th>Fare shown</th><th>Type</th><th>People</th><th>Status</th></tr></thead>
        <tbody>${data.map((t) => `<tr>
          <td class="small muted">${when(t.started_at)}</td>
          <td>${t.profiles ? esc(t.profiles.name || t.profiles.email) : '<span class="muted">Guest</span>'}</td>
          <td>${esc(t.to_name || (D.findDestination(t.to_id) || {}).name || t.to_id)}</td>
          <td>${esc((D.VEHICLES.find((v) => v.id === t.vehicle_id) || {}).name || t.vehicle_id || '—')}</td>
          <td>${t.km ? t.km + ' km' : '—'}</td>
          <td>${t.fare_low !== null ? `${peso(t.fare_low)}–${peso(t.fare_high)}` : '—'}</td>
          <td class="small">${esc(t.passenger_type || 'regular')}</td><td>${t.people}</td>
          <td>${t.arrived ? '<span class="pill green">Arrived</span>' : t.ended_at ? '<span class="pill grey">Ended</span>' : '<span class="pill blue">In progress</span>'}</td></tr>`).join('')}</tbody></table>
        ${data.length ? '' : '<p class="muted">No trips yet.</p>'}
      </div>`;
  };

  // Boot
  (async () => {
    if (!sb) { app.innerHTML = '<div class="login card"><h1>Admin unavailable</h1><p class="lead">The Supabase library did not load.</p></div>'; return; }
    const { data } = await sb.auth.getSession();
    if (data.session) await boot(data.session.user).catch((e) => renderLogin(e.message));
    else renderLogin();
  })();
})();
