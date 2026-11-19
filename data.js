// Data

const DESTINATIONS = [
  // City center / landmarks
  { id: 'rizal-park',   name: 'Rizal Park (City Plaza)',      sub: 'Civic services',      cat: ['popular', 'landmarks'], lat: 6.4975, lng: 124.8430, road: 'Alunan Avenue' },
  { id: 'public-market',name: 'Koronadal Public Market',      sub: 'Shopping',            cat: ['popular', 'landmarks'], lat: 6.5026, lng: 124.8445, road: 'Sergio Morales Avenue' },
  { id: 'city-hall',    name: 'Koronadal City Hall',          sub: 'Civic services',      cat: ['popular', 'landmarks'], lat: 6.4796, lng: 124.8657, road: 'General Santos Drive (Zone III)' },
  { id: 'capitol',      name: 'South Cotabato Provincial Capitol', sub: 'Government',     cat: ['landmarks'],            lat: 6.4935, lng: 124.8383, road: 'Alunan Avenue' },
  { id: 'cathedral',    name: 'Christ the King Cathedral',    sub: 'Church',              cat: ['landmarks'],            lat: 6.4981, lng: 124.8423, road: 'Alunan Avenue' },
  { id: 'sports',       name: 'South Cotabato Sports Complex', sub: 'Sports & events',    cat: ['landmarks'],            lat: 6.4976, lng: 124.8394, road: 'Jaycee Avenue (Zone IV)' },
  { id: 'rotonda',      name: 'Koronadal Rotonda (Round Ball)', sub: 'Junction',          cat: ['landmarks'],            lat: 6.5060, lng: 124.8330, road: 'Alunan Avenue / National Highway' },

  // Terminals
  { id: 'kibt',         name: 'Koronadal Integrated Bus Terminal', sub: 'Transport',      cat: ['popular', 'terminals'], lat: 6.4885, lng: 124.8610, road: 'General Santos Drive' },
  { id: 'van-terminal', name: 'Van Terminal (Gensan Drive)',  sub: 'Transport',           cat: ['terminals'],            lat: 6.4965, lng: 124.8495, road: 'General Santos Drive' },

  // Malls / shopping
  { id: 'kcc',          name: 'KCC Mall of Marbel',           sub: 'Shopping',            cat: ['popular', 'malls'],     lat: 6.4991, lng: 124.8462, road: 'General Santos Drive' },
  { id: 'gaisano',      name: 'Gaisano Grand Mall Koronadal', sub: 'Shopping',            cat: ['malls'],                lat: 6.4891, lng: 124.8596, road: 'General Santos Drive (Sto. Niño)' },
  { id: 'ace',          name: 'Ace Centerpoint',              sub: 'Shopping',            cat: ['malls'],                lat: 6.5001, lng: 124.8454, road: 'General Santos Drive' },
  { id: 'fitmart',      name: 'Fitmart Koronadal',            sub: 'Shopping',            cat: ['malls'],                lat: 6.4985, lng: 124.8450, road: 'General Santos Drive' },

  // Schools
  { id: 'ndmu',         name: 'Notre Dame of Marbel University', sub: 'School',           cat: ['popular', 'schools'],   lat: 6.4955, lng: 124.8413, road: 'Alunan Avenue (Aldeguer Ext.)' },
  { id: 'knchs',        name: 'Koronadal National Comprehensive HS', sub: 'School',       cat: ['schools'],              lat: 6.5000, lng: 124.8383, road: 'Quintin Paredes Street' },
  { id: 'sti',          name: 'STI College Koronadal',        sub: 'School',              cat: ['schools'],              lat: 6.4953, lng: 124.8464, road: 'Santa Lucia Street (Zone III)' },
  { id: 'gvc',          name: 'Green Valley College',         sub: 'School',              cat: ['schools'],              lat: 6.4910, lng: 124.8557, road: 'General Santos Drive (Sto. Niño)' },

  // Hospitals
  { id: 'scph',         name: 'South Cotabato Provincial Hospital', sub: 'Hospital',      cat: ['hospitals'],            lat: 6.4929, lng: 124.8390, road: 'Aguinaldo Street' },
  { id: 'pingoy',       name: 'Dr. Arturo P. Pingoy Medical Center', sub: 'Hospital',     cat: ['hospitals'],            lat: 6.5052, lng: 124.8370, road: 'General Santos Drive' },
  { id: 'avmsc',        name: 'Allah Valley Medical Specialists Center', sub: 'Hospital', cat: ['hospitals'],            lat: 6.4975, lng: 124.8470, road: 'General Santos Drive' },

  // Barangays
  { id: 'carpenter',    name: 'Brgy. Carpenter Hill',         sub: 'Barangay',            cat: ['barangays'],            lat: 6.4533, lng: 124.8795, road: 'Carpenter Hill Road' },
  { id: 'morales',      name: 'Brgy. Morales',                sub: 'Barangay',            cat: ['barangays'],            lat: 6.5120, lng: 124.8315, road: 'Morales Road' },
  { id: 'sta-cruz',     name: 'Brgy. Sta. Cruz',              sub: 'Barangay',            cat: ['barangays'],            lat: 6.4747, lng: 124.8400, road: 'Sta. Cruz Road' },
  { id: 'san-jose',     name: 'Brgy. San Jose',               sub: 'Barangay',            cat: ['barangays'],            lat: 6.5545, lng: 124.9044, road: 'San Jose Road' },
  { id: 'paraiso',      name: 'Brgy. Paraiso',                sub: 'Barangay',            cat: ['barangays'],            lat: 6.4852, lng: 124.8152, road: 'Paraiso Road' },
  { id: 'mambucal',     name: 'Brgy. Mambucal',               sub: 'Barangay',            cat: ['barangays'],            lat: 6.4681, lng: 124.8357, road: 'Mambucal Road' },
  { id: 'concepcion',   name: 'Brgy. Concepcion',             sub: 'Barangay',            cat: ['barangays'],            lat: 6.4802, lng: 124.8844, road: 'Concepcion Road' },
  { id: 'saravia',      name: 'Brgy. Saravia',                sub: 'Barangay',            cat: ['barangays'],            lat: 6.4229, lng: 124.8837, road: 'Saravia Road' },
  { id: 'assumption',   name: 'Brgy. Assumption',             sub: 'Barangay',            cat: ['barangays'],            lat: 6.4466, lng: 124.8383, road: 'Assumption Road' },
  { id: 'esperanza',    name: 'Brgy. Esperanza',              sub: 'Barangay',            cat: ['barangays'],            lat: 6.5126, lng: 124.9168, road: 'Esperanza Road' },
  { id: 'namnama',      name: 'Brgy. Namnama',                sub: 'Barangay',            cat: ['barangays'],            lat: 6.5248, lng: 124.8630, road: 'Namnama Road' },
  { id: 'new-pang',     name: 'Brgy. New Pangasinan',         sub: 'Barangay',            cat: ['barangays'],            lat: 6.4913, lng: 124.8872, road: 'New Pangasinan Road' },
  { id: 'caloocan',     name: 'Brgy. Caloocan',               sub: 'Barangay',            cat: ['barangays'],            lat: 6.5281, lng: 124.8373, road: 'Caloocan Road' },
  { id: 'cacub',        name: 'Brgy. Cacub',                  sub: 'Barangay',            cat: ['barangays'],            lat: 6.5092, lng: 124.9496, road: 'Cacub Road' },
  { id: 'mabini',       name: 'Brgy. Mabini',                 sub: 'Barangay',            cat: ['barangays'],            lat: 6.5267, lng: 124.9075, road: 'Mabini Road' },
  { id: 'magsaysay',    name: 'Brgy. Magsaysay',              sub: 'Barangay',            cat: ['barangays'],            lat: 6.4665, lng: 124.9045, road: 'Magsaysay Road' },
  { id: 'sto-nino',     name: 'Brgy. Sto. Niño',              sub: 'Barangay',            cat: ['barangays'],            lat: 6.4935, lng: 124.8680, road: 'General Santos Drive (Sto. Niño)' },
  { id: 'topland',      name: 'Brgy. Topland',                sub: 'Barangay',            cat: ['barangays'],            lat: 6.4841, lng: 124.9372, road: 'Topland Road' },
  { id: 'avancena',     name: 'Brgy. Avanceña',               sub: 'Barangay',            cat: ['barangays'],            lat: 6.5415, lng: 124.8692, road: 'Avanceña Road' },
  { id: 'zulueta',      name: 'Brgy. Zulueta',                sub: 'Barangay',            cat: ['barangays'],            lat: 6.5200, lng: 124.8550, road: 'Zulueta Road' },
  { id: 'gps',          name: 'Brgy. General Paulino Santos', sub: 'Barangay',            cat: ['barangays'],            lat: 6.5074, lng: 124.8489, road: 'National Highway' },
  { id: 'zone1',        name: 'Brgy. Zone I',                 sub: 'City proper',         cat: ['barangays'],            lat: 6.5068, lng: 124.8401, road: 'Alunan Avenue' },
  { id: 'zone2',        name: 'Brgy. Zone II',                sub: 'City proper',         cat: ['barangays'],            lat: 6.4949, lng: 124.8569, road: 'General Santos Drive' },
  { id: 'zone3',        name: 'Brgy. Zone III',               sub: 'City proper',         cat: ['barangays'],            lat: 6.4935, lng: 124.8446, road: 'General Santos Drive' },
  { id: 'zone4',        name: 'Brgy. Zone IV',                sub: 'City proper',         cat: ['barangays'],            lat: 6.5035, lng: 124.8342, road: 'Zone IV' }
];

