const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const REPORT_MD_PATH = path.resolve(__dirname, '../../docs/PROJECT_REPORT.md');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../docs/screenshots');
const OUTPUT_PDF_PATH = path.resolve(__dirname, '../../docs/PROJECT_REPORT.pdf');

async function compileReportToPDF() {
  console.log('Reading report markdown...');
  let markdown = fs.readFileSync(REPORT_MD_PATH, 'utf-8');

  // Replace relative screenshot paths with base64 data URIs for seamless PDF embedding
  const imageRegex = /!\[(.*?)\]\((screenshots\/(.*?\.png))\)/g;
  markdown = markdown.replace(imageRegex, (match, alt, relPath, filename) => {
    const fullPath = path.join(SCREENSHOTS_DIR, filename);
    if (fs.existsSync(fullPath)) {
      const base64 = fs.readFileSync(fullPath).toString('base64');
      return `![${alt}](data:image/png;base64,${base64})`;
    }
    return match;
  });

  console.log('Converting Markdown to HTML...');
  const htmlContent = marked(markdown);

  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CipherShare Project Report</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 16mm 20mm 16mm;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    h1, h2, h3, h4 {
      color: #0f172a;
      font-family: Georgia, Cambria, "Times New Roman", serif;
      font-weight: 700;
      line-height: 1.25;
      margin-top: 1.4em;
      margin-bottom: 0.5em;
      page-break-after: avoid;
    }

    h1 {
      font-size: 19pt;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-top: 0;
    }

    h2 {
      font-size: 13.5pt;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 1.6em;
    }

    h3 {
      font-size: 11.5pt;
      margin-top: 1.2em;
    }

    h4 {
      font-size: 10.5pt;
      font-style: italic;
    }

    p {
      margin: 0.6em 0;
      text-align: justify;
    }

    strong {
      color: #0f172a;
    }

    em {
      color: #334155;
    }

    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 1.5em 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2em 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
      font-family: monospace;
      font-size: 8.5pt;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    pre, code {
      font-family: Consolas, "Courier New", monospace;
    }

    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #334155;
      padding: 8px 12px;
      font-size: 8pt;
      line-height: 1.35;
      border-radius: 3px;
      overflow-x: auto;
      page-break-inside: avoid;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    p code, li code, td code {
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 4px;
      font-size: 8.5pt;
      border-radius: 2px;
      border: 1px solid #e2e8f0;
    }

    ul, ol {
      margin: 0.6em 0;
      padding-left: 1.5em;
    }

    li {
      margin-bottom: 0.3em;
    }

    img {
      display: block;
      max-width: 96%;
      height: auto;
      margin: 12px auto 6px auto;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      page-break-inside: avoid;
    }

    /* Center figure captions */
    p:has(img) + p em, p > em:only-child {
      display: block;
      text-align: center;
      font-size: 8.5pt;
      color: #64748b;
      margin-bottom: 14px;
    }

    blockquote {
      border-left: 3px solid #0284c7;
      background: #f0f9ff;
      color: #0369a1;
      margin: 1em 0;
      padding: 8px 14px;
      font-size: 9pt;
      border-radius: 0 4px 4px 0;
    }

    .header-info {
      font-size: 9pt;
      color: #475569;
      margin-bottom: 1.5em;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
  `;

  console.log('Launching headless browser for PDF generation...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  console.log('Rendering PDF with academic formatting...');
  await page.pdf({
    path: OUTPUT_PDF_PATH,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 7.5pt; font-family: sans-serif; color: #94a3b8; width: 100%; text-align: right; padding-right: 16mm; padding-top: 4mm;">
        CipherShare: Applied Cryptography Project Report &bull; Popa et al. SLA Framework
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 7.5pt; font-family: sans-serif; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding-left: 16mm; padding-right: 16mm; padding-bottom: 4mm;">
        <span>Confidential &bull; Academic Evaluation</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '14mm',
      right: '14mm'
    }
  });

  await browser.close();
  console.log(`PDF compiled successfully to: ${OUTPUT_PDF_PATH}`);
}

compileReportToPDF().catch(err => {
  console.error('Failed to compile PDF:', err);
  process.exit(1);
});
