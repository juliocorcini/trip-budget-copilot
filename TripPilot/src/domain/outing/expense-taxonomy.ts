/**
 * DEC-095 (R-13): data-driven expense taxonomy per outing type.
 *
 * The field report was explicit: inside a BAR outing the app must ask
 * bar things (drink, beer, food...), not outing types. Each subcategory
 * carries a typical EUR value so the options can be sorted by proximity
 * to the amount the user just logged.
 */

export interface ExpenseSubcategory {
  /** Globally unique — prefixed with the taxonomy key (e.g. `bar_drink`). */
  id: string;
  /** i18n: `taxonomy.<id>` */
  labelKey: string;
  icon: string;
  typicalCents: number;
}

function sub(id: string, icon: string, typicalCents: number): ExpenseSubcategory {
  return { id, labelKey: `taxonomy.${id}`, icon, typicalCents };
}

/**
 * Keyed by ActivityProfile.category (R2 preset catalog) plus the event
 * contexts (`tickets`) and the generic fallback.
 */
const EXPENSE_TAXONOMY: Record<string, ExpenseSubcategory[]> = {
  bar: [
    sub('bar_drink', 'local_bar', 700),
    sub('bar_beer', 'sports_bar', 500),
    sub('bar_shot', 'liquor', 400),
    sub('bar_food', 'restaurant', 900),
    sub('bar_snack', 'lunch_dining', 500),
    sub('bar_cover', 'confirmation_number', 1000),
    sub('bar_games', 'sports_esports', 300),
    sub('bar_other', 'more_horiz', 500),
  ],
  restaurant: [
    sub('restaurant_dish', 'dinner_dining', 1200),
    sub('restaurant_drink', 'local_drink', 350),
    sub('restaurant_wine', 'wine_bar', 1800),
    sub('restaurant_dessert', 'icecream', 500),
    sub('restaurant_coffee', 'local_cafe', 200),
    sub('restaurant_starter', 'tapas', 600),
    sub('restaurant_tip', 'volunteer_activism', 200),
    sub('restaurant_other', 'more_horiz', 500),
  ],
  market: [
    sub('market_protein', 'kebab_dining', 800),
    sub('market_produce', 'nutrition', 400),
    sub('market_pasta_grains', 'rice_bowl', 300),
    sub('market_dairy', 'egg', 400),
    sub('market_bakery', 'bakery_dining', 250),
    sub('market_drinks', 'local_drink', 600),
    sub('market_snacks', 'cookie', 350),
    sub('market_cleaning', 'cleaning_services', 400),
    sub('market_hygiene', 'soap', 500),
    sub('market_other', 'more_horiz', 300),
  ],
  cafe: [
    sub('cafe_coffee', 'local_cafe', 250),
    sub('cafe_bread', 'bakery_dining', 150),
    sub('cafe_pastry', 'cake', 350),
    sub('cafe_juice', 'local_drink', 400),
    sub('cafe_sandwich', 'lunch_dining', 600),
    sub('cafe_brunch', 'brunch_dining', 1200),
    sub('cafe_other', 'more_horiz', 300),
  ],
  nightlife: [
    sub('nightlife_entry', 'confirmation_number', 1500),
    sub('nightlife_drink', 'local_bar', 900),
    sub('nightlife_beer', 'sports_bar', 600),
    sub('nightlife_shot', 'liquor', 500),
    sub('nightlife_food', 'lunch_dining', 800),
    sub('nightlife_coat_check', 'checkroom', 200),
    sub('nightlife_night_ride', 'local_taxi', 1000),
    sub('nightlife_other', 'more_horiz', 500),
  ],
  transport: [
    sub('transport_bus', 'directions_bus', 250),
    sub('transport_train', 'train', 800),
    sub('transport_metro', 'subway', 180),
    sub('transport_taxi', 'local_taxi', 1200),
    sub('transport_bike', 'pedal_bike', 300),
    sub('transport_fuel', 'local_gas_station', 4000),
    sub('transport_toll', 'toll', 500),
    sub('transport_other', 'more_horiz', 400),
  ],
  accommodation: [
    sub('accommodation_night', 'hotel', 6000),
    sub('accommodation_fee', 'receipt_long', 1500),
    sub('accommodation_deposit', 'savings', 10000),
    sub('accommodation_laundry', 'local_laundry_service', 800),
    sub('accommodation_other', 'more_horiz', 1000),
  ],
  tours: [
    sub('tours_ticket', 'confirmation_number', 2500),
    sub('tours_guide', 'tour', 1000),
    sub('tours_transfer', 'airport_shuttle', 800),
    sub('tours_photo', 'photo_camera', 700),
    sub('tours_tip', 'volunteer_activism', 500),
    sub('tours_other', 'more_horiz', 600),
  ],
  museums: [
    sub('museums_ticket', 'confirmation_number', 1200),
    sub('museums_audioguide', 'headphones', 600),
    sub('museums_exhibition', 'palette', 800),
    sub('museums_souvenir', 'redeem', 900),
    sub('museums_other', 'more_horiz', 500),
  ],
  beach: [
    sub('beach_food', 'lunch_dining', 800),
    sub('beach_drink', 'local_drink', 400),
    sub('beach_chair', 'beach_access', 1000),
    sub('beach_ride', 'sailing', 1500),
    sub('beach_sunscreen', 'sunny', 900),
    sub('beach_other', 'more_horiz', 500),
  ],
  shopping: [
    sub('shopping_clothes', 'apparel', 2500),
    sub('shopping_souvenir', 'redeem', 1000),
    sub('shopping_gift', 'featured_seasonal_and_gifts', 2000),
    sub('shopping_electronics', 'devices', 5000),
    sub('shopping_accessories', 'watch', 1200),
    sub('shopping_other', 'more_horiz', 800),
  ],
  festival: [
    sub('festival_entry', 'confirmation_number', 3000),
    sub('festival_drink', 'local_bar', 900),
    sub('festival_beer', 'sports_bar', 700),
    sub('festival_food', 'lunch_dining', 1000),
    sub('festival_souvenir', 'redeem', 1500),
    sub('festival_ride', 'local_taxi', 1200),
    sub('festival_other', 'more_horiz', 600),
  ],
  sports: [
    sub('sports_ticket', 'confirmation_number', 2500),
    sub('sports_rental', 'snowboarding', 1500),
    sub('sports_class', 'sports', 3000),
    sub('sports_snack', 'water_drop', 400),
    sub('sports_other', 'more_horiz', 600),
  ],
  laundry: [
    sub('laundry_wash', 'local_laundry_service', 800),
    sub('laundry_dry', 'dry_cleaning', 400),
    sub('laundry_soap', 'soap', 200),
    sub('laundry_ironing', 'iron', 600),
    sub('laundry_other', 'more_horiz', 300),
  ],
  communication: [
    sub('communication_sim', 'sim_card', 1500),
    sub('communication_topup', 'mobile_friendly', 1000),
    sub('communication_wifi', 'wifi', 500),
    sub('communication_other', 'more_horiz', 500),
  ],
  health: [
    sub('health_medicine', 'medication', 1000),
    sub('health_pharmacy', 'local_pharmacy', 700),
    sub('health_doctor', 'stethoscope', 5000),
    sub('health_sunscreen', 'sunny', 900),
    sub('health_other', 'more_horiz', 600),
  ],
  /** Event context "entrada/ingressos" (R-17). */
  tickets: [
    sub('tickets_entry', 'confirmation_number', 1500),
    sub('tickets_show', 'theater_comedy', 3000),
    sub('tickets_party', 'celebration', 2000),
    sub('tickets_attraction', 'attractions', 1200),
    sub('tickets_other', 'more_horiz', 800),
  ],
};

