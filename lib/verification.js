export function getTestedVersion(entry, dataset) {
  const sourceVersions = entry?.sources
    ?.map((source) => source.testedVersion)
    .filter((version) => Number.isInteger(version));
  const sourceTestedVersion = sourceVersions?.length ? Math.min(...sourceVersions) : undefined;
  const version = entry?.testedVersion ?? sourceTestedVersion ?? dataset?.game?.defaultTestedVersion;
  return version === undefined || version === null ? "" : String(version);
}

export function getCurrentVersion(gameDescriptor) {
  const version = gameDescriptor?.currentVersion;
  return version === undefined || version === null ? "" : String(version);
}

/** An entry is current only when both versions exist and match exactly. */
export function isEntryVerified(entry, dataset, gameDescriptor) {
  const tested = getTestedVersion(entry, dataset);
  const current = getCurrentVersion(gameDescriptor);
  return Boolean(tested && current && tested === current);
}
