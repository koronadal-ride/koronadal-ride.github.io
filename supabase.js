// Supabase
(() => {
  const URL = 'https://fzbptuewtgilcciezfdb.supabase.co';
  const KEY = 'sb_publishable_ip0bIgB_QCJDzBETQJkEcA_ZuFFaDa0';
  const CACHE_KEY = 'kr_remote_data';
  const DEVICE_KEY = 'kr_device';

  const client = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

  const safeGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const deviceId = () => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  };

  // Reference data
  function apply(D, data) {
    if (data.places && data.places.length) {
      D.DESTINATIONS.length = 0;
      data.places.forEach((p) => D.DESTINATIONS.push({
        id: p.id, name: p.name, sub: p.sub || '', cat: p.cat || [], lat: Number(p.lat), lng: Number(p.lng), road: p.road || '',
        tricycleFare: p.tricycle_fare != null && Number(p.tricycle_fare) > 0 ? Number(p.tricycle_fare) : null
      }));
    }
    if (data.vehicles && data.vehicles.length) {
      D.VEHICLES.length = 0;
      data.vehicles.forEach((v) => D.VEHICLES.push({
        id: v.id, name: v.name, letter: v.letter, color: v.color, tagline: v.tagline || '', desc: v.description || '',
        base: Number(v.base), baseKm: Number(v.base_km), perKm: Number(v.per_km), spread: Number(v.spread),
        speedKph: Number(v.speed_kph), minKm: Number(v.min_km), maxKm: Number(v.max_km), specialX: Number(v.special_x), tips: v.tips || []
      }));
    }
    if (data.discounts && data.discounts.length) {
      D.DISCOUNTS = data.discounts.map((r) => {
        const base = (D.DEFAULT_DISCOUNTS || []).find((t) => t.id === r.id) || { amount: 0, fuelAdd: 0 };
        return {
          id: r.id, label: r.label, discount: Number(r.percent) / 100,
          amount: r.amount != null ? Number(r.amount) : base.amount,
          fuelAdd: r.fuel_add != null ? Number(r.fuel_add) : base.fuelAdd
        };
      });
    }
    if (data.rules && D.RULES) {
      if (Array.isArray(data.rules.zone) && data.rules.zone.length >= 3) D.RULES.zone = data.rules.zone.map((p) => [Number(p[0]), Number(p[1])]);
      D.RULES.fuelLevel = Number(data.rules.fuelLevel) || 0;
    }
  }

  function applyCache(D) {
    const cached = safeGet(CACHE_KEY);
    if (cached) apply(D, cached);
    return !!cached;
  }

  async function loadReferenceData(D) {
    if (!client) return { source: 'builtin', changed: false };
    try {
      const [p, v, r] = await Promise.all([
        client.from('places').select('*').eq('active', true).order('name'),
        client.from('vehicles').select('*').eq('active', true).order('base'),
        client.from('discount_rules').select('*').eq('active', true).order('sort_order')
      ]);
      const err = p.error || v.error || r.error;
      if (err) throw err;
      let rules = null;
      try {
        const s = await client.from('settings').select('value').eq('key', 'fare_rules').maybeSingle();
        if (!s.error && s.data) rules = s.data.value;
      } catch { /* settings table not created yet */ }
      const data = { places: p.data, vehicles: v.data, discounts: r.data, rules, at: Date.now() };
      const before = localStorage.getItem(CACHE_KEY);
      const after = JSON.stringify(data);
      localStorage.setItem(CACHE_KEY, after);
      apply(D, data);
      const changed = before ? JSON.stringify(JSON.parse(before), (k, val) => (k === 'at' ? undefined : val)) !== JSON.stringify(data, (k, val) => (k === 'at' ? undefined : val)) : true;
      return { source: 'live', changed };
    } catch (e) {
      console.warn('Supabase data unavailable:', e.message || e);
      return { source: 'offline', changed: false };
    }
  }

  // Auth
  const auth = {
    async current() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return data.session ? data.session.user : null;
    },
    async profile(userId) {
      if (!client) return null;
      const { data } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
      return data;
    },
    signUp: (name, email, password) => client.auth.signUp({ email, password, options: { data: { name } } }),
    signIn: (email, password) => client.auth.signInWithPassword({ email, password }),
    async googleEnabled() {
      try {
        const r = await fetch(`${URL}/auth/v1/settings`, { headers: { apikey: KEY } });
        const j = await r.json();
        return !!(j && j.external && j.external.google);
      } catch { return false; }
    },
    signInWithGoogle: () => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }),
    signOut: () => client.auth.signOut(),
    updateName: async (userId, name) => {
      await client.auth.updateUser({ data: { name } });
      await client.from('profiles').update({ name }).eq('id', userId);
    },
    updatePassword: (password) => client.auth.updateUser({ password }),
    onChange: (cb) => client && client.auth.onAuthStateChange((event, session) => cb(event, session ? session.user : null))
  };

  const newKey = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });

  // Per-user sync
  const sync = {
    async pull(userId) {
      if (!client) return null;
      const [s, r] = await Promise.all([
        client.from('saved_places').select('*').eq('user_id', userId).order('id'),
        client.from('recent_searches').select('*').eq('user_id', userId).order('searched_at', { ascending: false }).limit(10)
      ]);
      if (s.error || r.error) return null;
      const saved = { home: null, work: null, others: [] };
      for (const row of s.data) {
        const pl = { destId: row.dest_id, name: row.name, lat: Number(row.lat), lng: Number(row.lng) };
        if (row.slot === 'home') saved.home = pl; else if (row.slot === 'work') saved.work = pl; else saved.others.push(pl);
      }
      const recent = r.data.map((row) => ({ from: row.from_id || 'me', fromPoint: row.from_point || undefined, to: row.to_id, toPoint: row.to_point || undefined, toName: row.to_name || undefined, at: new Date(row.searched_at).getTime() }));
      return { saved, recent };
    },
    async pushSaved(userId, saved) {
      if (!client) return;
      const rows = [];
      const add = (slot, pl) => pl && rows.push({ user_id: userId, slot, name: pl.name, dest_id: pl.destId || null, lat: pl.lat, lng: pl.lng });
      add('home', saved.home); add('work', saved.work); (saved.others || []).forEach((pl) => add('other', pl));
      await client.from('saved_places').delete().eq('user_id', userId);
      if (rows.length) await client.from('saved_places').insert(rows);
    },
    async pushRecent(userId, entry) {
      if (!client) return;
      await client.from('recent_searches').insert({ user_id: userId, from_id: entry.from === 'me' ? null : entry.from, from_point: entry.fromPoint || null, to_id: entry.to, to_point: entry.toPoint || null, to_name: entry.toName || null });
    },
    async tripStart(trip, userId, fare, passenger, people) {
      if (!client) return null;
      const key = newKey();
      const row = {
        user_id: userId || null, device_id: userId ? null : deviceId(), to_id: trip.toId, to_point: trip.toPoint || null, to_name: trip.toName || null,
        vehicle_id: trip.vehicleId, start_lat: trip.start.lat, start_lng: trip.start.lng, km: trip.km || null,
        fare_low: fare ? fare.low : null, fare_high: fare ? fare.high : null, passenger_type: passenger, people
      };
      const { error } = await client.from('trips').insert({ ...row, client_key: key });
      if (!error) return key;
      await client.from('trips').insert(row);
      return null;
    },
    async tripUpdate(key, change) {
      if (!client || !key || typeof key === 'number') return;
      await client.rpc('update_trip', {
        p_key: key, p_to_id: change.toId, p_to_point: change.toPoint || null, p_to_name: change.toName || null, p_vehicle: change.vehicleId || null,
        p_km: change.km || null, p_fare_low: change.fare ? change.fare.low : null, p_fare_high: change.fare ? change.fare.high : null
      });
    },
    async tripEnd(key, arrived) {
      if (!client || !key) return;
      if (typeof key === 'number') { await client.from('trips').update({ ended_at: new Date().toISOString(), arrived: !!arrived }).eq('id', key); return; }
      await client.rpc('end_trip', { p_key: key, p_arrived: !!arrived });
    }
  };

  window.KR_SB = { client, url: URL, applyCache, loadReferenceData, auth, sync, deviceId };
})();
