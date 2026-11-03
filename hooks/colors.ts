// Autumn's fork: accent colours. Each costume has its own accent (variant 0); a
// variant n picks the nth of a palette of clearly different hues, so sibling crabs
// read apart at panel size.

/** Each costume's own accent: its hat, garment or prop colour. */
export const ROLE_COLOR: Record<string, string> = {
  // savvy tiers
  fable: '#7F77DD',
  heavy: '#D85A30',
  careful: '#BA7517',
  medium: '#378ADD',
  light: '#1D9E75',
  // roles
  devil: '#C0392B',
  professor: '#C99A1E',
  rocket: '#E8590C',
  traveller: '#2F9E8F',
  stopwatch: '#2F80ED',
  judge: '#6B4E9B',
  crown: '#B8860B',
  artist: '#B5367A',
  explorer: '#5B8C3A',
  builder: '#E8750C',
  hacker: '#2E9E5B',
  writer: '#3B5BDB',
  director: '#C0392B',
  toga: '#4C9A2A',
  scientist: '#2F80ED',
  photographer: '#D9480F',
  shopkeeper: '#2F9E8F',
  tailor: '#1A7F8C',
  // the pool
  pirate: '#C99A1E',
  wizard: '#5B4BB7',
  spaceman: '#2F6FD8',
  knight: '#C0392B',
  ninja: '#D0453F',
  cowboy: '#B3261E',
  viking: '#2F6FD8',
  beekeeper: '#C99A1E',
  magician: '#B5367A',
  sailor: '#2F4FA8',
  firefighter: '#D0453F',
  party: '#7F77DD',
}

/** Variant n (1..) is PALETTE[n - 1]: distinct hues, not shades. */
export const PALETTE: readonly string[] = [
  '#2F6FD8', // blue
  '#D63A2F', // red
  '#2E9E4F', // green
  '#E8820C', // orange
  '#7B4FC9', // purple
  '#1A9C9C', // teal
  '#D4A20B', // gold
  '#D6408F', // pink
  '#2B2B2E', // black
  '#8B5A2B', // brown
]

const hex = (h: number, s: number, l: number): string => {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const c = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return `#${[c(0), c(8), c(4)].map(v => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/** The accent a costume wears in a variant: its own, a palette hue, then generated hues. */
export const accentOf = (costume: string, variant = 0): string => {
  if (!variant) return ROLE_COLOR[costume] ?? '#888780'
  return PALETTE[variant - 1] ?? hex((variant * 137) % 360, 0.62, 0.45)
}

const hsl = (color: string): [h: number, s: number, l: number] => {
  const [r, g, b] = [1, 3, 5].map(i => (parseInt(color.slice(i, i + 2), 16) || 0) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

/** Two accents a glance cannot tell apart: hues under 28° apart, or two greys/darks of like lightness. */
export const isClose = (a: string, b: string): boolean => {
  const [ha, sa, la] = hsl(a)
  const [hb, sb, lb] = hsl(b)
  const dull = (s: number, l: number) => s < 0.3 || l < 0.2
  if (dull(sa, la) || dull(sb, lb)) return dull(sa, la) && dull(sb, lb) && Math.abs(la - lb) < 0.2
  const dh = Math.abs(ha - hb)
  return Math.min(dh, 360 - dh) < 28
}
