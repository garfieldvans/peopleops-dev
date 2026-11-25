/** Build a safe attachment header without allowing CRLF or quote injection. */
export function attachmentDisposition(fileName: string): string {
  const cleaned = fileName.replace(/[\r\n]/g, "").trim().slice(0, 200) || "attachment";
  const ascii = cleaned.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}
