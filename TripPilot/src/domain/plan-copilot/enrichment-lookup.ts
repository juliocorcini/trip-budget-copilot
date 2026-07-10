import type { DestinationCluster } from './city-clusters';

export type ActivityType = 'bar' | 'market' | 'restaurant' | 'outing' | 'transport';
export type SpendingLevel = 'budget' | 'balanced' | 'comfortable' | 'flexible';

export interface EnrichmentData {
  expected_min_cost_cents: number;
  expected_max_cost_cents: number;
  cost_scope: string;
  includes: string[];
  usually_not_included: string[];
  assumption: string;
}

export interface AIPlanActivity {
  type: ActivityType;
  spending_level: SpendingLevel;
  suggested_quantity: number;
  typical_cost_cents: number;
  reasoning: string;
}

export interface EnrichedPlanActivity extends AIPlanActivity {
  expected_min_cost_cents: number;
  expected_max_cost_cents: number;
  cost_scope: string;
  includes: string[];
  usually_not_included: string[];
  assumption: string;
}

type ClusterTable = Record<ActivityType, Record<SpendingLevel, EnrichmentData>>;

const EXPENSIVE_EUROPEAN: ClusterTable = {
  bar: {
    budget:      { expected_min_cost_cents: 2500, expected_max_cost_cents: 3500, cost_scope: 'per_person_per_night', includes: ['2-3 beers or simple drinks'], usually_not_included: ['food', 'club entry', 'cocktails'], assumption: 'Pub or quiet bar, no long night' },
    balanced:    { expected_min_cost_cents: 4000, expected_max_cost_cents: 5500, cost_scope: 'per_person_per_night', includes: ['3-5 drinks', 'possible snack'], usually_not_included: ['premium cocktails', 'club entry', 'taxi'], assumption: 'Bar or pub, average price' },
    comfortable: { expected_min_cost_cents: 5500, expected_max_cost_cents: 8000, cost_scope: 'per_person_per_night', includes: ['cocktails', 'bar food', 'possible entry'], usually_not_included: ['premium club', 'bottle service'], assumption: 'Cocktail bar with food and possible cover' },
    flexible:    { expected_min_cost_cents: 8000, expected_max_cost_cents: 15000, cost_scope: 'per_person_per_night', includes: ['premium drinks', 'food', 'entry', 'transport'], usually_not_included: ['bottle service', 'VIP areas'], assumption: 'Long night, premium venues' },
  },
  market: {
    budget:      { expected_min_cost_cents: 1500, expected_max_cost_cents: 2200, cost_scope: 'per_shopping_trip', includes: ['bread', 'rice', 'eggs', 'chicken', 'basic fruits & vegs'], usually_not_included: ['imported cheese', 'wine', 'premium products'], assumption: 'Basic shop for 1-2 days, local brands' },
    balanced:    { expected_min_cost_cents: 2000, expected_max_cost_cents: 2800, cost_scope: 'per_shopping_trip', includes: ['staples + ready meals', 'coffee', 'snacks'], usually_not_included: ['gourmet products', 'expensive wine'], assumption: 'Normal shop for 1-2 days with convenience' },
    comfortable: { expected_min_cost_cents: 2500, expected_max_cost_cents: 3500, cost_scope: 'per_shopping_trip', includes: ['quality ingredients', 'cheese', 'simple wine'], usually_not_included: ['premium organics', 'truffles'], assumption: 'Good shop for cooking well' },
    flexible:    { expected_min_cost_cents: 3500, expected_max_cost_cents: 5500, cost_scope: 'per_shopping_trip', includes: ['premium ingredients', 'imported goods', 'wine'], usually_not_included: ['ultra-premium brands'], assumption: 'No budget limit at the market' },
  },
  restaurant: {
    budget:      { expected_min_cost_cents: 1200, expected_max_cost_cents: 2000, cost_scope: 'per_person_per_meal', includes: ['takeaway', 'fast casual', 'meal deal'], usually_not_included: ['drinks', 'dessert', 'starter'], assumption: 'Quick meal or simple pub' },
    balanced:    { expected_min_cost_cents: 2500, expected_max_cost_cents: 4000, cost_scope: 'per_person_per_meal', includes: ['casual restaurant', 'main course', 'possible drink'], usually_not_included: ['starter + dessert', 'cocktails'], assumption: 'Casual sit-down, average price' },
    comfortable: { expected_min_cost_cents: 4000, expected_max_cost_cents: 6000, cost_scope: 'per_person_per_meal', includes: ['nicer restaurant', 'drink', 'possible starter/dessert'], usually_not_included: ['tasting menu', 'premium wine'], assumption: 'Good restaurant with extras' },
    flexible:    { expected_min_cost_cents: 6000, expected_max_cost_cents: 12000, cost_scope: 'per_person_per_meal', includes: ['premium restaurant', 'full menu', 'drinks'], usually_not_included: ['Michelin', 'rare wines'], assumption: 'Special dinner, no price concern' },
  },
  outing: {
    budget:      { expected_min_cost_cents: 800, expected_max_cost_cents: 1500, cost_scope: 'per_person_per_day', includes: ['free attractions', 'parks', 'walking'], usually_not_included: ['paid museums', 'tours'], assumption: 'Free sightseeing and walking' },
    balanced:    { expected_min_cost_cents: 1800, expected_max_cost_cents: 3000, cost_scope: 'per_person_per_day', includes: ['museum or attraction + transport'], usually_not_included: ['private tours', 'premium experiences'], assumption: 'Main attraction with transport' },
    comfortable: { expected_min_cost_cents: 3000, expected_max_cost_cents: 5000, cost_scope: 'per_person_per_day', includes: ['attraction + guided tour or experience'], usually_not_included: ['VIP', 'premium skip-the-line'], assumption: 'Complete experience with guide' },
    flexible:    { expected_min_cost_cents: 5000, expected_max_cost_cents: 10000, cost_scope: 'per_person_per_day', includes: ['premium experiences', 'private tours'], usually_not_included: ['charter', 'helicopter'], assumption: 'Top experiences, no limits' },
  },
  transport: {
    budget:      { expected_min_cost_cents: 500, expected_max_cost_cents: 750, cost_scope: 'per_person_per_day', includes: ['bus/tram', 'lots of walking'], usually_not_included: ['peak-hour metro', 'taxi'], assumption: 'Bus only + lots of walking' },
    balanced:    { expected_min_cost_cents: 750, expected_max_cost_cents: 1000, cost_scope: 'per_person_per_day', includes: ['metro/tram/bus unlimited (daily cap)'], usually_not_included: ['taxi', 'Uber', 'bike rental'], assumption: 'Mixed public transport, full day' },
    comfortable: { expected_min_cost_cents: 1000, expected_max_cost_cents: 1800, cost_scope: 'per_person_per_day', includes: ['public transport + 1-2 short Uber/taxi'], usually_not_included: ['taxi everywhere', 'private transfers'], assumption: 'Public + convenience when needed' },
    flexible:    { expected_min_cost_cents: 1800, expected_max_cost_cents: 3500, cost_scope: 'per_person_per_day', includes: ['frequent taxi/Uber'], usually_not_included: ['private transfer', 'limo'], assumption: 'Taxi whenever, full comfort' },
  },
};

