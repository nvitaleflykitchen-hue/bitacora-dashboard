const clamp = (value, fallback) => Math.min(200, Math.max(20, Number(value) || fallback))

export function normalizeQrLabel({ widthMm, heightMm, orientation = 'horizontal' } = {}) {
  const first = clamp(widthMm, 50)
  const second = clamp(heightMm, 30)
  if (orientation === 'vertical') {
    return { widthMm:Math.min(first, second), heightMm:Math.max(first, second), orientation:'vertical' }
  }
  return { widthMm:Math.max(first, second), heightMm:Math.min(first, second), orientation:'horizontal' }
}