const CATEGORIES = [
  { id: 'popular',   label: 'Popular',   icon: '★' },
  { id: 'landmarks', label: 'Landmarks', icon: '◈' },
  { id: 'terminals', label: 'Terminals', icon: '⇄' },
  { id: 'malls',     label: 'Malls',     icon: '▣' },
  { id: 'schools',   label: 'Schools',   icon: '✎' },
  { id: 'hospitals', label: 'Hospitals', icon: '✚' },
  { id: 'barangays', label: 'Barangays', icon: '⌂' }
];

const VEHICLES = [
  {
    id: 'tricycle', name: 'Tricycle', letter: 'T', color: '#2b56d6',
    tagline: 'Most common ride inside the city proper.',
    desc: 'Three-wheeled motorcycle with a sidecar. Usually shared with other passengers along the way. Available almost everywhere in Koronadal, day and night.',
    base: 15, baseKm: 2, perKm: 2, spread: 0, speedKph: 20, minKm: 0, maxKm: 15, specialX: 3,
    tips: [
      'Tell the driver your exact drop-off point before boarding.',
      'A "special trip" (whole tricycle for yourself) costs more than the regular shared fare.',
      'Inside the Downtown Base-Fare Zone the fare is ₱15 per passenger: ₱12 for high school and college students, senior citizens and PWDs. Show a valid ID.'
    ]
  },
  {
    id: 'habal', name: 'Habal-habal', letter: 'H', color: '#0e8f6e',
    tagline: 'Fast motorcycle taxi, one passenger.',
    desc: 'Motorcycle taxi for a single passenger. Faster than a tricycle and able to reach barangay roads and uphill areas that tricycles avoid.',
    base: 20, baseKm: 2, perKm: 5, spread: 15, speedKph: 28, minKm: 0, maxKm: 40, specialX: 1,
    tips: [
      'Agree on the fare before the trip starts.',
      'Ask for a helmet. Hold on to the grab bar, not the driver.',
      'Prices go up at night and during rain.'
    ]
  },
  {
    id: 'multicab', name: 'Multicab / Jeepney', letter: 'M', color: '#b5541a',
    tagline: 'Cheapest option on fixed routes.',
    desc: 'Shared public utility vehicle that follows a fixed route along the main roads (Alunan Avenue, General Santos Drive and the national highway). Best for longer trips between the city center and the barangays.',
    base: 13, baseKm: 4, perKm: 1.8, spread: 5, speedKph: 22, minKm: 2.5, maxKm: 60, specialX: 1,
    tips: [
      'Wait at the designated loading area and say "para" when you want to get off.',
      'Routes are fixed, so you may need to walk from the highway to your exact destination.',
      'Fewer trips are available late at night.'
    ]
  }
];

