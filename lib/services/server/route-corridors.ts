type CorridorDefinition = {
  id: string;
  cities: readonly string[];
};

const CORRIDORS: readonly CorridorDefinition[] = [
  {
    id: "COAST_SOUTHWEST_SPINE",
    cities: ["Yaounde", "Edea", "Douala", "Mutengene", "Buea", "Limbe", "Tiko", "Kumba"],
  },
  {
    id: "WEST_CORE_RN5_RN4",
    cities: [
      "Douala",
      "Mbanga",
      "Loum",
      "Nkongsamba",
      "Melong",
      "Kekem",
      "Bafang",
      "Baham",
      "Bandjoun",
      "Bafoussam",
      "Dschang",
      "Mbouda",
      "Bamenda",
    ],
  },
  {
    id: "LITTORAL_SOUTH_PORT",
    cities: ["Edea", "Kribi", "Campo"],
  },
  {
    id: "CENTRE_SOUTH_GABON_AXIS",
    cities: ["Yaounde", "Mbalmayo", "Ebolowa", "Ambam"],
  },
  {
    id: "CENTRE_SOUTH_CONGO_AXIS",
    cities: ["Mbalmayo", "Sangmelima", "Djoum", "Mintom"],
  },
  {
    id: "CENTRE_EAST_CAR_AXIS",
    cities: ["Yaounde", "Awae", "Ayos", "Abong-Mbang", "Doume", "Batouri", "Kentzou", "Garoua-Boulai"],
  },
  {
    id: "NORTH_FAR_NORTH_CHAD_AXIS",
    cities: ["Ngaoundere", "Garoua", "Maroua", "Mora", "Kousseri"],
  },
  {
    id: "NW_SW_NIGERIA_AXIS",
    cities: ["Bamenda", "Mamfe", "Ekok", "Kumba", "Mutengene"],
  },
];

const foldAccents = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCityKey = (value: string): string =>
  foldAccents(value)
    .replace(/[éèêë]/g, "e")
    .replace(/[àâä]/g, "a")
    .replace(/[ïî]/g, "i")
    .replace(/[ôö]/g, "o")
    .replace(/[ùûü]/g, "u");

type RankedCity = {
  city: string;
  score: number;
};

export function getCorridorFallbackDestinations(
  fromCity: string,
  toCity: string,
  maxDestinations = 6
): string[] {
  const fromKey = normalizeCityKey(fromCity);
  const toKey = normalizeCityKey(toCity);
  if (!fromKey || !toKey || fromKey === toKey) return [];

  const ranked = new Map<string, RankedCity>();

  for (const corridor of CORRIDORS) {
    const keys = corridor.cities.map(normalizeCityKey);
    const fromIdx = keys.indexOf(fromKey);
    const toIdx = keys.indexOf(toKey);

    if (fromIdx < 0 || toIdx < 0) continue;

    for (let i = 0; i < corridor.cities.length; i += 1) {
      if (i === toIdx || i === fromIdx) continue;

      const isOutbound = toIdx > fromIdx ? i > fromIdx : i < fromIdx;
      if (!isOutbound) continue;

      const city = corridor.cities[i];
      const cityKey = normalizeCityKey(city);
      if (!cityKey || cityKey === toKey || cityKey === fromKey) continue;

      const distanceScore = Math.abs(i - toIdx);
      const directionPenalty = (toIdx > fromIdx && i < toIdx) || (toIdx < fromIdx && i > toIdx) ? 2 : 0;
      const score = distanceScore + directionPenalty;

      const current = ranked.get(cityKey);
      if (!current || score < current.score) {
        ranked.set(cityKey, { city, score });
      }
    }
  }

  return [...ranked.values()]
    .sort((a, b) => a.score - b.score || a.city.localeCompare(b.city))
    .slice(0, maxDestinations)
    .map((entry) => entry.city);
}

