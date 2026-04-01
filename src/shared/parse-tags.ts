export function parseTags(
  record: string,
  options?: { lowercaseKeys?: boolean },
): Record<string, string> {
  const lowercase = options?.lowercaseKeys ?? true;
  const tags: Record<string, string> = {};
  for (const part of record.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    tags[lowercase ? key.toLowerCase() : key] = trimmed.slice(eqIdx + 1).trim();
  }
  return tags;
}
