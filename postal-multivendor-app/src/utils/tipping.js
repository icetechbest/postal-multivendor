// The backend returns `tips` as a list of Tipping documents; older servers returned a single object.
// Always resolve to the tip variations array so screens never crash on a missing/odd shape.
export const getTipVariations = (data) => {
  const tips = data?.tips
  const tipping = Array.isArray(tips) ? tips.find((t) => Array.isArray(t?.tipVariations) && t.tipVariations.length) || tips[0] : tips
  return Array.isArray(tipping?.tipVariations) ? tipping.tipVariations : []
}
