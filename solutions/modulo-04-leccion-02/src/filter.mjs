export function filterBenefits(benefits, state = 'all') {
  if (state === 'all') return benefits.slice();
  if (state !== 'active' && state !== 'inactive') throw new RangeError('Unknown benefit state');
  return benefits.filter(benefit => benefit.state === state);
}