// Helpers

const KORONADAL = {
  center: { lat: 6.503, lng: 124.846 },
  zoom: 14,
  bounds: [[6.40, 124.70], [6.62, 124.98]]
};

function findDestination(id) {
  return DESTINATIONS.find((d) => d.id === id) || null;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function roadDistanceKm(from, to) {
  return Math.max(0.6, haversineKm(from, to) * 1.3);
}

function nearestDestination(point) {
  let best = null;
  let bestKm = Infinity;
  for (const d of DESTINATIONS) {
    const km = haversineKm(point, d);
    if (km < bestKm) {
      bestKm = km;
      best = d;
    }
  }
  return { place: best, km: Math.round(bestKm * 100) / 100 };
}

function describePoint(point) {
  const near = (test) => {
    let best = null, bestKm = Infinity;
    for (const d of DESTINATIONS.filter(test)) {
      const km = haversineKm(point, d);
      if (km < bestKm) { bestKm = km; best = d; }
    }
    return { place: best, km: bestKm };
  };
  const b = near((d) => d.cat.includes('barangays'));
  const l = near((d) => !d.cat.includes('barangays'));
  if (l.place && l.km <= 1.2) return `${b.place.name} · near ${l.place.name}`;
  return b.place.name;
}

function isInKoronadal(point) {
  return haversineKm(point, KORONADAL.center) <= 20;
}

function roundUp5(n) {
  return Math.ceil(n / 5) * 5;
}

// Tricycle fare ordinance: Downtown Base-Fare Zone and passenger types
const RULES = {
  fuelLevel: 0,
  zone: [
    [6.50657, 124.83659], [6.50553, 124.83781], [6.51001, 124.84152], [6.50748, 124.84459], [6.50962, 124.84636],
    [6.50833, 124.84791], [6.50926, 124.84868], [6.50735, 124.85092], [6.50567, 124.85221], [6.50485, 124.85325],
    [6.50221, 124.85107], [6.50067, 124.85288], [6.4974, 124.85219], [6.49611, 124.8537], [6.49377, 124.85183],
    [6.49322, 124.85247], [6.49212, 124.85157], [6.49255, 124.85106], [6.49141, 124.8453], [6.48854, 124.84293],
    [6.48959, 124.84169], [6.48919, 124.84109], [6.48899, 124.83989], [6.48926, 124.83878], [6.4912, 124.8383],
    [6.49051, 124.83696], [6.49188, 124.83525], [6.49364, 124.83659], [6.49602, 124.8338], [6.49777, 124.83525],
    [6.50068, 124.83178]
  ]
};
const DEFAULT_ZONE = RULES.zone.map((p) => p.slice());
const FUEL_LEVELS = [
  { level: 0, label: 'Up to ₱70 per litre (no adjustment)' },
  { level: 1, label: '₱71 to ₱100 per litre (+₱5 regular)' },
  { level: 2, label: '₱101 to ₱130 per litre (+₱10 regular)' },
  { level: 3, label: '₱131 to ₱160 per litre (+₱15 regular)' }
];
const DEFAULT_DISCOUNTS = [
  { id: 'regular', label: 'Regular', discount: 0, amount: 0, fuelAdd: 5 },
  { id: 'student', label: 'High School / College Student', discount: 0.2, amount: 3, fuelAdd: 4 },
  { id: 'senior', label: 'Senior Citizen', discount: 0.2, amount: 3, fuelAdd: 4 },
  { id: 'pwd', label: 'PWD', discount: 0.2, amount: 3, fuelAdd: 4 }
];
const ZONE_TOLERANCE_KM = 0.06;

function insidePolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if ((yi > p.lat) !== (yj > p.lat) && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToZoneKm(p) {
  const poly = RULES.zone;
  const kx = 110.6, ky = 110.574;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][1] * kx, ay = poly[j][0] * ky, bx = poly[i][1] * kx, by = poly[i][0] * ky;
    const px = p.lng * kx, py = p.lat * ky;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}
function inZone(p) {
  if (!p || !RULES.zone || RULES.zone.length < 3) return false;
  return insidePolygon(p, RULES.zone) || distToZoneKm(p) <= ZONE_TOLERANCE_KM;
}
function outsideKm(coords) {
  if (!coords || coords.length < 2) return 0;
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = { lat: coords[i - 1][0], lng: coords[i - 1][1] }, b = { lat: coords[i][0], lng: coords[i][1] };
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    if (!insidePolygon(mid, RULES.zone)) km += haversineKm(a, b);
  }
  return km;
}