const MID_EUROPEAN: ClusterTable = {
  bar: {
    budget:      { expected_min_cost_cents: 1500, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_night', includes: ['2-3 beers or cañas'], usually_not_included: ['food', 'cocktails', 'entry'], assumption: 'Simple bar, local beers' },
    balanced:    { expected_min_cost_cents: 2500, expected_max_cost_cents: 4000, cost_scope: 'per_person_per_night', includes: ['3-5 drinks', 'possible tapas'], usually_not_included: ['premium cocktails', 'club entry'], assumption: 'Local bar night, average price' },
    comfortable: { expected_min_cost_cents: 4000, expected_max_cost_cents: 6000, cost_scope: 'per_person_per_night', includes: ['cocktails', 'tapas', 'possible entry'], usually_not_included: ['premium club', 'bottle service'], assumption: 'Cocktail bar with food' },
    flexible:    { expected_min_cost_cents: 6000, expected_max_cost_cents: 10000, cost_scope: 'per_person_per_night', includes: ['premium drinks', 'food', 'entry', 'transport'], usually_not_included: ['VIP'], assumption: 'Long night, no limits' },
  },
  market: {
    budget:      { expected_min_cost_cents: 1000, expected_max_cost_cents: 1800, cost_scope: 'per_shopping_trip', includes: ['bread', 'rice', 'eggs', 'chicken', 'fruits', 'vegs'], usually_not_included: ['imported cheese', 'wine'], assumption: 'Basic shop for 1-2 days' },
    balanced:    { expected_min_cost_cents: 1500, expected_max_cost_cents: 2500, cost_scope: 'per_shopping_trip', includes: ['staples + ready meals', 'coffee', 'snacks'], usually_not_included: ['gourmet products'], assumption: 'Normal shop for 1-2 days' },
    comfortable: { expected_min_cost_cents: 2000, expected_max_cost_cents: 3200, cost_scope: 'per_shopping_trip', includes: ['quality ingredients', 'simple wine'], usually_not_included: ['premium organics'], assumption: 'Good shop' },
    flexible:    { expected_min_cost_cents: 3000, expected_max_cost_cents: 4500, cost_scope: 'per_shopping_trip', includes: ['premium ingredients', 'imported'], usually_not_included: ['ultra-premium'], assumption: 'No restriction' },
  },
  restaurant: {
    budget:      { expected_min_cost_cents: 800, expected_max_cost_cents: 1500, cost_scope: 'per_person_per_meal', includes: ['menú del día', 'fast casual', 'kebab'], usually_not_included: ['drinks', 'dessert'], assumption: 'Budget meal' },
    balanced:    { expected_min_cost_cents: 1500, expected_max_cost_cents: 2800, cost_scope: 'per_person_per_meal', includes: ['casual restaurant', 'main + drink'], usually_not_included: ['starter + dessert'], assumption: 'Sit-down, affordable' },
    comfortable: { expected_min_cost_cents: 2800, expected_max_cost_cents: 4500, cost_scope: 'per_person_per_meal', includes: ['good restaurant', 'drink', 'possible starter'], usually_not_included: ['tasting', 'premium wine'], assumption: 'Quality dinner' },
    flexible:    { expected_min_cost_cents: 4500, expected_max_cost_cents: 8000, cost_scope: 'per_person_per_meal', includes: ['top restaurant', 'full menu'], usually_not_included: ['Michelin'], assumption: 'No price concern' },
  },
  outing: {
    budget:      { expected_min_cost_cents: 500, expected_max_cost_cents: 1200, cost_scope: 'per_person_per_day', includes: ['free attractions', 'beaches', 'walking'], usually_not_included: ['paid museums', 'tours'], assumption: 'Free exploration' },
    balanced:    { expected_min_cost_cents: 1200, expected_max_cost_cents: 2200, cost_scope: 'per_person_per_day', includes: ['museum or attraction + transport'], usually_not_included: ['private tours'], assumption: 'Attraction with transport' },
    comfortable: { expected_min_cost_cents: 2200, expected_max_cost_cents: 3500, cost_scope: 'per_person_per_day', includes: ['attraction + tour or experience'], usually_not_included: ['VIP'], assumption: 'Complete experience' },
    flexible:    { expected_min_cost_cents: 3500, expected_max_cost_cents: 7000, cost_scope: 'per_person_per_day', includes: ['premium experiences'], usually_not_included: ['charter'], assumption: 'No limits' },
  },
  transport: {
    budget:      { expected_min_cost_cents: 300, expected_max_cost_cents: 500, cost_scope: 'per_person_per_day', includes: ['bus/tram', 'lots of walking'], usually_not_included: ['frequent metro', 'taxi'], assumption: 'Bus + walking' },
    balanced:    { expected_min_cost_cents: 500, expected_max_cost_cents: 800, cost_scope: 'per_person_per_day', includes: ['metro/tram/bus (T-Casual or similar)'], usually_not_included: ['taxi', 'Uber'], assumption: 'Full day public transport' },
    comfortable: { expected_min_cost_cents: 800, expected_max_cost_cents: 1500, cost_scope: 'per_person_per_day', includes: ['public + 1-2 taxi/Uber'], usually_not_included: ['frequent taxi'], assumption: 'Public + convenience' },
    flexible:    { expected_min_cost_cents: 1500, expected_max_cost_cents: 3000, cost_scope: 'per_person_per_day', includes: ['frequent taxi/Uber'], usually_not_included: ['private transfer'], assumption: 'Full comfort' },
  },
};

const CHEAP_ASIAN: ClusterTable = {
  bar: {
    budget:      { expected_min_cost_cents: 500, expected_max_cost_cents: 1000, cost_scope: 'per_person_per_night', includes: ['2-3 local beers at simple bar'], usually_not_included: ['cocktails', 'rooftop', 'food'], assumption: 'Local bar, cheap beers' },
    balanced:    { expected_min_cost_cents: 1000, expected_max_cost_cents: 1800, cost_scope: 'per_person_per_night', includes: ['3-5 drinks', 'possible snack'], usually_not_included: ['rooftop cocktails', 'club'], assumption: 'Tourist-area bar or nicer local' },
    comfortable: { expected_min_cost_cents: 1800, expected_max_cost_cents: 3000, cost_scope: 'per_person_per_night', includes: ['cocktails', 'food', 'nicer bar'], usually_not_included: ['premium rooftop', 'bottle service'], assumption: 'Cocktail bar with food' },
    flexible:    { expected_min_cost_cents: 3000, expected_max_cost_cents: 6000, cost_scope: 'per_person_per_night', includes: ['rooftop bar', 'premium cocktails'], usually_not_included: ['VIP bottle service'], assumption: 'Premium night, no limits' },
  },
  market: {
    budget:      { expected_min_cost_cents: 400, expected_max_cost_cents: 800, cost_scope: 'per_shopping_trip', includes: ['rice', 'eggs', 'vegs', 'local fruits'], usually_not_included: ['imported products', 'western brands'], assumption: 'Basic local market' },
    balanced:    { expected_min_cost_cents: 700, expected_max_cost_cents: 1200, cost_scope: 'per_shopping_trip', includes: ['staples + ready meals', 'snacks', 'coffee'], usually_not_included: ['cheese', 'wine', 'organics'], assumption: 'Mix local + convenience' },
    comfortable: { expected_min_cost_cents: 1000, expected_max_cost_cents: 1800, cost_scope: 'per_shopping_trip', includes: ['quality ingredients', 'imported items'], usually_not_included: ['premium organics'], assumption: 'Good supermarket (Tops, Big C)' },
    flexible:    { expected_min_cost_cents: 1500, expected_max_cost_cents: 3000, cost_scope: 'per_shopping_trip', includes: ['anything', 'Villa Market level'], usually_not_included: ['ultra-premium'], assumption: 'No restriction' },
  },
  restaurant: {
    budget:      { expected_min_cost_cents: 200, expected_max_cost_cents: 500, cost_scope: 'per_person_per_meal', includes: ['street food', 'food court'], usually_not_included: ['special drinks', 'dessert'], assumption: 'Pad thai, noodle soup, rice & curry' },
    balanced:    { expected_min_cost_cents: 500, expected_max_cost_cents: 1000, cost_scope: 'per_person_per_meal', includes: ['local restaurant', 'main + drink'], usually_not_included: ['western restaurant'], assumption: 'Sit-down local restaurant' },
    comfortable: { expected_min_cost_cents: 1000, expected_max_cost_cents: 1800, cost_scope: 'per_person_per_meal', includes: ['nicer restaurant', 'drink', 'maybe dessert'], usually_not_included: ['fine dining'], assumption: 'Casual international restaurant' },
    flexible:    { expected_min_cost_cents: 1800, expected_max_cost_cents: 4000, cost_scope: 'per_person_per_meal', includes: ['premium restaurant', 'full menu'], usually_not_included: ['Michelin', 'tasting'], assumption: 'No concern' },
  },
  outing: {
    budget:      { expected_min_cost_cents: 200, expected_max_cost_cents: 500, cost_scope: 'per_person_per_day', includes: ['free temples', 'markets', 'walking'], usually_not_included: ['paid entries', 'tours'], assumption: 'Free exploration' },
    balanced:    { expected_min_cost_cents: 500, expected_max_cost_cents: 1200, cost_scope: 'per_person_per_day', includes: ['paid temple or attraction + transport'], usually_not_included: ['private tours'], assumption: 'Main attraction with transport' },
    comfortable: { expected_min_cost_cents: 1200, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_day', includes: ['guided tour', 'experience'], usually_not_included: ['VIP', 'private boat'], assumption: 'Complete experience' },
    flexible:    { expected_min_cost_cents: 2500, expected_max_cost_cents: 5000, cost_scope: 'per_person_per_day', includes: ['premium experiences', 'private tours'], usually_not_included: ['charter'], assumption: 'No limits' },
  },
  transport: {
    budget:      { expected_min_cost_cents: 100, expected_max_cost_cents: 300, cost_scope: 'per_person_per_day', includes: ['BTS/MRT + bus', 'walking'], usually_not_included: ['taxi', 'Grab'], assumption: 'Public transport only' },
    balanced:    { expected_min_cost_cents: 250, expected_max_cost_cents: 500, cost_scope: 'per_person_per_day', includes: ['BTS/MRT + 1-2 short Grab'], usually_not_included: ['frequent Grab'], assumption: 'Public + Grab when needed' },
    comfortable: { expected_min_cost_cents: 500, expected_max_cost_cents: 1000, cost_scope: 'per_person_per_day', includes: ['frequent Grab', 'BTS/MRT'], usually_not_included: ['exclusive Grab'], assumption: 'Comfortable mix' },
    flexible:    { expected_min_cost_cents: 1000, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_day', includes: ['Grab/taxi for everything'], usually_not_included: ['private transfer'], assumption: 'Full comfort, no public transport' },
  },
};

const EXPENSIVE_ASIAN: ClusterTable = {
  bar: {
    budget:      { expected_min_cost_cents: 1500, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_night', includes: ['2-3 beers or simple drinks'], usually_not_included: ['cocktails', 'food'], assumption: 'Simple izakaya or bar' },
    balanced:    { expected_min_cost_cents: 2500, expected_max_cost_cents: 4500, cost_scope: 'per_person_per_night', includes: ['3-5 drinks', 'possible snack'], usually_not_included: ['premium cocktails', 'club'], assumption: 'Average bar night' },
    comfortable: { expected_min_cost_cents: 4500, expected_max_cost_cents: 8000, cost_scope: 'per_person_per_night', includes: ['cocktails', 'food', 'nicer venue'], usually_not_included: ['VIP', 'bottle service'], assumption: 'Cocktail bar with food' },
    flexible:    { expected_min_cost_cents: 8000, expected_max_cost_cents: 15000, cost_scope: 'per_person_per_night', includes: ['premium venue', 'cocktails', 'food'], usually_not_included: ['VIP areas'], assumption: 'Premium night' },
  },
  market: {
    budget:      { expected_min_cost_cents: 800, expected_max_cost_cents: 1500, cost_scope: 'per_shopping_trip', includes: ['basic groceries', 'local produce'], usually_not_included: ['imported items'], assumption: 'Basic grocery shop' },
    balanced:    { expected_min_cost_cents: 1200, expected_max_cost_cents: 2200, cost_scope: 'per_shopping_trip', includes: ['staples + convenience'], usually_not_included: ['premium imported'], assumption: 'Normal shop' },
    comfortable: { expected_min_cost_cents: 2000, expected_max_cost_cents: 3000, cost_scope: 'per_shopping_trip', includes: ['quality ingredients'], usually_not_included: ['ultra-premium'], assumption: 'Good supermarket' },
    flexible:    { expected_min_cost_cents: 3000, expected_max_cost_cents: 5000, cost_scope: 'per_shopping_trip', includes: ['premium ingredients'], usually_not_included: ['ultra-premium'], assumption: 'No restriction' },
  },
  restaurant: {
    budget:      { expected_min_cost_cents: 600, expected_max_cost_cents: 1200, cost_scope: 'per_person_per_meal', includes: ['ramen', 'rice bowl', 'fast casual'], usually_not_included: ['drinks', 'dessert'], assumption: 'Budget meal' },
    balanced:    { expected_min_cost_cents: 1200, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_meal', includes: ['casual restaurant', 'main + drink'], usually_not_included: ['sushi omakase'], assumption: 'Casual sit-down' },
    comfortable: { expected_min_cost_cents: 2500, expected_max_cost_cents: 5000, cost_scope: 'per_person_per_meal', includes: ['nicer restaurant', 'starter or dessert'], usually_not_included: ['fine dining'], assumption: 'Good restaurant' },
    flexible:    { expected_min_cost_cents: 5000, expected_max_cost_cents: 12000, cost_scope: 'per_person_per_meal', includes: ['premium restaurant', 'full menu'], usually_not_included: ['Michelin multi-course'], assumption: 'Special dinner' },
  },
  outing: {
    budget:      { expected_min_cost_cents: 500, expected_max_cost_cents: 1200, cost_scope: 'per_person_per_day', includes: ['free sights', 'shrines', 'walking'], usually_not_included: ['paid attractions', 'tours'], assumption: 'Free exploration' },
    balanced:    { expected_min_cost_cents: 1200, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_day', includes: ['attraction + transport'], usually_not_included: ['private tours'], assumption: 'Main attraction' },
    comfortable: { expected_min_cost_cents: 2500, expected_max_cost_cents: 4500, cost_scope: 'per_person_per_day', includes: ['attraction + tour'], usually_not_included: ['VIP'], assumption: 'Full experience' },
    flexible:    { expected_min_cost_cents: 4500, expected_max_cost_cents: 10000, cost_scope: 'per_person_per_day', includes: ['premium experiences'], usually_not_included: ['charter'], assumption: 'No limits' },
  },
  transport: {
    budget:      { expected_min_cost_cents: 400, expected_max_cost_cents: 800, cost_scope: 'per_person_per_day', includes: ['subway/bus', 'walking'], usually_not_included: ['taxi'], assumption: 'Public transport only' },
    balanced:    { expected_min_cost_cents: 700, expected_max_cost_cents: 1200, cost_scope: 'per_person_per_day', includes: ['subway/bus + day pass'], usually_not_included: ['taxi', 'ride-hail'], assumption: 'Full day public' },
    comfortable: { expected_min_cost_cents: 1000, expected_max_cost_cents: 2000, cost_scope: 'per_person_per_day', includes: ['public + 1-2 taxi'], usually_not_included: ['frequent taxi'], assumption: 'Public + convenience' },
    flexible:    { expected_min_cost_cents: 2000, expected_max_cost_cents: 4000, cost_scope: 'per_person_per_day', includes: ['taxi/ride-hail frequent'], usually_not_included: ['private transfer'], assumption: 'Full comfort' },
  },
};

const NORTH_AMERICA: ClusterTable = {
  bar: {
    budget:      { expected_min_cost_cents: 2000, expected_max_cost_cents: 3500, cost_scope: 'per_person_per_night', includes: ['2-3 beers at a dive bar'], usually_not_included: ['food', 'cocktails', 'tips'], assumption: 'Dive bar or happy hour' },
    balanced:    { expected_min_cost_cents: 3500, expected_max_cost_cents: 5500, cost_scope: 'per_person_per_night', includes: ['3-5 drinks', 'possible appetizer'], usually_not_included: ['premium cocktails', 'club entry'], assumption: 'Average bar night + tips' },
    comfortable: { expected_min_cost_cents: 5500, expected_max_cost_cents: 9000, cost_scope: 'per_person_per_night', includes: ['cocktails', 'food', 'possible entry'], usually_not_included: ['premium club', 'bottle service'], assumption: 'Cocktail bar + food' },
    flexible:    { expected_min_cost_cents: 9000, expected_max_cost_cents: 18000, cost_scope: 'per_person_per_night', includes: ['premium venues', 'cocktails', 'food', 'entry'], usually_not_included: ['bottle service'], assumption: 'Premium night' },
  },
  market: {
    budget:      { expected_min_cost_cents: 1500, expected_max_cost_cents: 2500, cost_scope: 'per_shopping_trip', includes: ['basics', 'store-brand items'], usually_not_included: ['organic', 'specialty'], assumption: 'Walmart/budget store' },
    balanced:    { expected_min_cost_cents: 2000, expected_max_cost_cents: 3000, cost_scope: 'per_shopping_trip', includes: ['staples + convenience'], usually_not_included: ['premium brands'], assumption: 'Regular grocery store' },
    comfortable: { expected_min_cost_cents: 2800, expected_max_cost_cents: 4000, cost_scope: 'per_shopping_trip', includes: ['quality ingredients', 'wine'], usually_not_included: ['ultra-premium'], assumption: 'Whole Foods level' },
    flexible:    { expected_min_cost_cents: 4000, expected_max_cost_cents: 6000, cost_scope: 'per_shopping_trip', includes: ['premium everything'], usually_not_included: ['ultra-premium'], assumption: 'No restriction' },
  },
  restaurant: {
    budget:      { expected_min_cost_cents: 1000, expected_max_cost_cents: 1800, cost_scope: 'per_person_per_meal', includes: ['fast casual', 'food truck', 'diner'], usually_not_included: ['drinks', 'tip over 15%'], assumption: 'Budget meal + tip' },
    balanced:    { expected_min_cost_cents: 1800, expected_max_cost_cents: 3500, cost_scope: 'per_person_per_meal', includes: ['casual restaurant', 'main + drink + tip'], usually_not_included: ['appetizer + dessert'], assumption: 'Casual sit-down + 18% tip' },
    comfortable: { expected_min_cost_cents: 3500, expected_max_cost_cents: 6000, cost_scope: 'per_person_per_meal', includes: ['nicer restaurant', 'drink', 'tip'], usually_not_included: ['tasting menu'], assumption: 'Good restaurant + 20% tip' },
    flexible:    { expected_min_cost_cents: 6000, expected_max_cost_cents: 15000, cost_scope: 'per_person_per_meal', includes: ['premium restaurant', 'full menu', 'tip'], usually_not_included: ['Michelin multi-course'], assumption: 'Fine dining' },
  },
  outing: {
    budget:      { expected_min_cost_cents: 800, expected_max_cost_cents: 1500, cost_scope: 'per_person_per_day', includes: ['free attractions', 'parks'], usually_not_included: ['paid museums', 'tours'], assumption: 'Free exploration' },
    balanced:    { expected_min_cost_cents: 1500, expected_max_cost_cents: 3000, cost_scope: 'per_person_per_day', includes: ['museum or attraction + transport'], usually_not_included: ['private tours'], assumption: 'Main attraction' },
    comfortable: { expected_min_cost_cents: 3000, expected_max_cost_cents: 5000, cost_scope: 'per_person_per_day', includes: ['attraction + tour'], usually_not_included: ['VIP'], assumption: 'Full experience' },
    flexible:    { expected_min_cost_cents: 5000, expected_max_cost_cents: 12000, cost_scope: 'per_person_per_day', includes: ['premium experiences'], usually_not_included: ['charter'], assumption: 'No limits' },
  },
  transport: {
    budget:      { expected_min_cost_cents: 500, expected_max_cost_cents: 800, cost_scope: 'per_person_per_day', includes: ['subway/bus'], usually_not_included: ['Uber', 'taxi'], assumption: 'Public transit only' },
    balanced:    { expected_min_cost_cents: 700, expected_max_cost_cents: 1200, cost_scope: 'per_person_per_day', includes: ['subway/bus + day pass'], usually_not_included: ['taxi', 'Uber'], assumption: 'Full day public' },
    comfortable: { expected_min_cost_cents: 1200, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_day', includes: ['public + 1-2 Uber/Lyft'], usually_not_included: ['frequent taxi'], assumption: 'Public + ride-hail' },
    flexible:    { expected_min_cost_cents: 2500, expected_max_cost_cents: 5000, cost_scope: 'per_person_per_day', includes: ['Uber/Lyft frequent'], usually_not_included: ['private car service'], assumption: 'Ride-hail comfort' },
  },
};

const LATIN_AMERICA: ClusterTable = {
  bar: {
    budget:      { expected_min_cost_cents: 500, expected_max_cost_cents: 1000, cost_scope: 'per_person_per_night', includes: ['2-3 local beers'], usually_not_included: ['food', 'cocktails'], assumption: 'Simple bar, local beers' },
    balanced:    { expected_min_cost_cents: 1000, expected_max_cost_cents: 2000, cost_scope: 'per_person_per_night', includes: ['3-5 drinks', 'possible snack'], usually_not_included: ['premium cocktails', 'club'], assumption: 'Average bar night' },
    comfortable: { expected_min_cost_cents: 2000, expected_max_cost_cents: 3500, cost_scope: 'per_person_per_night', includes: ['cocktails', 'food', 'bar'], usually_not_included: ['VIP', 'bottle service'], assumption: 'Cocktail bar with food' },
    flexible:    { expected_min_cost_cents: 3500, expected_max_cost_cents: 7000, cost_scope: 'per_person_per_night', includes: ['premium drinks', 'food', 'entry'], usually_not_included: ['VIP'], assumption: 'Premium night' },
  },
  market: {
    budget:      { expected_min_cost_cents: 400, expected_max_cost_cents: 800, cost_scope: 'per_shopping_trip', includes: ['basics', 'local produce'], usually_not_included: ['imported items'], assumption: 'Basic local market' },
    balanced:    { expected_min_cost_cents: 700, expected_max_cost_cents: 1200, cost_scope: 'per_shopping_trip', includes: ['staples + convenience'], usually_not_included: ['gourmet products'], assumption: 'Normal shop' },
    comfortable: { expected_min_cost_cents: 1000, expected_max_cost_cents: 1800, cost_scope: 'per_shopping_trip', includes: ['quality ingredients'], usually_not_included: ['premium organic'], assumption: 'Good supermarket' },
    flexible:    { expected_min_cost_cents: 1500, expected_max_cost_cents: 3000, cost_scope: 'per_shopping_trip', includes: ['premium ingredients'], usually_not_included: ['ultra-premium'], assumption: 'No restriction' },
  },
  restaurant: {
    budget:      { expected_min_cost_cents: 300, expected_max_cost_cents: 700, cost_scope: 'per_person_per_meal', includes: ['comida corrida', 'street food'], usually_not_included: ['drinks', 'dessert'], assumption: 'Budget meal' },
    balanced:    { expected_min_cost_cents: 700, expected_max_cost_cents: 1500, cost_scope: 'per_person_per_meal', includes: ['casual restaurant', 'main + drink'], usually_not_included: ['appetizer + dessert'], assumption: 'Casual sit-down' },
    comfortable: { expected_min_cost_cents: 1500, expected_max_cost_cents: 3000, cost_scope: 'per_person_per_meal', includes: ['nicer restaurant', 'drink', 'starter/dessert'], usually_not_included: ['fine dining'], assumption: 'Good restaurant' },
    flexible:    { expected_min_cost_cents: 3000, expected_max_cost_cents: 6000, cost_scope: 'per_person_per_meal', includes: ['premium restaurant', 'full menu'], usually_not_included: ['Michelin'], assumption: 'No price concern' },
  },
  outing: {
    budget:      { expected_min_cost_cents: 300, expected_max_cost_cents: 800, cost_scope: 'per_person_per_day', includes: ['free attractions', 'parks'], usually_not_included: ['paid museums', 'tours'], assumption: 'Free exploration' },
    balanced:    { expected_min_cost_cents: 800, expected_max_cost_cents: 1500, cost_scope: 'per_person_per_day', includes: ['museum or attraction + transport'], usually_not_included: ['private tours'], assumption: 'Main attraction' },
    comfortable: { expected_min_cost_cents: 1500, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_day', includes: ['attraction + tour'], usually_not_included: ['VIP'], assumption: 'Full experience' },
    flexible:    { expected_min_cost_cents: 2500, expected_max_cost_cents: 5000, cost_scope: 'per_person_per_day', includes: ['premium experiences'], usually_not_included: ['charter'], assumption: 'No limits' },
  },
  transport: {
    budget:      { expected_min_cost_cents: 100, expected_max_cost_cents: 300, cost_scope: 'per_person_per_day', includes: ['metro/bus'], usually_not_included: ['taxi'], assumption: 'Public transport only' },
    balanced:    { expected_min_cost_cents: 250, expected_max_cost_cents: 500, cost_scope: 'per_person_per_day', includes: ['metro/bus + 1-2 Uber'], usually_not_included: ['frequent Uber'], assumption: 'Public + ride-hail' },
    comfortable: { expected_min_cost_cents: 500, expected_max_cost_cents: 1200, cost_scope: 'per_person_per_day', includes: ['frequent Uber'], usually_not_included: ['exclusive Uber'], assumption: 'Mix comfortable' },
    flexible:    { expected_min_cost_cents: 1200, expected_max_cost_cents: 2500, cost_scope: 'per_person_per_day', includes: ['Uber/taxi for everything'], usually_not_included: ['private car'], assumption: 'Full comfort' },
  },
};

const ENRICHMENT_TABLE: Record<DestinationCluster, ClusterTable> = {
  expensive_european: EXPENSIVE_EUROPEAN,
  mid_european: MID_EUROPEAN,
  cheap_asian: CHEAP_ASIAN,
  expensive_asian: EXPENSIVE_ASIAN,
  north_america: NORTH_AMERICA,
  latin_america: LATIN_AMERICA,
};

export function getEnrichmentData(
  cluster: DestinationCluster,
  type: string,
  level: string,
): EnrichmentData | null {
  const clusterData = ENRICHMENT_TABLE[cluster];
  if (!clusterData) return null;
  const typeData = clusterData[type as ActivityType];
  if (!typeData) return null;
  return typeData[level as SpendingLevel] ?? null;
}

export function enrichActivity(
  activity: AIPlanActivity,
  cluster: DestinationCluster,
): EnrichedPlanActivity {
  const data = getEnrichmentData(cluster, activity.type, activity.spending_level);
  if (!data) {
    return {
      ...activity,
      expected_min_cost_cents: activity.typical_cost_cents,
      expected_max_cost_cents: activity.typical_cost_cents,
      cost_scope: 'per_unit',
      includes: [],
      usually_not_included: [],
      assumption: '',
    };
  }
  return { ...activity, ...data };
}
