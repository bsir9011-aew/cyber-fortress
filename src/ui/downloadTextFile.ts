/** Browser-only delivery; no persistence, networking or interpretation of contents. */
export function downloadTextFile(file: {
  content: string;
  mimeType: string;
  filename: string;
}) {
  const url = URL.createObjectURL(
    new Blob([file.content], { type: file.mimeType }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
