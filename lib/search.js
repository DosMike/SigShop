function countOccurrences(value, term) {
  if (!value || !term) return 0;
  let count = 0;
  let position = 0;

  while ((position = value.indexOf(term, position)) >= 0) {
    count += 1;
    position += term.length;
  }
  return count;
}

/**
 * Scores a catalog entry against a query. Function/member names are weighted
 * twice as strongly as descriptive metadata. Every query term must occur in
 * at least one searchable field.
 */
export function scoreSearchResult(entry, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;

  const title = String(entry.name || "").toLowerCase();
  const gamedataKey = String(entry.gamedataKey || "").toLowerCase();
  const fields = [
    [title, 2],
    ...(gamedataKey && gamedataKey !== title ? [[gamedataKey, 1]] : []),
    [entry.scope, 1],
    [entry.description, 1],
    [entry.signature?.library, 1],
    [entry.provider?.name, 1],
  ].map(([value, weight]) => [String(value || "").toLowerCase(), weight]);

  let score = 0;
  for (const term of terms) {
    const termScore = fields.reduce(
      (total, [value, weight]) => total + countOccurrences(value, term) * weight,
      0,
    );
    if (!termScore) return 0;
    score += termScore;
  }
  return score;
}
