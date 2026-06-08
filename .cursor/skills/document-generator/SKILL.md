---
name: document-generator
description: >-
  Generate professional PDF, Word (DOCX), and Excel (XLSX) documents for any project (Events, Streaming, Learn, Community).
  Use when the user asks: gere um PDF, crie um documento, faça um relatório, exporte para Excel,
  generate PDF, create document, make report, export to Excel, gere Word, crie planilha,
  relatório para reunião, documento para apresentação, or any document generation request.
---

# Document Generator (Multi-App)

## Overview

A Node.js-based document generation system at `.cursor/tools/doc-generator/` that creates
professional PDF, Word, and Excel files without Chromium or external dependencies.

Works for any app: Events, Streaming, Learn, Community. Output goes to `{App}/brain/documents/`.
All generated files are automatically copied to `C:\Users\julio\Downloads\` (Windows) for easy access.

## Language Rule

**Documents follow the language of the request.** If the user asks in Portuguese, the entire document
(headings, body text, table content) must be in Portuguese. If in English, in English. Code output
(variable names, function names, comments in scripts) remains in English regardless.

## Available Generators

| Module | Format | Library | Use for |
|---|---|---|---|
| `pdf-generator.js` | PDF | pdfmake | Reports, specs, meeting handouts |
| `word-generator.js` | DOCX | docx | Editable documents, proposals, specs |
| `excel-generator.js` | XLSX | exceljs | Data tables, financial models, tracking |

## How to Generate a Document

### Step 1: Create a generator script

Create a new file in `.cursor/tools/doc-generator/` following this pattern:

```javascript
const path = require('path');
const fs = require('fs');
const pdf = require('./pdf-generator');
const excel = require('./excel-generator');
const word = require('./word-generator');

const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'Events', 'brain', 'documents');
const WINDOWS_DIR = '/mnt/c/Users/julio/Downloads';

async function generate() {
  // Build content using the helper functions
  const content = [];
  content.push({ text: 'Document Title', style: 'docTitle' });
  content.push(pdf.metaBlock([['Date', '2026-04-09'], ['Author', 'Julio']]));
  content.push(pdf.sectionHeader('Section Name'));
  content.push(pdf.dataTable(['Col 1', 'Col 2'], [['data', 'data']]));
  content.push(pdf.bulletList(['Point 1', 'Point 2']));

  const outputPath = path.join(OUTPUT_DIR, 'my-document.pdf');
  await pdf.generatePdf({ content }, outputPath);

  // Auto-copy to Windows
  fs.copyFileSync(outputPath, path.join(WINDOWS_DIR, 'my-document.pdf'));
}

generate().catch(console.error);
```

### Step 2: Run the script

```bash
cd .cursor/tools/doc-generator && node my-script.js
```

## PDF Helper Functions

| Function | Purpose |
|---|---|
| `sectionHeader(text)` | Blue banner section title |
| `subsectionHeader(text)` | Underlined subsection title |
| `dataTable(headers, rows, options)` | Professional table with alternating rows |
| `bulletList(items)` | Styled bullet point list |
| `metaBlock(pairs)` | Key-value metadata block |
| `separator()` | Horizontal line divider |
| `generatePdf(docDefinition, outputPath)` | Generate the final PDF file |

### dataTable options
- `widths`: array of column widths (e.g., `[40, '*', 70]`)
- `firstColBold`: boolean, makes first column bold

## Excel Helper Functions

| Function | Purpose |
|---|---|
| `generateExcel(sheetConfigs, outputPath)` | Generate Excel with multiple sheets |

### sheetConfig structure
```javascript
{
  name: 'Sheet Name',
  title: 'Sheet Title',
  subtitle: 'Optional subtitle',
  columns: ['Col A', 'Col B'],
  rows: [['data1', 'data2']],
  columnWidths: [20, 30],
  // OR use sections for grouped data:
  sections: [{ header: 'Group', headers: ['A', 'B'], rows: [...] }]
}
```

## Word Helper Functions

| Function | Purpose |
|---|---|
| `heading(text, level)` | Heading (HEADING_1, HEADING_2, HEADING_3) |
| `bodyText(text)` | Normal paragraph |
| `bullet(text)` | Bullet point |
| `createTable(headers, rows)` | Professional table |
| `metaInfo(pairs)` | Key-value metadata |
| `sectionSeparator()` | Horizontal divider |
| `pageBreak()` | Force page break |
| `generateWord(sections, outputPath, options)` | Generate the final DOCX file |

## Existing Document Scripts

| Script | App | What it generates |
|---|---|---|
| `generate-use-cases.js` | Events | V1 Use Cases document (PDF + XLSX + DOCX) |
| `generate-master-document.js` | Events | Complete V1 Master Document (PDF) |
| `generate-marketing-analysis.js` | Events | Marketing Improvement Analysis (PDF, Portuguese) |

Run with: `node <script-name>.js [pdf|xlsx|docx|all]`

## Design Standards

All documents follow these visual standards:
- **Color scheme**: Navy headers (#1e3a5f), blue accents (#1e40af), alternating row backgrounds
- **Typography**: Roboto font family
- **Tables**: Header row with white text on dark background, alternating light gray rows
- **Footer**: "Events Project — Confidential" + page numbers
- **Paper**: A4 with balanced margins

## Output Locations

- Primary: `{App}/brain/documents/` (e.g., `Events/brain/documents/`, `Streaming/brain/documents/`)
- Research: `{App}/brain/research/` (for analysis and improvement reports)
- Auto-copy: `C:\Users\julio\Downloads\` (Windows accessible)

## Multi-App Usage

When creating a generator script for a different app, change the OUTPUT_DIR:

```javascript
// For Events:
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'Events', 'brain', 'documents');

// For Streaming (future):
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'Streaming', 'brain', 'documents');
```

The doc-generator tool itself is app-agnostic. Only the output path changes per app.
