const pdfmake = require('pdfmake');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, 'node_modules/pdfmake/build/fonts/Roboto');
for (const f of fs.readdirSync(FONTS_DIR)) {
  pdfmake.virtualfs.storage[f] = fs.readFileSync(path.join(FONTS_DIR, f));
}
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  }
};

const COLORS = {
  primary: '#1e40af',
  primaryLight: '#3b82f6',
  headerBg: '#1e3a5f',
  headerText: '#ffffff',
  accent: '#f59e0b',
  lightBg: '#f8fafc',
  altRowBg: '#f1f5f9',
  border: '#cbd5e1',
  text: '#1e293b',
  textLight: '#64748b',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
};

function createStyles() {
  return {
    docTitle: { fontSize: 22, bold: true, color: COLORS.primary, margin: [0, 0, 0, 4] },
    docSubtitle: { fontSize: 10, color: COLORS.textLight, margin: [0, 0, 0, 2] },
    sectionHeader: { fontSize: 14, bold: true, color: '#ffffff', margin: [0, 16, 0, 8] },
    subsectionHeader: { fontSize: 11, bold: true, color: COLORS.primary, margin: [0, 10, 0, 4] },
    bodyText: { fontSize: 9.5, color: COLORS.text, lineHeight: 1.4 },
    smallText: { fontSize: 8.5, color: COLORS.textLight, lineHeight: 1.3 },
    bulletItem: { fontSize: 9.5, color: COLORS.text, lineHeight: 1.4, margin: [0, 1, 0, 1] },
    tableHeader: { fontSize: 8.5, bold: true, color: COLORS.headerText },
    tableCell: { fontSize: 8.5, color: COLORS.text },
    tableCellAlt: { fontSize: 8.5, color: COLORS.text },
    metaLabel: { fontSize: 9, bold: true, color: COLORS.textLight },
    metaValue: { fontSize: 9, color: COLORS.text },
  };
}

function sectionHeader(text) {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, style: 'sectionHeader', margin: [8, 4, 8, 4] }]]
    },
    layout: {
      fillColor: () => COLORS.headerBg,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0, paddingRight: () => 0,
      paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 14, 0, 8],
  };
}

function subsectionHeader(text) {
  return {
    text,
    style: 'subsectionHeader',
    decoration: 'underline',
    decorationColor: COLORS.border,
  };
}

function bulletList(items) {
  return {
    ul: items.map(item => ({ text: item, style: 'bulletItem' })),
    margin: [0, 2, 0, 6],
  };
}

function dataTable(headers, rows, options = {}) {
  const { widths, firstColBold } = options;
  const tableWidths = widths || headers.map((_, i) => i === 0 ? 'auto' : '*');

  const headerRow = headers.map(h => ({
    text: h, style: 'tableHeader', margin: [4, 3, 4, 3], fillColor: COLORS.headerBg,
  }));

  const bodyRows = rows.map((row, rowIdx) =>
    row.map((cell, colIdx) => ({
      text: String(cell),
      style: 'tableCell',
      bold: firstColBold && colIdx === 0,
      margin: [4, 2, 4, 2],
      fillColor: rowIdx % 2 !== 0 ? COLORS.altRowBg : null,
    }))
  );

  return {
    table: {
      headerRows: 1,
      widths: tableWidths,
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: (i) => i <= 1 ? COLORS.headerBg : COLORS.border,
      vLineColor: () => COLORS.border,
    },
    margin: [0, 4, 0, 8],
  };
}

function metaBlock(pairs) {
  return {
    columns: [
      {
        width: 'auto',
        stack: pairs.map(([label]) => ({ text: label + ':', style: 'metaLabel', margin: [0, 1, 8, 1] })),
      },
      {
        width: '*',
        stack: pairs.map(([, value]) => ({ text: value, style: 'metaValue', margin: [0, 1, 0, 1] })),
      },
    ],
    margin: [0, 0, 0, 8],
  };
}

function separator() {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: COLORS.border }],
    margin: [0, 6, 0, 6],
  };
}

async function generatePdf(docDefinition, outputPath) {
  const finalDef = {
    ...docDefinition,
    defaultStyle: { font: 'Roboto', fontSize: 10, color: COLORS.text, ...(docDefinition.defaultStyle || {}) },
    styles: { ...createStyles(), ...(docDefinition.styles || {}) },
    pageSize: docDefinition.pageSize || 'A4',
    pageMargins: docDefinition.pageMargins || [40, 40, 40, 40],
    footer: docDefinition.footer || function(currentPage, pageCount) {
      return {
        columns: [
          { text: docDefinition.footerLeft || 'Events Project — Confidential', style: 'smallText', margin: [40, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, style: 'smallText', alignment: 'right', margin: [0, 0, 40, 0] },
        ],
        margin: [0, 10, 0, 0],
      };
    },
  };

  const doc = pdfmake.createPdf(finalDef);
  const buffer = await doc.getBuffer();
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = {
  COLORS,
  createStyles,
  sectionHeader,
  subsectionHeader,
  bulletList,
  dataTable,
  metaBlock,
  separator,
  generatePdf,
};
