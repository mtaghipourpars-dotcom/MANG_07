export function computeRemainingRisk(scenario, observations) {
  const effects = observations.at(-1)?.effects ?? [];
  const isDonor = row => row.node === 'donor_delivery';
  const hasObservation = row => Number.isFinite(row.baseline) && Number.isFinite(row.observed);
  const primary = effects.filter(row => !isDonor(row));
  const requiresDonorEvidence = scenario.option === 'transfer';
  const relevant = requiresDonorEvidence ? effects : primary;

  if (relevant.some(row => hasObservation(row) && row.observed > row.baseline)) {
    return 'LATE_REALIZED';
  }
  if (!primary.length || relevant.some(row => !hasObservation(row)) ||
      (requiresDonorEvidence && !effects.some(isDonor))) {
    return 'UNVERIFIED_OPEN';
  }
  return 'MET_VERIFIED';
}
