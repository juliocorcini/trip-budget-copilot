import { describe, it, expect } from 'vitest';
import { shareOutcomeToast } from '@/utils/share-card';

describe('shareOutcomeToast (C05/DEC-303 universal share feedback)', () => {
  it('shared → success toast', () => {
    expect(shareOutcomeToast('shared')).toEqual({
      messageKey: 'share.shared_toast',
      tone: 'success',
    });
  });

  it('downloaded → success toast (the desktop silent-download notice)', () => {
    expect(shareOutcomeToast('downloaded')).toEqual({
      messageKey: 'share.downloaded_toast',
      tone: 'success',
    });
  });

  it('failed → danger toast', () => {
    expect(shareOutcomeToast('failed')).toEqual({
      messageKey: 'share.failed_toast',
      tone: 'danger',
    });
  });

  it('aborted (user cancelled the OS sheet) → no toast', () => {
    expect(shareOutcomeToast('aborted')).toBeNull();
  });
});
