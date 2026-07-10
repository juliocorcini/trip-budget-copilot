export type DestinationCluster =
  | 'expensive_european'
  | 'mid_european'
  | 'cheap_asian'
  | 'expensive_asian'
  | 'north_america'
  | 'latin_america';

export const DEFAULT_CLUSTER: DestinationCluster = 'mid_european';

const CITY_MAP: ReadonlyArray<[string[], DestinationCluster]> = [
  [
    [
      'amsterdam', 'london', 'paris', 'zurich', 'zürich', 'oslo',
      'copenhagen', 'copenhague', 'dublin', 'helsinki', 'stockholm',
      'vienna', 'wien', 'geneva', 'genève', 'monaco', 'luxembourg',
      'reykjavik', 'edinburgh', 'brussels', 'bruxelles', 'milan',
      'milano', 'munich', 'münchen',
    ],
    'expensive_european',
  ],
  [
    [
      'barcelona', 'lisboa', 'lisbon', 'berlin', 'prague', 'praga',
      'budapest', 'roma', 'rome', 'athens', 'atenas', 'madrid',
      'marseille', 'krakow', 'cracóvia', 'porto', 'sevilla', 'seville',
      'florence', 'firenze', 'naples', 'napoli', 'warsaw', 'varsóvia',
      'zagreb', 'split', 'dubrovnik', 'bucharest', 'sofia', 'tallinn',
      'riga', 'vilnius', 'nice', 'valencia', 'malaga', 'granada',
    ],
    'mid_european',
  ],
  [
    [
      'bangkok', 'hanoi', 'bali', 'kuala lumpur', 'ho chi minh',
      'saigon', 'phnom penh', 'siem reap', 'chiang mai', 'phuket',
      'jakarta', 'yogyakarta', 'luang prabang', 'vientiane', 'mandalay',
      'yangon', 'da nang', 'hoi an', 'nha trang',
    ],
    'cheap_asian',
  ],
  [
    [
      'tokyo', 'singapura', 'singapore', 'hong kong', 'seoul',
      'taipei', 'osaka', 'kyoto', 'shanghai', 'beijing', 'peking',
      'shenzhen', 'macau', 'macao',
    ],
    'expensive_asian',
  ],
  [
    [
      'new york', 'nyc', 'los angeles', 'toronto', 'chicago',
      'san francisco', 'vancouver', 'seattle', 'boston', 'miami',
      'washington', 'montreal', 'las vegas', 'honolulu', 'denver',
      'austin', 'portland', 'philadelphia', 'san diego', 'ottawa',
      'calgary',
    ],
    'north_america',
  ],
  [
    [
      'cdmx', 'ciudad de mexico', 'mexico city', 'buenos aires',
      'são paulo', 'sao paulo', 'lima', 'bogotá', 'bogota', 'santiago',
      'rio de janeiro', 'medellín', 'medellin', 'cartagena',
      'montevideo', 'quito', 'cusco', 'cuzco', 'havana', 'panama',
      'cancún', 'cancun', 'playa del carmen', 'guadalajara',
      'florianópolis', 'florianopolis', 'salvador', 'brasília',
      'brasilia', 'curitiba', 'belo horizonte',
    ],
    'latin_america',
  ],
];

export function getClusterForCity(city: string): DestinationCluster {
  const normalized = city.toLowerCase().trim();
  if (normalized.length === 0) return DEFAULT_CLUSTER;
  for (const [cities, cluster] of CITY_MAP) {
    if (cities.some((c) => normalized.includes(c) || c.includes(normalized))) {
      return cluster;
    }
  }
  return DEFAULT_CLUSTER;
}
