const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const REPORT_MD_PATH = path.resolve(__dirname, '../../docs/PROJECT_REPORT.md');
const OUTPUT_PDF_PATH = path.resolve(__dirname, '../../docs/PROJECT_REPORT.pdf');
const ARTIFACT_PDF_PATH = 'C:\\Users\\gaura\\.gemini\\antigravity\\brain\\a10a50c3-7bda-4144-8b5a-ca64f121a980\\PROJECT_REPORT.pdf';

async function compileReportToPDF() {
  console.log('Reading report markdown...');
  let markdown = fs.readFileSync(REPORT_MD_PATH, 'utf-8');

  console.log('Converting Markdown to HTML...');
  const htmlBody = marked.parse(markdown);

  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CIPHERSHARE — Technical Project Report</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.48;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Centered Main Document Title (Matching Reference PDF) */
    h1:first-of-type {
      text-align: center;
      font-size: 20pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #1e3a8a;
      margin-top: 0;
      margin-bottom: 4px;
      border-bottom: none;
      padding-bottom: 0;
      text-transform: uppercase;
    }

    /* Subtitle directly below main title */
    h3:first-of-type {
      text-align: center;
      font-size: 11pt;
      font-weight: 500;
      color: #64748b;
      margin-top: 0;
      margin-bottom: 18px;
    }

    /* Group Information Box (Reference Theme) */
    .group-box {
      background-color: #1d4ed8;
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 4px;
      display: inline-block;
      width: 290px;
      font-size: 8.5pt;
      line-height: 1.45;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .group-box strong {
      color: #ffffff;
      font-size: 9pt;
    }

    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 16px 0;
    }

    /* Section Headings with full blue underline rule (Reference Theme) */
    h2 {
      font-size: 12.5pt;
      font-weight: 700;
      color: #1d4ed8;
      border-bottom: 1.5px solid #2563eb;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    /* Subsection Headings (Reference Theme) */
    h3 {
      font-size: 10.5pt;
      font-weight: 700;
      color: #2563eb;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    h4 {
      font-size: 9.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 10px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }

    p {
      margin: 0.5em 0;
      text-align: justify;
    }

    strong {
      color: #0f172a;
      font-weight: 600;
    }

    /* Tables (Matching Reference PDF Theme) */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 8pt;
      page-break-inside: avoid;
    }

    th {
      background-color: #2563eb;
      color: #ffffff;
      font-weight: 600;
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #1d4ed8;
      font-size: 8.5pt;
    }

    td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      vertical-align: top;
      line-height: 1.35;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Code & Technical Blocks */
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #2563eb;
      padding: 8px 12px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 7.8pt;
      line-height: 1.35;
      border-radius: 3px;
      overflow-x: auto;
      page-break-inside: avoid;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 8px 0;
    }

    code {
      font-family: Consolas, "Courier New", monospace;
      font-size: 8pt;
    }

    p code, li code, td code {
      background: #f1f5f9;
      color: #1e3a8a;
      padding: 1px 4px;
      border-radius: 2px;
      border: 1px solid #e2e8f0;
      font-weight: 500;
    }

    ul, ol {
      margin: 0.4em 0;
      padding-left: 1.3em;
    }

    li {
      margin-bottom: 0.25em;
    }

    ol > li {
      margin-bottom: 0.35em;
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>
  `;

  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  console.log('Rendering PDF according to reference design...');
  await page.pdf({
    path: OUTPUT_PDF_PATH,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 7pt; font-family: -apple-system, sans-serif; color: #94a3b8; width: 100%; text-align: right; padding: 4mm 16mm 0 16mm; box-sizing: border-box;">
        CipherShare &mdash; Technical Project Report &bull; Group 22
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 7.5pt; font-family: -apple-system, sans-serif; color: #64748b; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 16mm 4mm 16mm; box-sizing: border-box;">
        <span>Applied Cryptography Course Project &bull; Group 22</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: '16mm',
      bottom: '16mm',
      left: '14mm',
      right: '14mm'
    }
  });

  await browser.close();
  console.log(`PDF successfully written to: ${OUTPUT_PDF_PATH}`);

  // Copy to artifacts directory
  if (fs.existsSync(OUTPUT_PDF_PATH)) {
    fs.copyFileSync(OUTPUT_PDF_PATH, ARTIFACT_PDF_PATH);
    console.log(`Copied PDF to artifact location: ${ARTIFACT_PDF_PATH}`);
  }
}

compileReportToPDF().catch(err => {
  console.error('Failed to compile PDF:', err);
  process.exit(1);
});
