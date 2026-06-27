/**
 * DEC-293 (M03/M10): which top-of-home alerts to show, and in what order, as a
 * single rotating slot instead of a stack. Pure — unit-tested in isolation.
 *
 * The rule that keeps the first glance calm: the DEMO never shows "fear" banners
 * (storage-loss / location notice) — only the informational "you're in demo"
 * notice. A real install shows the urgent storage risk first, then the one-time
 * location-default disclosure. Nothing is removed (Â9): every active alert is one
 * swipe/dot away in the carousel.
 */
export type HomeAlertId = 'demo' | 'storage_warning' | 'location_notice';

export interface HomeAlertConditions {
  /** The active space is demo data. */
  isDemo: boolean;
  /** Real browser-eviction risk (already gated for native/iOS-standalone). */
  storageAtRisk: boolean;
  /** First-run location-default notice still unacknowledged. */
  locationNoticeActive: boolean;
  /**
   * DEC-380: the dedicated `InstallNudge` banner is currently showing. When it
   * is, the carousel's install-flavored storage card duplicates it — so we drop
   * the card unless it is a genuine backup prompt (see `backupCtaActive`).
   */
  installNudgeActive: boolean;
  /**
   * DEC-380: the storage card is a real "back up your data" prompt (existing
   * data to protect), a concern distinct from installing — kept even while the
   * install nudge shows.
   */
  backupCtaActive: boolean;
}

export function selectHomeAlertIds(c: HomeAlertConditions): HomeAlertId[] {
  // In demo, only the calm informational notice — never a fear banner.
  if (c.isDemo) return ['demo'];
  const ids: HomeAlertId[] = [];
  // DEC-380: data-loss risk leads, BUT when the InstallNudge already owns the
  // install prompt the card is a redundant second "install to protect your
  // data" — drop it, unless it is a real backup prompt (distinct action).
  if (c.storageAtRisk && (c.backupCtaActive || !c.installNudgeActive)) {
    ids.push('storage_warning');
  }
  // Then the one-time transparency notice.
  if (c.locationNoticeActive) ids.push('location_notice');
  return ids;
}
