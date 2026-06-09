export const CATEGORY_ICONS: Record<string, string> = {
  bar: 'local_bar',
  market: 'shopping_cart',
  restaurant: 'restaurant',
  outing: 'hiking',
  transport: 'directions_bus',
  festival: 'celebration',
  accommodation: 'hotel',
  health: 'healing',
  communication: 'wifi',
  clothing: 'apparel',
  gifts: 'redeem',
  entertainment: 'movie',
  home_day: 'home',
  special: 'star',
  cash_adjustment: 'local_atm',
  reconciliation: 'balance',
  other: 'more_horiz',
};

export function getCategoryIcon(category: string | null): string {
  if (!category) return 'category';
  return CATEGORY_ICONS[category] ?? 'category';
}

/** Icons offered when the user creates a custom profile/outing type. */
export const CUSTOM_PROFILE_ICONS: string[] = [
  'local_cafe',
  'local_laundry_service',
  'local_bar',
  'restaurant',
  'shopping_cart',
  'hiking',
  'directions_bus',
  'celebration',
  'star',
  'movie',
  'fitness_center',
  'museum',
  'beach_access',
  'shopping_bag',
  'sports_esports',
  'more_horiz',
];
