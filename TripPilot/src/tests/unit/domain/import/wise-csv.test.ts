import { describe, it, expect } from 'vitest';
import {
  parseWiseCsv,
  parseCsvRecords,
  parseAmountCents,
  parseWiseDate,
} from '@/domain/import/wise-csv';

// DEC-200: the real Wise statement (statement_42969426_EUR…) — 23 columns,
// RFC4180-quoted, descriptions carrying commas ("7,39 EUR"). File 1 and 2 are
// byte-identical downloads; file 3 is header-only.
const HEADER =
  '"TransferWise ID",Date,"Date Time",Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees","Exchange To Amount","Transaction Type","Transaction Details Type"';

const ROWS = [
  'CARD-3927313014,15-06-2026,"15-06-2026 18:34:58.641",-7.39,EUR,"Transação por cartão de 7,39 EUR emitida por Dulcycor VILLATORO",,525.99,,,,,,,"Dulcycor VILLATORO",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'CARD-3922567943,14-06-2026,"14-06-2026 15:47:50.150",-5.20,EUR,"Transação por cartão de 5,20 EUR emitida por Confiteria Juarreno BURGOS",,533.38,,,,,,,"Confiteria Juarreno BURGOS",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'CARD-3915710063,13-06-2026,"13-06-2026 00:22:13.628",-10.40,EUR,"Transação por cartão de 10,40 EUR emitida por Taxi Iglesias Carton CAMPING DE FU",,538.58,,,,,,,"Taxi Iglesias Carton CAMPING DE FU",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'CARD-3915613973,12-06-2026,"12-06-2026 23:39:26.149",-5.50,EUR,"Transação por cartão de 5,50 EUR emitida por Delid0g VITORIA",,548.98,,,,,,,"Delid0g VITORIA",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'CARD-3914350459,12-06-2026,"12-06-2026 17:43:28.316",-9.00,EUR,"Transação por cartão de 9,00 EUR emitida por Pea Recreativa Castellan BURGOS",,554.48,,,,,,,"Pea Recreativa Castellan BURGOS",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'TRANSFER-2188321339,12-06-2026,"12-06-2026 16:25:15.689",-44.00,EUR,"Enviou dinheiro para Bruno Pessoa de Oliveira","parral + ivan",563.48,,,,,"Bruno Pessoa de Oliveira",35855771,,,,,,0.00,,DEBIT,TRANSFER',
  '"ACCRUAL_CHECKOUT-invoice-27912366",02-06-2026,"02-06-2026 14:19:05.702",-0.09,EUR,"Tarifa de serviços dos Investimentos de EUR",,607.48,,,,,,,,,,,,0.00,,DEBIT,ACCRUAL_CHARGE',
];

// Real files end with CRLF newlines and a trailing newline.
const STATEMENT = [HEADER, ...ROWS, ''].join('\r\n');
const HEADER_ONLY = `${HEADER}\r\n`;

describe('parseAmountCents', () => {
  it('parses Wise dot-decimal signed amounts to cents', () => {
    expect(parseAmountCents('-7.39')).toBe(-739);
    expect(parseAmountCents('563.48')).toBe(56348);
    expect(parseAmountCents('-0.09')).toBe(-9);
    expect(parseAmountCents('0.00')).toBe(0);
  });

  it('defensively handles comma-decimal and thousands separators', () => {
    expect(parseAmountCents('1.234,56')).toBe(123456); // EU: dot=thousands
    expect(parseAmountCents('1,234.56')).toBe(123456); // US: comma=thousands
    expect(parseAmountCents('1,5')).toBe(150); // comma-decimal
  });

  it('returns null for blank or non-numeric values', () => {
    expect(parseAmountCents('')).toBeNull();
    expect(parseAmountCents('   ')).toBeNull();
    expect(parseAmountCents('abc')).toBeNull();
  });
});

describe('parseWiseDate', () => {
  it('builds an ISO instant whose local day matches the statement', () => {
    const iso = parseWiseDate('15-06-2026', '15-06-2026 18:34:58.641');
    expect(iso).not.toBeNull();
    const d = new Date(iso!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-based)
    expect(d.getDate()).toBe(15);
  });

  it('anchors a date-only value at local noon (no day shift)', () => {
    const iso = parseWiseDate('02-06-2026', '');
    expect(iso).not.toBeNull();
    const d = new Date(iso!);
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(12);
  });

  it('returns null for an unrecognized format', () => {
    expect(parseWiseDate('2026/06/15', '')).toBeNull();
    expect(parseWiseDate('', '')).toBeNull();
  });
});

describe('parseCsvRecords (RFC4180)', () => {
  it('keeps commas inside quoted fields intact', () => {
    const records = parseCsvRecords('a,"b,c",d');
    expect(records).toEqual([['a', 'b,c', 'd']]);
  });

  it('unescapes doubled quotes', () => {
    const records = parseCsvRecords('"she said ""hi""",x');
    expect(records[0]).toEqual(['she said "hi"', 'x']);
  });

  it('handles a quoted newline and strips a leading BOM', () => {
    const records = parseCsvRecords('\uFEFF"line1\nline2",b\r\nc,d');
    expect(records).toEqual([['line1\nline2', 'b'], ['c', 'd']]);
  });
});

describe('parseWiseCsv', () => {
  it('parses every data row of the real statement', () => {
    const rows = parseWiseCsv(STATEMENT);
    expect(rows).toHaveLength(7);
  });

  it('maps the first card purchase by header name', () => {
    const [first] = parseWiseCsv(STATEMENT);
    expect(first).toMatchObject({
      id: 'CARD-3927313014',
      signedAmountCents: -739,
      currency: 'EUR',
      merchant: 'Dulcycor VILLATORO',
      transactionType: 'DEBIT',
      detailsType: 'CARD',
      cardLastFour: '8420',
      localDay: '2026-06-15',
    });
    // The comma inside the description must survive the parse.
    expect(first!.description).toContain('7,39 EUR');
  });

  it('maps a peer transfer (payee + reference, no merchant)', () => {
    const transfer = parseWiseCsv(STATEMENT).find((r) => r.id.startsWith('TRANSFER'));
    expect(transfer).toMatchObject({
      signedAmountCents: -4400,
      payeeName: 'Bruno Pessoa de Oliveira',
      paymentReference: 'parral + ivan',
      merchant: null,
      detailsType: 'TRANSFER',
    });
  });

  it('unquotes the accrual fee id and reads its details type', () => {
    const fee = parseWiseCsv(STATEMENT).find((r) => r.id.startsWith('ACCRUAL'));
    expect(fee).toMatchObject({
      id: 'ACCRUAL_CHECKOUT-invoice-27912366',
      signedAmountCents: -9,
      detailsType: 'ACCRUAL_CHARGE',
    });
  });

  it('returns no rows for a header-only or empty file', () => {
    expect(parseWiseCsv(HEADER_ONLY)).toHaveLength(0);
    expect(parseWiseCsv('')).toHaveLength(0);
  });
});
