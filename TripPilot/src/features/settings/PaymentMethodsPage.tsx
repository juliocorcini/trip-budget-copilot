import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { appSettingsRepository } from '@/data/repositories';
import {
  PAYMENT_METHOD_KINDS,
  PAYMENT_METHOD_ICONS,
  addPaymentMethod,
  removePaymentMethod,
  togglePaymentMethod,
  updatePaymentMethod,
  movePaymentMethod,
  buildPaymentInstructions,
  type PaymentMethod,
  type PaymentMethodKind,
} from '@/domain/payment';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';

/**
 * G4 (DEC-244): the owner publishes how people can pay them back — any mix of a
 * Pix key, a Wise tag, bank details or free text. Enabled methods are appended
 * to the "Lembrar/Cobrar" message (see useRemindMessage). The list is the
 * editing buffer; discrete events (add/toggle/reorder/delete) and text blur
 * persist the whole array to AppSettings (mirrors DashboardConfigPage).
 */
export function PaymentMethodsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [newKind, setNewKind] = useState<PaymentMethodKind>('pix');
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    void appSettingsRepository.get().then((s) => setMethods(s.paymentMethods));
  }, []);

  if (methods === null) return null;

  const persist = async (next: PaymentMethod[]) => {
    setMethods(next);
    await appSettingsRepository.update({ paymentMethods: next });
  };

  const kindLabel = (kind: PaymentMethodKind) => t(`payment.kind_${kind}` as never);
  const kindLabels: Record<PaymentMethodKind, string> = {
    pix: kindLabel('pix'),
    wise: kindLabel('wise'),
    bank: kindLabel('bank'),
    other: kindLabel('other'),
  };

  const handleAdd = async () => {
    if (newValue.trim() === '') {
      showToast(t('payment.value_required'), 'warning');
      return;
    }
    await persist(addPaymentMethod(methods, newKind, newLabel, newValue));
    setNewLabel('');
    setNewValue('');
    setNewKind('pix');
    showToast(t('payment.added'), 'success');
  };

  // Text edits update the local buffer on change and persist on blur, so the
  // input stays responsive without a DB write per keystroke.
  const editField = (id: string, fields: Partial<Pick<PaymentMethod, 'label' | 'value'>>) => {
    setMethods(updatePaymentMethod(methods, id, fields));
  };
  const persistEdits = () => {
    void appSettingsRepository.update({ paymentMethods: methods });
  };

  const preview = buildPaymentInstructions(methods, { header: t('shared.pay_via'), kindLabels });

  return (
    <div className="flex flex-col gap-4 pb-10 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('payment.title')}</h1>
      </div>

      <p className="text-xs text-on-surface-faint">{t('payment.hint')}</p>

      {/* Add form: kind chips + optional label + value. */}
      <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs text-on-surface-faint font-semibold">{t('payment.add_title')}</p>
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_METHOD_KINDS.map((kind) => (
            <button
              key={kind}
              onClick={() => setNewKind(kind)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1.5 ${
                newKind === kind ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              <Icon name={PAYMENT_METHOD_ICONS[kind]} size={14} />
              {kindLabel(kind)}
            </button>
          ))}
        </div>
        <input
          type="text"
          data-payment-add-value
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={t(`payment.value_placeholder_${newKind}` as never)}
          aria-label={t('payment.value_label')}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2.5 outline-none w-full"
        />
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={t('payment.label_placeholder', { kind: kindLabel(newKind) })}
          aria-label={t('payment.label_label')}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2.5 outline-none w-full"
        />
        <button
          onClick={handleAdd}
          data-payment-add-submit
          className="w-full px-3 py-2.5 rounded-lg bg-primary text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-2"
        >
          <Icon name="add" size={16} className="text-on-surface" />
          {t('payment.add')}
        </button>
      </div>

      {/* Existing methods. */}
      {methods.length === 0 ? (
        <p className="text-sm text-on-surface-dim text-center py-4">{t('payment.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {methods.map((method, index) => (
            <div
              key={method.id}
              data-payment-row
              className="bg-surface-container rounded-xl p-3 flex flex-col gap-2"
              style={method.enabled ? undefined : { opacity: 0.55 }}
            >
              <div className="flex items-center gap-2">
                <Icon
                  name={PAYMENT_METHOD_ICONS[method.kind]}
                  size={18}
                  className="text-on-surface-dim shrink-0"
                />
                <span className="text-xs font-semibold text-on-surface-faint flex-1">
                  {kindLabel(method.kind)}
                </span>
                <button
                  onClick={() => persist(movePaymentMethod(methods, method.id, 'up'))}
                  disabled={index === 0}
                  className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high disabled:opacity-30"
                  aria-label={t('payment.move_up')}
                >
                  <Icon name="arrow_upward" size={14} className="text-on-surface-dim" />
                </button>
                <button
                  onClick={() => persist(movePaymentMethod(methods, method.id, 'down'))}
                  disabled={index === methods.length - 1}
                  className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high disabled:opacity-30"
                  aria-label={t('payment.move_down')}
                >
                  <Icon name="arrow_downward" size={14} className="text-on-surface-dim" />
                </button>
                <button
                  onClick={() => persist(togglePaymentMethod(methods, method.id))}
                  className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high"
                  aria-label={method.enabled ? t('payment.disable') : t('payment.enable')}
                >
                  <Icon
                    name={method.enabled ? 'visibility' : 'visibility_off'}
                    size={14}
                    className={method.enabled ? 'text-primary' : 'text-on-surface-faint'}
                  />
                </button>
                <button
                  onClick={() => persist(removePaymentMethod(methods, method.id))}
                  className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high"
                  aria-label={t('common.delete')}
                >
                  <Icon name="delete" size={14} className="text-on-surface-faint" />
                </button>
              </div>
              <input
                type="text"
                value={method.value}
                onChange={(e) => editField(method.id, { value: e.target.value })}
                onBlur={persistEdits}
                placeholder={t(`payment.value_placeholder_${method.kind}` as never)}
                aria-label={t('payment.value_label')}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
              <input
                type="text"
                value={method.label}
                onChange={(e) => editField(method.id, { label: e.target.value })}
                onBlur={persistEdits}
                placeholder={t('payment.label_placeholder', { kind: kindLabel(method.kind) })}
                aria-label={t('payment.label_label')}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
            </div>
          ))}
        </div>
      )}

      {/* Live preview of what gets appended to the reminder. */}
      {preview && (
        <div className="bg-surface-container rounded-xl p-4" data-payment-preview>
          <p className="text-xs text-on-surface-faint font-semibold mb-2">{t('payment.preview_title')}</p>
          <p className="text-sm text-on-surface whitespace-pre-line">{preview}</p>
        </div>
      )}
    </div>
  );
}
