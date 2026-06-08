const ExcelJS = require('exceljs');

const COLORS = {
  primary: '1e40af',
  headerBg: '1e3a5f',
  headerText: 'ffffff',
  altRowBg: 'f1f5f9',
  lightBg: 'f8fafc',
  border: 'cbd5e1',
  accent: 'f59e0b',
  success: '059669',
  warning: 'd97706',
  danger: 'dc2626',
};

function applyHeaderStyle(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'medium', color: { argb: COLORS.headerBg } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };
  });
  row.height = 24;
}

function applyDataRowStyle(row, rowIndex) {
  row.eachCell((cell) => {
    cell.font = { size: 10, color: { argb: '1e293b' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.border } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };
    if (rowIndex % 2 !== 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRowBg } };
    }
  });
}

function addTitleRow(worksheet, title, colSpan) {
  const row = worksheet.addRow([title]);
  row.getCell(1).font = { bold: true, size: 14, color: { argb: COLORS.primary } };
  row.height = 28;
  if (colSpan > 1) {
    worksheet.mergeCells(row.number, 1, row.number, colSpan);
  }
  return row;
}

function addSubtitleRow(worksheet, subtitle, colSpan) {
  const row = worksheet.addRow([subtitle]);
  row.getCell(1).font = { size: 10, color: { argb: '64748b' }, italic: true };
  if (colSpan > 1) {
    worksheet.mergeCells(row.number, 1, row.number, colSpan);
  }
  return row;
}

function addSectionHeader(worksheet, text, colSpan) {
  worksheet.addRow([]);
  const row = worksheet.addRow([text]);
  row.getCell(1).font = { bold: true, size: 11, color: { argb: COLORS.headerText } };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
  row.height = 22;
  if (colSpan > 1) {
    worksheet.mergeCells(row.number, 1, row.number, colSpan);
    for (let i = 2; i <= colSpan; i++) {
      row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    }
  }
  return row;
}

async function generateExcel(sheetConfigs, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Events Project Brain';
  workbook.created = new Date();

  for (const config of sheetConfigs) {
    const ws = workbook.addWorksheet(config.name, {
      properties: { defaultColWidth: 15 },
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });

    if (config.title) {
      addTitleRow(ws, config.title, config.columns?.length || 5);
    }
    if (config.subtitle) {
      addSubtitleRow(ws, config.subtitle, config.columns?.length || 5);
    }
    if (config.title || config.subtitle) {
      ws.addRow([]);
    }

    if (config.sections) {
      for (const section of config.sections) {
        if (section.header) {
          addSectionHeader(ws, section.header, config.columns?.length || section.headers?.length || 5);
        }

        const headers = section.headers || config.columns;
        if (headers) {
          const headerRow = ws.addRow(headers);
          applyHeaderStyle(headerRow);
        }

        if (section.rows) {
          section.rows.forEach((row, idx) => {
            const dataRow = ws.addRow(row);
            applyDataRowStyle(dataRow, idx);
          });
        }
      }
    } else if (config.columns && config.rows) {
      const headerRow = ws.addRow(config.columns);
      applyHeaderStyle(headerRow);
      config.rows.forEach((row, idx) => {
        const dataRow = ws.addRow(row);
        applyDataRowStyle(dataRow, idx);
      });
    }

    if (config.columnWidths) {
      config.columnWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    } else {
      ws.columns.forEach(col => { col.width = Math.max(col.width || 12, 12); });
    }
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = {
  COLORS,
  generateExcel,
  applyHeaderStyle,
  applyDataRowStyle,
  addTitleRow,
  addSubtitleRow,
  addSectionHeader,
};