function tricycleFare(v, from, to, km, options) {
  const a = inZone(from), b = inZone(to);
  if (a && b) return { fare: v.base, rule: 'zone', ruleText: 'Downtown Base-Fare Zone: flat fare' };
  if (a !== b) {
    const out = a ? to : from;
    if (out.tricycleFare) return { fare: Number(out.tricycleFare), rule: 'fixed', ruleText: `Fixed ordinance fare to and from ${out.name}` };
    const kmOut = options.kmOut != null ? options.kmOut : distToZoneKm(out) * 1.3;
    const steps = Math.max(1, Math.ceil(kmOut - 0.05));
    return { fare: v.base + v.perKm * steps, rule: 'outside', ruleText: `₱${v.base} zone fare + ₱${v.perKm} × ${steps} km outside the zone` };
  }
  const steps = Math.ceil(Math.max(0, km - v.baseKm) - 0.001);
  return { fare: v.base + v.perKm * steps, rule: 'distance', ruleText: `₱${v.base} for the first ${v.baseKm} km${steps ? ` + ₱${v.perKm} × ${steps} km` : ''}` };
}

function estimateFaresBetween(from, to, options = {}) {
  if (!from || !to) return [];
  const km = options.km || roadDistanceKm(from, to);
  const type = options.type || null;
  const types = (window.KR_DATA && window.KR_DATA.DISCOUNTS) || DEFAULT_DISCOUNTS;
  const regularType = types.find((t) => t.id === 'regular') || DEFAULT_DISCOUNTS[0];
  const fuel = Math.max(0, Math.min(3, Number(RULES.fuelLevel) || 0));

  return VEHICLES.filter((v) => km >= v.minKm && km <= v.maxKm)
    .map((v) => {
      const minutes = Math.round((km / v.speedKph) * 60) + 3;
      const common = { vehicle: v, from, to, km: Math.round(km * 10) / 10, minutes };

      if (v.id === 'tricycle') {
        const t = tricycleFare(v, from, to, km, options);
        const regularLow = t.fare + fuel * (regularType.fuelAdd || 0);
        const less = type ? Number(type.amount) || 0 : 0;
        const low = type && type.id !== 'regular'
          ? Math.max(0, t.fare - less) + fuel * (Number(type.fuelAdd) || 0)
          : regularLow;
        const spread = Number(v.spread) || 0;
        return {
          ...common,
          low, high: low + spread, regularLow, regularHigh: regularLow + spread,
          discount: 0, discounted: low < regularLow,
          offText: low < regularLow ? `₱${regularLow - low} less` : '',
          rule: t.rule,
          ruleText: t.ruleText + (fuel ? ' · gasoline price adjustment added' : ''),
          special: v.specialX > 1 ? roundUp5(regularLow * v.specialX) : null
        };
      }

      const extraKm = Math.max(0, km - v.baseKm);
      const raw = v.base + extraKm * v.perKm;
      const regularLow = Math.max(v.base, Math.round(raw));
      const regularHigh = v.spread > 0 ? roundUp5(regularLow + v.spread) : regularLow;
      const off = options.discount || 0;
      const low = off ? Math.round(regularLow * (1 - off)) : regularLow;
      const high = off ? Math.round(regularHigh * (1 - off)) : regularHigh;
      return {
        ...common,
        low, high, regularLow, regularHigh,
        discount: off, discounted: off > 0,
        offText: off > 0 ? `${Math.round(off * 100)}% off` : '',
        rule: null, ruleText: '',
        special: v.specialX > 1 ? roundUp5(regularLow * v.specialX) : null
      };
    })
    .sort((a, b) => a.low - b.low);
}

function estimateFares(fromId, toId, options = {}) {
  const from = findDestination(fromId);
  const to = findDestination(toId);
  if (!from || !to || from.id === to.id) return [];
  return estimateFaresBetween(from, to, options);
}

function describeRoute(from, to) {
  if (from.road === to.road) return `Along ${from.road}`;
  return `${from.road} → ${to.road}`;
}

function peso(n) {
  return '₱' + Number(n).toLocaleString('en-PH');
}

window.KR_DATA = {
  DESTINATIONS, CATEGORIES, VEHICLES, KORONADAL,
  RULES, DEFAULT_ZONE, FUEL_LEVELS, DEFAULT_DISCOUNTS, DISCOUNTS: DEFAULT_DISCOUNTS.map((t) => ({ ...t })),
  findDestination, estimateFares, estimateFaresBetween, describeRoute, peso,
  roadDistanceKm, haversineKm, nearestDestination, describePoint, isInKoronadal,
  inZone, outsideKm, distToZoneKm
};