/** Generic fallback — also the level-2 list of the "other" event context. */
const GENERIC_TAXONOMY: ExpenseSubcategory[] = [
  sub('generic_food', 'lunch_dining', 800),
  sub('generic_drink', 'local_drink', 400),
  sub('generic_transport', 'directions_bus', 600),
  sub('generic_entry', 'confirmation_number', 1200),
  sub('generic_souvenir', 'redeem', 1000),
  sub('generic_other', 'more_horiz', 500),
];

/** Subcategories for an outing type; unknown/null falls back to generic. */
export function getSubcategories(category: string | null): ExpenseSubcategory[] {
  if (category === null) return GENERIC_TAXONOMY;
  return EXPENSE_TAXONOMY[category] ?? GENERIC_TAXONOMY;
}

/**
 * DEC-095: typing €3 shows the options around €3 first; €10 shows the
 * ones around €10 first. Stable for equal distances (catalog order).
 */
export function sortSubcategoriesByProximity(
  subcategories: ExpenseSubcategory[],
  amountCents: number,
): ExpenseSubcategory[] {
  if (amountCents <= 0) return subcategories;
  return [...subcategories].sort(
    (a, b) =>
      Math.abs(a.typicalCents - amountCents) - Math.abs(b.typicalCents - amountCents),
  );
}

const ALL_SUBCATEGORIES = new Map(
  [...Object.values(EXPENSE_TAXONOMY).flat(), ...GENERIC_TAXONOMY].map((s) => [s.id, s]),
);

/** Global lookup — for rendering a stored subcategoryId anywhere. */
export function findSubcategory(id: string | null): ExpenseSubcategory | null {
  if (id === null) return null;
  return ALL_SUBCATEGORIES.get(id) ?? null;
}

/**
 * DEC-096 (R-17): event sessions have no profile — ask WHERE first
 * (level 1, stored as Transaction.category), then the subcategories of
 * that context (level 2, stored as subcategoryId). `category` values
 * reuse the existing `categories.*` i18n labels.
 */
export interface EventContext {
  /** Stored as Transaction.category; label = `categories.<category>`. */
  category: string;
  /** Which taxonomy list backs level 2. */
  taxonomyKey: string;
  icon: string;
}

export const EVENT_CONTEXTS: EventContext[] = [
  { category: 'bar', taxonomyKey: 'bar', icon: 'local_bar' },
  { category: 'restaurant', taxonomyKey: 'restaurant', icon: 'restaurant' },
  { category: 'market', taxonomyKey: 'market', icon: 'shopping_cart' },
  { category: 'transport', taxonomyKey: 'transport', icon: 'directions_bus' },
  { category: 'gifts', taxonomyKey: 'shopping', icon: 'redeem' },
  { category: 'entertainment', taxonomyKey: 'tickets', icon: 'confirmation_number' },
  { category: 'other', taxonomyKey: 'generic', icon: 'more_horiz' },
];

/** Level-2 options for an event context. */
export function getSubcategoriesForContext(context: EventContext): ExpenseSubcategory[] {
  if (context.taxonomyKey === 'generic') return GENERIC_TAXONOMY;
  return EXPENSE_TAXONOMY[context.taxonomyKey] ?? GENERIC_TAXONOMY;
}
