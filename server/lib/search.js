export function ftsQuery(value) {
  const tokens = String(value || '').normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.slice(0, 8).map((token) => `"${token.replaceAll('"', '""')}"*`).join(' AND ');
}
