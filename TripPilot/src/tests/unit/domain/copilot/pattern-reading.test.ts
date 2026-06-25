import { describe, it, expect } from 'vitest';
import {
  NEUTRAL_READING,
  readOutingEfficiency,
  readProjection,
  readForecastTrend,
  readRunway,
  readPhasePace,
} from '@/domain/copilot/pattern-reading';

describe('pattern-reading (C20) — good / watch / neutral reads', () => {
  it('outing efficiency: saving on average is good, overspending is a watch', () => {
    expect(readOutingEfficiency(1200).tone).toBe('good');
    expect(readOutingEfficiency(0).tone).toBe('good'); // exactly on target still good
    expect(readOutingEfficiency(-500).tone).toBe('watch');
  });

  it('projection: under budget is good, over is a watch', () => {
    expect(readProjection(false).tone).toBe('good');
    expect(readProjection(true).tone).toBe('watch');
  });

  it('forecast trend: improving is good, worsening is a watch', () => {
    expect(readForecastTrend('improving').tone).toBe('good');
    expect(readForecastTrend('worsening').tone).toBe('watch');
  });

  it('runway: covering the phase is good, running short is a watch', () => {
    expect(readRunway(true).tone).toBe('good');
    expect(readRunway(false).tone).toBe('watch');
  });

  it('phase pace: slower than before is good, faster is a watch, equal is neutral', () => {
    expect(readPhasePace(-15).tone).toBe('good');
    expect(readPhasePace(20).tone).toBe('watch');
    expect(readPhasePace(0).tone).toBe('neutral');
  });

  it('descriptive cards are always neutral', () => {
    expect(NEUTRAL_READING.tone).toBe('neutral');
  });

  it('never returns the alarming tone — watch is the strongest a pattern can be (DEC-299)', () => {
    const reads = [
      readOutingEfficiency(-9999),
      readProjection(true),
      readForecastTrend('worsening'),
      readRunway(false),
      readPhasePace(999),
    ];
    for (const r of reads) {
      expect(r.tone).not.toBe('error');
      expect(['good', 'watch', 'neutral']).toContain(r.tone);
    }
  });

  it('maps each tone to its own label key', () => {
    expect(readOutingEfficiency(10).labelKey).toBe('copilot.reading_good');
    expect(readRunway(false).labelKey).toBe('copilot.reading_watch');
    expect(NEUTRAL_READING.labelKey).toBe('copilot.reading_neutral');
  });
});
