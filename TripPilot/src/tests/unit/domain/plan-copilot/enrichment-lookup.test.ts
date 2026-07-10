import { describe, it, expect } from 'vitest';
import { getClusterForCity, type DestinationCluster } from '@/domain/plan-copilot/city-clusters';
import {
  getEnrichmentData,
  enrichActivity,
  type AIPlanActivity,
} from '@/domain/plan-copilot/enrichment-lookup';

describe('getClusterForCity', () => {
  const cases: Array<[string, DestinationCluster]> = [
    ['Amsterdam', 'expensive_european'],
    ['amsterdam', 'expensive_european'],
    ['LONDON', 'expensive_european'],
    ['Paris, France', 'expensive_european'],
    ['Barcelona', 'mid_european'],
    ['Lisboa', 'mid_european'],
    ['Prague', 'mid_european'],
    ['Bangkok', 'cheap_asian'],
    ['Bali, Indonesia', 'cheap_asian'],
    ['Tokyo', 'expensive_asian'],
    ['Singapore', 'expensive_asian'],
    ['NYC', 'north_america'],
    ['New York City', 'north_america'],
    ['Toronto', 'north_america'],
    ['Buenos Aires', 'latin_america'],
    ['São Paulo', 'latin_america'],
    ['CDMX', 'latin_america'],
  ];

  it.each(cases)('"%s" → %s', (city, expected) => {
    expect(getClusterForCity(city)).toBe(expected);
  });

  it('returns mid_european as fallback for unknown cities', () => {
    expect(getClusterForCity('Unknown Place')).toBe('mid_european');
    expect(getClusterForCity('')).toBe('mid_european');
  });
});

describe('getEnrichmentData', () => {
  it('returns data for valid cluster/type/level', () => {
    const data = getEnrichmentData('expensive_european', 'bar', 'balanced');
    expect(data).not.toBeNull();
    expect(data!.expected_min_cost_cents).toBe(4000);
    expect(data!.expected_max_cost_cents).toBe(5500);
    expect(data!.cost_scope).toBe('per_person_per_night');
    expect(data!.includes.length).toBeGreaterThan(0);
    expect(data!.usually_not_included.length).toBeGreaterThan(0);
  });

  it('returns null for unknown activity type', () => {
    expect(getEnrichmentData('expensive_european', 'festival', 'balanced')).toBeNull();
  });

  it('returns null for unknown spending level', () => {
    expect(getEnrichmentData('expensive_european', 'bar', 'ultra')).toBeNull();
  });

  it('covers all 6 clusters with bar/balanced', () => {
    const clusters: DestinationCluster[] = [
      'expensive_european', 'mid_european', 'cheap_asian',
      'expensive_asian', 'north_america', 'latin_america',
    ];
    for (const cluster of clusters) {
      const data = getEnrichmentData(cluster, 'bar', 'balanced');
      expect(data, `missing data for ${cluster}`).not.toBeNull();
      expect(data!.expected_min_cost_cents).toBeGreaterThan(0);
      expect(data!.expected_max_cost_cents).toBeGreaterThan(data!.expected_min_cost_cents);
    }
  });

  it('covers all 5 types for mid_european/balanced', () => {
    const types = ['bar', 'market', 'restaurant', 'outing', 'transport'];
    for (const type of types) {
      const data = getEnrichmentData('mid_european', type, 'balanced');
      expect(data, `missing data for ${type}`).not.toBeNull();
    }
  });

  it('covers all 4 levels for cheap_asian/bar', () => {
    const levels = ['budget', 'balanced', 'comfortable', 'flexible'];
    for (const level of levels) {
      const data = getEnrichmentData('cheap_asian', 'bar', level);
      expect(data, `missing data for ${level}`).not.toBeNull();
    }
  });
});

describe('enrichActivity', () => {
  const activity: AIPlanActivity = {
    type: 'bar',
    spending_level: 'balanced',
    suggested_quantity: 3,
    typical_cost_cents: 4500,
    reasoning: 'Test reasoning',
  };

  it('merges enrichment data into the activity', () => {
    const enriched = enrichActivity(activity, 'expensive_european');
    expect(enriched.type).toBe('bar');
    expect(enriched.typical_cost_cents).toBe(4500);
    expect(enriched.expected_min_cost_cents).toBe(4000);
    expect(enriched.expected_max_cost_cents).toBe(5500);
    expect(enriched.cost_scope).toBe('per_person_per_night');
    expect(enriched.includes.length).toBeGreaterThan(0);
  });

  it('falls back gracefully for unknown type', () => {
    const unknown = { ...activity, type: 'festival' as never };
    const enriched = enrichActivity(unknown, 'mid_european');
    expect(enriched.expected_min_cost_cents).toBe(unknown.typical_cost_cents);
    expect(enriched.includes).toEqual([]);
  });
});
