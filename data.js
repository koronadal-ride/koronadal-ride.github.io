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
    base: 15, baseKm: 2, perKm: 3, spread: 10, speedKph: 20, minKm: 0, maxKm: 15, specialX: 3,
    tips: [
      'Tell the driver your exact drop-off point before boarding.',
      'A "special trip" (whole tricycle for yourself) costs more than the regular shared fare.',
      'Students, senior citizens and PWDs get 20% off. Show a valid ID to the driver.'
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

function estimateFaresBetween(from, to, options = {}) {
  if (!from || !to) return [];
  const km = options.km || roadDistanceKm(from, to);

  return VEHICLES.filter((v) => km >= v.minKm && km <= v.maxKm)
    .map((v) => {
      const extraKm = Math.max(0, km - v.baseKm);
      const raw = v.base + extraKm * v.perKm;
      const regularLow = Math.max(v.base, Math.round(raw));
      const regularHigh = roundUp5(regularLow + v.spread);
      const off = options.discount || 0;
      const low = off ? Math.round(regularLow * (1 - off)) : regularLow;
      const high = off ? Math.round(regularHigh * (1 - off)) : regularHigh;
      const minutes = Math.round((km / v.speedKph) * 60) + 3;
      return {
        vehicle: v,
        from,
        to,
        km: Math.round(km * 10) / 10,
        low,
        high,
        regularLow,
        regularHigh,
        discount: off,
        special: v.specialX > 1 ? roundUp5(regularLow * v.specialX) : null,
        minutes
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
  findDestination, estimateFares, estimateFaresBetween, describeRoute, peso,
  roadDistanceKm, haversineKm, nearestDestination, describePoint, isInKoronadal
};
