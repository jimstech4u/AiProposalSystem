export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type ExportFormat = 'markdown' | 'pdf' | 'doc';

export type ReportSection = {
  heading: string;
  body: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'report';
}

export function toReport(title: string, sections: ReportSection[]) {
  return [
    `# ${title}`,
    '',
    ...sections.flatMap((section) => [
      `## ${section.heading}`,
      section.body.trim() || 'Not provided.',
      '',
    ]),
  ].join('\n');
}

export function reportToHtml(title: string, markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const body = lines.map((line) => {
    if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith('- ')) return `<p class="list-item">${escapeHtml(line)}</p>`;
    if (!line.trim()) return '<br />';
    return `<p>${escapeHtml(line)}</p>`;
  }).join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { color: #111827; font-family: Arial, sans-serif; line-height: 1.55; margin: 40px; }
    h1 { border-bottom: 2px solid #2563eb; font-size: 28px; margin-bottom: 24px; padding-bottom: 12px; }
    h2 { color: #1f2937; font-size: 18px; margin-top: 28px; }
    p { font-size: 12px; margin: 4px 0; white-space: pre-wrap; }
    .list-item { margin-left: 12px; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

export function exportStructuredReport(title: string, sections: ReportSection[], format: ExportFormat, filenameBase = title) {
  const markdown = toReport(title, sections);
  const filename = slugify(filenameBase);

  if (format === 'markdown') {
    downloadTextFile(`${filename}.md`, markdown, 'text/markdown');
    return;
  }

  const html = reportToHtml(title, markdown);
  if (format === 'doc') {
    downloadTextFile(`${filename}.doc`, html, 'application/msword');
    return;
  }

  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    downloadTextFile(`${filename}.html`, html, 'text/html');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}
