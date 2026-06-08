const docx = require('docx');
const fs = require('fs');
const { Document, Paragraph, TextRun, Table, TableRow, TableCell, 
        WidthType, HeadingLevel, BorderStyle, AlignmentType,
        ShadingType, PageBreak } = docx;

const COLORS = {
  primary: '1e40af',
  headerBg: '1e3a5f',
  headerText: 'ffffff',
  altRowBg: 'f1f5f9',
  border: 'cbd5e1',
  text: '1e293b',
  textLight: '64748b',
  success: '059669',
  warning: 'd97706',
  danger: 'dc2626',
};

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
    run: { color: COLORS.primary },
  });
}

function bodyText(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, color: COLORS.text, ...options })],
    spacing: { after: 80 },
  });
}

function boldText(text) {
  return new TextRun({ text, bold: true, size: 20, color: COLORS.text });
}

function bullet(text, options = {}) {
  const children = typeof text === 'string' 
    ? [new TextRun({ text, size: 20, color: COLORS.text })]
    : text;
  return new Paragraph({
    children,
    bullet: { level: options.level || 0 },
    spacing: { after: 40 },
  });
}

function createTable(headers, rows) {
  const headerCells = headers.map(h => new TableCell({
    children: [new Paragraph({ 
      children: [new TextRun({ text: h, bold: true, size: 18, color: COLORS.headerText })],
      alignment: AlignmentType.CENTER,
    })],
    shading: { type: ShadingType.SOLID, color: COLORS.headerBg },
    verticalAlign: 'center',
  }));

  const dataRows = rows.map((row, rowIdx) => {
    const cells = row.map(cell => new TableCell({
      children: [new Paragraph({ 
        children: [new TextRun({ text: String(cell), size: 18, color: COLORS.text })],
      })],
      shading: rowIdx % 2 !== 0 
        ? { type: ShadingType.SOLID, color: COLORS.altRowBg } 
        : undefined,
      verticalAlign: 'center',
    }));
    return new TableRow({ children: cells });
  });

  return new Table({
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function metaInfo(pairs) {
  return pairs.map(([label, value]) => new Paragraph({
    children: [
      new TextRun({ text: label + ': ', bold: true, size: 18, color: COLORS.textLight }),
      new TextRun({ text: value, size: 18, color: COLORS.text }),
    ],
    spacing: { after: 40 },
  }));
}

function sectionSeparator() {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border } },
    spacing: { before: 120, after: 120 },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

async function generateWord(sections, outputPath, options = {}) {
  const doc = new Document({
    creator: 'Events Project Brain',
    title: options.title || 'Document',
    description: options.description || '',
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      children: sections.flat(),
    }],
  });

  const buffer = await docx.Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = {
  COLORS,
  heading,
  bodyText,
  boldText,
  bullet,
  createTable,
  metaInfo,
  sectionSeparator,
  pageBreak,
  generateWord,
  HeadingLevel,
  TextRun,
  Paragraph,
};
