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

export function toReport(title: string, sections: Array<{ heading: string; body: string }>) {
  return [
    title,
    '='.repeat(title.length),
    '',
    ...sections.flatMap((section) => [
      section.heading,
      '-'.repeat(section.heading.length),
      section.body,
      '',
    ]),
  ].join('\n');
}
