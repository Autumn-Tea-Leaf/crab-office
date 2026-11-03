// The office: a pixel crab campus that grows a room for every team at work.
// Each department suits the crabs it holds: researchers get a library, designers
// a studio, writers a fireside room, coders a lab with blinking servers, QA a
// bench of bubbling flasks, the council a chamber, sellers a shop, and anyone
// else the open space. The ground floor is always there: the lobby, the café and
// the lounge, with a garden out front. The lead, the main session, keeps the front desk.
//
// Running crabs work at their department's desks and wander off on errands
// that suit them; finished ones take a break in the lounge, the café, the gym,
// the greenhouse or the garden; planned ones wait in the lobby. Every walk is a
// CSS animation, so nothing redraws to move a crab, and each redraw starts the
// loops at the phase the clock says, so a crab never jumps back to its start.
// The light follows the local clock the same way: one loop a day, from dawn's
// warm glow to the lamps of the night.
import { hash } from './roles'

export type OfficeStatus = 'running' | 'done' | 'failed' | 'planned'

export type OfficeCrab = {
  id: string
  name: string
  color: string
  status: OfficeStatus
  /** The costume it wears: picks its department. */
  costume: string
  /** What a working crab is doing, shown in its bubble at the desk. */
  activity: string
  /** Its own task progress, 0..1, when it reports steps. */
  progress: number | null
  /** The crab, drawn at (0,0) at CRAB_S scale: CRAB_BOX * CRAB_S wide. */
  draw: (isWalking: boolean) => string
  /** The lead, the main session: keeps the lobby's front desk and joins no department. */
  isLead?: boolean
}

export const DEPTS = ['research', 'studio', 'writing', 'engineering', 'qa', 'council', 'sales', 'general'] as const
export type Dept = (typeof DEPTS)[number]
export type RoomKind = Dept | 'lobby' | 'cafe' | 'lounge' | 'gym' | 'greenhouse'
export type OfficeLabels = Record<RoomKind, string>

export const ROOM_NAMES: OfficeLabels = {
  research: 'Research Library',
  studio: 'Design Studio',
  writing: "Writers' Room",
  engineering: 'Dev Lab',
  qa: 'QA Lab',
  council: 'Council Chamber',
  sales: 'Shop Floor',
  general: 'Open Space',
  lobby: 'Lobby',
  cafe: 'Café',
  lounge: 'Lounge',
  gym: 'Gym',
  greenhouse: 'Greenhouse',
}

const DEPT_OF: Record<string, Dept> = {
  explorer: 'research',
  artist: 'studio',
  director: 'studio',
  photographer: 'studio',
  tailor: 'studio',
  writer: 'writing',
  hacker: 'engineering',
  builder: 'engineering',
  fable: 'engineering',
  careful: 'engineering',
  medium: 'engineering',
  light: 'engineering',
  scientist: 'qa',
  heavy: 'qa',
  devil: 'council',
  professor: 'council',
  rocket: 'council',
  traveller: 'council',
  stopwatch: 'council',
  judge: 'council',
  crown: 'council',
  toga: 'council',
  shopkeeper: 'sales',
}
export const deptOf = (costume: string): Dept => DEPT_OF[costume] ?? 'general'

// Scene units; the Svg scales them to the pane's width.
export const LW = 384
export const CRAB_S = 0.6
const CW = 30 * CRAB_S
// Where a crab's feet are inside its box.
const FOOT_X = 15 * CRAB_S
const FOOT_Y = 26 * CRAB_S
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif"

// The building: a corridor down the left, then floors of three rooms, each floor
// with its hallway beneath it. Every room's door opens onto its own hallway.
const BY = 10
const WALL = 4
const IN_W = 106
const IN_H = 80
const HALL_H = 22
const PITCH = IN_H + WALL + HALL_H + WALL
const BX = 14
const CORR_X = BX + WALL
const CX = CORR_X + 10
const RX0 = CORR_X + 20 + WALL
const RIGHT = RX0 + 3 * (IN_W + WALL) - WALL
const GARDEN_H = 74

const rx = (c: number): number => RX0 + c * (IN_W + WALL)
const roomTop = (r: number): number => BY + WALL + r * PITCH
const hallTop = (r: number): number => roomTop(r) + IN_H + WALL
const hallY = (r: number): number => hallTop(r) + 16
const heightOf = (rows: number): number => roomTop(rows) + GARDEN_H
const lawnY = (rows: number): number => roomTop(rows) + 14

type Pt = { x: number; y: number }
type Room = { kind: RoomKind; r: number; c: number; x: number; top: number }
const aisleY = (room: Room): number => room.top + IN_H - 6
const doorX = (room: Room): number => room.x + 53

type Icon = keyof typeof ICONS
// A place a crab stands: in a room, on a hallway, or out in the garden. `via`
// leads from it to a clear column it can walk down to the room's walkway.
type Stop = Pt & { icon: Icon; room?: Room; hall?: number; isGarden?: boolean; via?: Pt[] }

// --- route finding: spot -> walkway -> door -> hallway -> corridor -> hallway -> door -> walkway -> spot.

type Exit = { pts: Pt[]; hall: number }

const exitOf = (s: Stop, rows: number): Exit => {
  if (s.room) {
    const via = s.via ?? []
    const last = via[via.length - 1] ?? s
    const y = aisleY(s.room)
    return { pts: [...via, { x: last.x, y }, { x: doorX(s.room), y }, { x: doorX(s.room), y: hallY(s.room.r) }], hall: s.room.r }
  }
  if (s.isGarden) return { pts: [{ x: s.x, y: lawnY(rows) }, { x: GATE_X, y: lawnY(rows) }, { x: GATE_X, y: hallY(rows - 1) }], hall: rows - 1 }
  return { pts: [], hall: s.hall ?? rows - 1 }
}

export const route = (a: Stop, b: Stop, rows: number): Pt[] => {
  let pts: Pt[]
  if (a.room && a.room === b.room) {
    const ea = exitOf(a, rows).pts.slice(0, -2)
    const eb = exitOf(b, rows).pts.slice(0, -2)
    pts = [a, ...ea, ...eb.reverse(), b]
  } else if (a.isGarden && b.isGarden) {
    // Along the lawn's top path, never through the pond or the fountain.
    pts = [a, { x: a.x, y: lawnY(rows) }, { x: b.x, y: lawnY(rows) }, b]
  } else {
    const ea = exitOf(a, rows)
    const eb = exitOf(b, rows)
    const stairs = ea.hall === eb.hall ? [] : [{ x: CX, y: hallY(ea.hall) }, { x: CX, y: hallY(eb.hall) }]
    pts = [a, ...ea.pts, ...stairs, ...eb.pts.reverse(), b]
  }
  const clean = pts.map(p => ({ x: p.x, y: p.y }))
  return clean.filter((p, i) => i === 0 || p.x !== clean[i - 1]?.x || p.y !== clean[i - 1]?.y)
}

// --- the loops.

// mulberry32: a crab's errands and pace come from its id, the same every redraw.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)] as T

type Visit = { at: Stop; dwell: number; text?: string }
type Loop = { period: number; moves: (Pt & { t: number })[]; faces: { t: number; f: 1 | -1 }[]; shows: { from: number; to: number }[] }

const loopOf = (visits: Visit[], speed: number, rows: number): Loop => {
  const moves: Loop['moves'] = []
  const faces: Loop['faces'] = [{ t: 0, f: 1 }]
  const shows: Loop['shows'] = []
  let t = 0
  let face: 1 | -1 = 1
  visits.forEach((v, i) => {
    moves.push({ t, x: v.at.x, y: v.at.y })
    shows.push({ from: t, to: t + v.dwell })
    t += v.dwell
    moves.push({ t, x: v.at.x, y: v.at.y })
    const next = visits[(i + 1) % visits.length]
    if (!next || visits.length === 1) return
    const path = route(v.at, next.at, rows)
    for (let j = 1; j < path.length; j++) {
      const a = path[j - 1] as Pt
      const b = path[j] as Pt
      const dx = b.x - a.x
      const f: 1 | -1 = dx < -0.1 ? -1 : dx > 0.1 ? 1 : face
      if (f !== face) faces.push({ t, f })
      face = f
      t += Math.hypot(dx, b.y - a.y) / speed
      moves.push({ t, x: b.x, y: b.y })
    }
  })
  return { period: Math.max(1, t), moves, faces, shows }
}

const pct = (t: number, period: number): string => `${Math.min(100, (t / period) * 100).toFixed(4)}%`
const at = (p: Pt): string => `translate(${(p.x - FOOT_X).toFixed(2)}px,${(p.y - FOOT_Y).toFixed(2)}px)`
const FLIP = `translate(${CW}px,0) scale(-1,1)`

// --- small pixel icons for the bubbles, 5x5.

const ICONS = {
  dots: [['.....', '.....', 'k.k.k', '.....', '.....'], { k: '#3A3A3C' }],
  chat: [['.....', 'kkkkk', '.....', 'kkk..', '.....'], { k: '#3A3A3C' }],
  cup: [['.s.s.', 'cccc.', 'wwwwk', 'wwww.', '.ww..'], { s: '#9a9a96', c: '#6B4423', w: '#E6E3DA', k: '#9a9a96' }],
  drop: [['..b..', '.bbb.', 'bbbbb', 'bbbbb', '.bbb.'], { b: '#38B6E0' }],
  apple: [['..g..', '.rrr.', 'rrrrr', 'rrrrr', '.rrr.'], { g: '#3C9A4A', r: '#E5484D' }],
  bulb: [['.yyy.', 'yyyyy', 'yyyyy', '.yyy.', '.ggg.'], { y: '#F5C542', g: '#8E929A' }],
  book: [['bbbb.', 'bwwbk', 'bwwbk', 'bbbbk', '.....'], { b: '#2F6FD8', w: '#E6E3DA', k: '#1F2430' }],
  star: [['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.'], { y: '#F5C542' }],
  zzz: [['kkkk.', '..k..', '.k...', 'kkkk.', '.....'], { k: '#6B6B68' }],
  ball: [['.....', '.ooo.', '.ooo.', '.ooo.', '.....'], { o: '#F08A24' }],
  paper: [['wwww.', 'wkkw.', 'wwwww', 'wkkkw', 'wwwww'], { w: '#D9D6CC', k: '#8E929A' }],
  bang: [['..r..', '..r..', '..r..', '.....', '..r..'], { r: '#D0453F' }],
  wait: [['.....', '.....', 'k.k.k', '.....', '.....'], { k: '#9a9a96' }],
  globe: [['.bgb.', 'bggbb', 'bbgbb', 'gbbgb', '.bbb.'], { b: '#38B6E0', g: '#3C9A4A' }],
  map: [['yyyyy', 'yryyy', 'yyyry', 'yryyy', 'yyyyy'], { y: '#E8D5A0', r: '#D0453F' }],
  fire: [['..o..', '.oo..', '.ooy.', 'oyyyo', '.ooo.'], { o: '#F08A24', y: '#F5C542' }],
  bolt: [['..yy.', '.yy..', 'yyyy.', '..yy.', '.yy..'], { y: '#F5C542' }],
  gear: [['.k.k.', 'kkkkk', '.k.k.', 'kkkkk', '.k.k.'], { k: '#6B6B68' }],
  check: [['....g', '...g.', 'g.g..', '.g...', '.....'], { g: '#3B9C5F' }],
  flask: [['.kk..', '.kk..', 'kggk.', 'gggg.', 'gggg.'], { k: '#8E929A', g: '#7BD88F' }],
  lens: [['.kk..', 'kbbk.', 'kbbk.', '.kkk.', '...kk'], { k: '#3A3A3C', b: '#A9D6F5' }],
  palette: [['.www.', 'wrwbw', 'wwwyw', '.ww..', '.....'], { w: '#E8D5B0', r: '#E5484D', b: '#2F6FD8', y: '#F5C542' }],
  camera: [['.kk..', 'kkkkk', 'kkbkk', 'kkkkk', '.....'], { k: '#3A3A3C', b: '#A9D6F5' }],
  thread: [['.ppp.', 'ppppp', 'ywwwy', 'ppppp', '.ppp.'], { p: '#E8A0BF', y: '#C9A66B', w: '#F4F3EE' }],
  box: [['bbbbb', 'bcbcb', 'bbbbb', 'bbbbb', '.....'], { b: '#C9A66B', c: '#8C5A33' }],
  coin: [['.yyy.', 'yyoyy', 'yoyyy', 'yyoyy', '.yyy.'], { y: '#F5C542', o: '#C99A1E' }],
  phone: [['kkkkk', 'k...k', '.kkk.', '.kwk.', '.kkk.'], { k: '#3A3A3C', w: '#E6E3DA' }],
  flower: [['.p.p.', 'ppypp', '.ppp.', '..g..', '.gg..'], { p: '#E8A0BF', y: '#F5C542', g: '#3C9A4A' }],
  fish: [['.....', 'o.oo.', 'oooko', 'o.oo.', '.....'], { o: '#F08A24', k: '#1F1E1D' }],
  scale: [['..k..', 'kkkkk', 'k.k.k', 'y.k.y', '.kkk.'], { k: '#C99A1E', y: '#F5C542' }],
  music: [['..kk.', '..k.k', '..k..', 'kkk..', 'kk...'], { k: '#5B3E96' }],
  sun: [['y.y.y', '.yyy.', 'yyyyy', '.yyy.', 'y.y.y'], { y: '#F5C542' }],
} as const satisfies Record<string, readonly [readonly string[], Record<string, string>]>

// The engine takes an Svg source of at most this many characters; the scene is
// shipped as several stacked Svgs, each packed under it.
export const SVG_LIMIT = 131_072
const PACK_AT = 120_000

const num = (n: number): string => String(Math.round(n * 100) / 100)
// A rect as a path: about half the characters of a <rect>.
const box = (x: number, y: number, w: number, h: number, fill: string, extra = ''): string =>
  `<path d="M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}z" fill="${fill}"${extra}/>`
// The same for markup drawn elsewhere (the crabs): every plain <rect> turned into a path.
const compact = (svg: string): string =>
  svg.replace(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="([^"]+)"\/>/g, (_m, x, y, w, h, f) => box(Number(x), Number(y), Number(w), Number(h), f))

// Pixel art as rects, a run of same-coloured pixels in a row drawn as one.
const pixels = (x: number, y: number, rows: readonly string[], map: Record<string, string>, cls = ''): string => {
  const out: string[] = []
  rows.forEach((row, dy) => {
    const chars = [...row]
    for (let dx = 0; dx < chars.length; ) {
      const ch = chars[dx] as string
      let run = 1
      while (chars[dx + run] === ch) run++
      if (map[ch]) out.push(box(x + dx, y + dy, run, 1, map[ch] as string, cls ? ` class="${cls}"` : ''))
      dx += run
    }
  })
  return out.join('')
}

// Each bubble icon is drawn once, in <defs>, and placed with <use>.
const iconDefs = (): string =>
  (Object.keys(ICONS) as Icon[]).map(k => `<g id="i-${k}">${pixels(0, 0, ICONS[k][0], ICONS[k][1])}</g>`).join('')

const xml = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
const textW = (s: string, size: number): number => [...s].reduce((w, ch) => w + (/[\sil.,:;'|!1()]/.test(ch) ? 0.3 : /[A-Zmw@%]/.test(ch) ? 0.72 : 0.56) * size, 0)
const clip = (s: string, size: number, max: number): string => {
  if (textW(s, size) <= max) return s
  let out = ''
  for (const ch of s) {
    if (textW(out + ch + '…', size) > max) break
    out += ch
  }
  return out + '…'
}

// A speech bubble over the crab's head: a line of text, or an icon.
const bubble = (v: Visit): string => {
  const y = -16
  if (v.text) {
    const text = clip(v.text, 4.6, 74)
    const w = Math.round(textW(text, 4.6) + 6)
    const x = FOOT_X - 4
    return `<rect x="${x}" y="${y}" width="${w}" height="8" rx="2" fill="#ffffff" stroke="#3A3A3C" stroke-width=".5"/>
<path d="M${x + 2} ${y + 8}h3l-2 2.5z" fill="#ffffff"/><text x="${x + 3}" y="${y + 5.6}" font-family="${FONT}" font-size="4.6" font-weight="600" fill="#1F1E1D">${xml(text)}</text>`
  }
  const x = FOOT_X + 3
  return `<rect x="${x}" y="${y}" width="9" height="8" rx="2" fill="#ffffff" stroke="#3A3A3C" stroke-width=".5"/>
<path d="M${x + 1.5} ${y + 8}h3l-2.5 2.5z" fill="#ffffff"/><use href="#i-${v.at.icon}" x="${x + 2}" y="${y + 1.5}" shape-rendering="crispEdges"/>`
}

// The name tag above the head; a working crab's tag carries its task progress.
const nameTag = (c: OfficeCrab): string => {
  const name = clip(c.name, 4.6, c.status === 'planned' ? 18 : 46)
  const w = Math.round(textW(name, 4.6) + 9)
  const x = FOOT_X - w / 2
  const bar = c.progress !== null && c.status === 'running' ? `<rect x="${x + 1}" y="-0.6" width="${((w - 2) * c.progress).toFixed(1)}" height="1" fill="${c.color}"/>` : ''
  return `<rect x="${x}" y="-7" width="${w}" height="6.6" rx="3.3" fill="rgba(31,30,29,.82)"/>
<circle cx="${x + 3.6}" cy="-3.7" r="1.4" fill="${c.color}"/>
<text x="${x + 6}" y="-2" font-family="${FONT}" font-size="4.6" font-weight="600" fill="#ffffff">${xml(name)}</text>${bar}`
}

// --- drawing helpers.

// Furniture is drawn outlined and dropping a shadow (one SVG filter per layer);
// anything animated is kept out of those layers, so the filter never reruns.
type Layers = { floor: string[]; furn: string[]; over: string[]; furnAnim: string[]; overAnim: string[]; glow: string[] }
const newLayers = (): Layers => ({ floor: [], furn: [], over: [], furnAnim: [], overAnim: [], glow: [] })
let cur: Layers = newLayers()
const animOf = (out: string[]): string[] => (out === cur.furn ? cur.furnAnim : out === cur.over ? cur.overAnim : out)
const isSolid = (out: string[]): boolean => out === cur.furn || out === cur.over

// A furniture block gets a lit top edge and a shaded bottom edge, so it reads as a solid.
const rect = (out: string[], x: number, y: number, w: number, h: number, fill: string, extra = ''): void => {
  const isAnimated = extra.includes('class="') && isSolid(out)
  ;(isAnimated ? animOf(out) : out).push(box(x, y, w, h, fill, extra))
  if (!isAnimated && isSolid(out) && w >= 5 && h >= 3 && fill.startsWith('#')) {
    out.push(box(x, y, w, 0.8, 'rgba(255,255,255,.24)') + box(x, y + h - 0.8, w, 0.8, 'rgba(0,0,0,.18)'))
  }
}
const art = (out: string[], x: number, y: number, rows: readonly string[], map: Record<string, string>, cls = ''): void => {
  ;(cls ? animOf(out) : out).push(pixels(x, y, rows, map, cls))
}

// Floors: boards with staggered seams, tiles with grout, or carpet with a border.
const planks = (out: string[], x: number, y: number, w: number, h: number, a: string, b: string): void => {
  rect(out, x, y, w, h, a)
  for (let row = 0, py = 0; py < h; row++, py += 6) {
    const rh = Math.min(6, h - py)
    if (row % 2) rect(out, x, y + py, w, rh, b)
    rect(out, x, y + py, w, 0.5, 'rgba(255,255,255,.14)')
    rect(out, x, y + py + rh - 0.6, w, 0.6, 'rgba(0,0,0,.12)')
    for (let sx = hash(`p${x}${y}${row}`) % 26; sx < w; sx += 27) rect(out, x + sx, y + py, 0.6, rh, 'rgba(0,0,0,.12)')
  }
}
const tiles = (out: string[], x: number, y: number, w: number, h: number, size: number, a: string, b: string): void => {
  rect(out, x, y, w, h, a)
  for (let ty = 0, i = 0; ty < h; ty += size, i++) {
    for (let tx = (i % 2) * size; tx < w; tx += size * 2) rect(out, x + tx, y + ty, Math.min(size, w - tx), Math.min(size, h - ty), b)
  }
  for (let ty = 0; ty < h; ty += size) rect(out, x, y + ty, w, 0.5, 'rgba(255,255,255,.3)')
  for (let ty = size; ty < h; ty += size) rect(out, x, y + ty - 0.5, w, 0.5, 'rgba(0,0,0,.09)')
  for (let tx = size; tx < w; tx += size) rect(out, x + tx, y, 0.5, h, 'rgba(0,0,0,.09)')
}
const carpet = (out: string[], x: number, y: number, w: number, h: number, a: string, b: string): void => {
  rect(out, x, y, w, h, a)
  rect(out, x + 4.5, y + 4.5, w - 9, h - 9, 'none', ` stroke="${b}" stroke-width="1"`)
  for (let i = 0; i < (w * h) / 90; i++) rect(out, x + (hash(`c${x}${y}${i}`) % w), y + (hash(`d${x}${y}${i}`) % h), 1, 1, 'rgba(0,0,0,.08)')
}

const tree = (out: string[], x: number, y: number, kind: number): void => {
  cur.floor.push(`<ellipse cx="${x + 5}" cy="${y + 10}" rx="5" ry="1.6" fill="rgba(0,0,0,.22)"/>`)
  if (kind === 0) {
    rect(out, x + 3, y + 7, 2, 3, '#6B4423')
    art(out, x, y, ['..ggg...', '.gghgg..', 'gghhggd.', 'ghggggd.', 'gggggddd', '.ggggdd.', '..gdd...'], { g: '#4E8F3A', h: '#7DBE5A', d: '#36702B' })
  } else {
    rect(out, x + 3, y + 8, 2, 2, '#6B4423')
    art(out, x, y, ['...p....', '..pqp...', '..ppd...', '.pqppd..', '.pppdd..', 'pqpppdd.', 'ppppddd.', '.ppddd..'], { p: '#2F6B3A', q: '#4A8F55', d: '#21502B' })
  }
}
const plant = (out: string[], x: number, y: number): void =>
  art(out, x, y, ['.g.g.', 'ghgdg', '.ggd.', '.ppq.', '.ppq.'], { g: '#3C9A4A', h: '#6FC27A', d: '#2A7436', p: '#B5703F', q: '#7A4428' })
const bookshelf = (out: string[], x: number, y: number, w: number, h: number): void => {
  rect(out, x, y, w, h, '#6B4423')
  const colors = ['#E5484D', '#2F6FD8', '#F5C542', '#3C9A4A', '#8f8cf4', '#F08A24', '#20A39E']
  for (let sy = y + 1; sy + 4 <= y + h; sy += 5) {
    for (let bx = x + 1, i = 0; bx + 2 <= x + w - 1; bx += 3, i++) rect(out, bx, sy, 2, 4 - (hash(`${bx}${sy}`) % 2), colors[(hash(`${x}${bx}${sy}`) + i) % colors.length] as string)
    rect(out, x, sy + 4, w, 1, '#4A2E17')
  }
}
const sofa = (out: string[], x: number, y: number, w: number, c: string, d: string): void => {
  rect(out, x, y, w, 6, d)
  rect(out, x, y + 6, w, 6, c)
  rect(out, x - 2, y + 2, 3, 10, d)
  rect(out, x + w - 1, y + 2, 3, 10, d)
}

// --- the rooms.

// Desks: two by two, the seat behind the desk; the crab peeks over it.
const DESK_W = 28
type Desk = { x: number; top: number; room: Room; i: number }
const desksOf = (room: Room): Desk[] =>
  [room.top + 14, room.top + 38].flatMap((top, row) => [0, 1].map(col => ({ x: room.x + 8 + col * 46, top, room, i: row * 2 + col })))
const seatOf = (d: Desk): Stop => ({ x: d.x + 14, y: d.top + 6, icon: 'dots', room: d.room, via: [{ x: d.x + DESK_W + 9, y: d.top + 6 }] })
const besideDesk = (d: Desk): Stop => ({ x: d.x + DESK_W + 9, y: d.top + 4, icon: 'chat', room: d.room })

const st = (room: Room, dx: number, dy: number, icon: Icon, via?: Pt[]): Stop => ({ x: room.x + dx, y: room.top + dy, icon, room, via: via?.map(p => ({ x: room.x + p.x, y: room.top + p.y })) })

// Every department room keeps the same four errand places: two at the back wall
// (up the clear columns between the desks) and two on the walkway, in front of
// what stands under the desks.
const ERRAND_ICONS: Record<Dept, [Icon, Icon, Icon, Icon]> = {
  research: ['book', 'map', 'globe', 'book'],
  studio: ['palette', 'camera', 'palette', 'thread'],
  writing: ['paper', 'bulb', 'fire', 'paper'],
  engineering: ['bolt', 'bulb', 'gear', 'bolt'],
  qa: ['check', 'drop', 'lens', 'flask'],
  council: ['star', 'scale', 'chat', 'star'],
  sales: ['box', 'phone', 'box', 'coin'],
  general: ['bulb', 'sun', 'zzz', 'drop'],
}
const errandsOf = (room: Room): Stop[] => {
  const [a, b, c, d] = ERRAND_ICONS[room.kind as Dept] ?? ERRAND_ICONS.general
  return [st(room, 45, 12, a), st(room, 91, 12, b), st(room, 21, IN_H - 6, c), st(room, 69, IN_H - 6, d)]
}

type DeskLook = { top: string; front: string; dress: (out: string[], d: Desk, color: string, isTaken: boolean) => void }
const glow = (isTaken: boolean, color: string) => (isTaken ? color : '#3A3D45')
const DESK_LOOKS: Record<Dept, DeskLook> = {
  research: {
    top: '#C68E57',
    front: '#8C5A33',
    dress: (o, d) => {
      rect(o, d.x + 2, d.top - 3, 6, 1, '#E5484D'); rect(o, d.x + 2, d.top - 2, 7, 1, '#2F6FD8'); rect(o, d.x + 1, d.top - 1, 8, 1, '#3C9A4A')
      rect(o, d.x + 22, d.top - 5, 1, 5, '#C99A1E'); rect(o, d.x + 20, d.top - 7, 5, 2, '#2E7D4F')
    },
  },
  studio: {
    top: '#F1ECE2',
    front: '#C9BFAE',
    dress: (o, d, c, isTaken) => {
      rect(o, d.x + 2, d.top - 5, 11, 6, '#3A3A3C'); rect(o, d.x + 3, d.top - 4, 9, 4, isTaken ? c : '#55514C')
      rect(o, d.x + 21, d.top - 2, 3, 3, '#2F6FD8'); rect(o, d.x + 21, d.top - 5, 1, 3, '#C99A1E'); rect(o, d.x + 23, d.top - 6, 1, 4, '#E5484D')
    },
  },
  writing: {
    top: '#A9713F',
    front: '#7A4A26',
    dress: (o, d) => {
      rect(o, d.x + 4, d.top - 6, 8, 4, '#F4F3EE'); rect(o, d.x + 5, d.top - 5, 6, 1, '#8E929A')
      rect(o, d.x + 2, d.top - 2, 12, 3, '#2B2E36'); rect(o, d.x + 3, d.top - 1, 10, 1, '#55514C')
      rect(o, d.x + 21, d.top - 2, 3, 2, '#E6E3DA'); rect(o, d.x + 24, d.top - 1, 1, 1, '#E6E3DA')
    },
  },
  engineering: {
    top: '#E6E8EE',
    front: '#8E929A',
    dress: (o, d, c, isTaken) => {
      rect(o, d.x + 1, d.top - 6, 10, 6, '#2B2E36'); rect(o, d.x + 12, d.top - 6, 10, 6, '#2B2E36')
      rect(o, d.x + 1, d.top - 7, 21, 1, glow(isTaken, c), isTaken ? ' class="live"' : '')
      rect(o, d.x + 5, d.top - 1, 2, 2, '#55514C'); rect(o, d.x + 16, d.top - 1, 2, 2, '#55514C')
      rect(o, d.x + 23, d.top + 1, 3, 2, '#6B4423')
    },
  },
  qa: {
    top: '#F4F3EE',
    front: '#B8BEC9',
    dress: (o, d) => {
      art(o, d.x + 2, d.top - 6, ['.k...k.', '.k...k.', 'kgk.kbk', 'gggkbbb', 'gggkbbb'], { k: '#8E929A', g: '#7BD88F', b: '#8f8cf4' })
      rect(o, d.x + 3, d.top - 8, 1, 1, '#7BD88F', ' class="bub"'); rect(o, d.x + 7, d.top - 9, 1, 1, '#8f8cf4', ' class="bub b2"')
      rect(o, d.x + 18, d.top - 4, 6, 4, '#E6E3DA'); rect(o, d.x + 19, d.top - 3, 4, 1, '#3B9C5F')
    },
  },
  council: {
    top: '#2E6B4A',
    front: '#4A2E17',
    dress: (o, d) => {
      rect(o, d.x + 3, d.top - 2, 8, 2, '#E8D5A0'); rect(o, d.x + 2, d.top - 2, 1, 2, '#C9A66B'); rect(o, d.x + 11, d.top - 2, 1, 2, '#C9A66B')
      rect(o, d.x + 19, d.top - 3, 6, 2, '#5A3519'); rect(o, d.x + 21, d.top - 1, 1, 2, '#7A4A26')
    },
  },
  sales: {
    top: '#D9A066',
    front: '#C0392B',
    dress: (o, d, c, isTaken) => {
      rect(o, d.x + 2, d.top - 5, 11, 5, '#8E929A'); rect(o, d.x + 3, d.top - 4, 9, 2, isTaken ? '#7BD88F' : '#3A3D45')
      rect(o, d.x + 19, d.top - 2, 4, 2, '#F5C542'); rect(o, d.x + 20, d.top - 4, 4, 2, '#C99A1E')
      rect(o, d.x + 1, d.top + 5, DESK_W - 2, 1, '#F4F3EE')
    },
  },
  general: {
    top: '#D9A066',
    front: '#A9713F',
    dress: (o, d, c, isTaken) => {
      rect(o, d.x + 2, d.top - 6, 10, 6, '#2B2E36'); rect(o, d.x + 6, d.top - 1, 2, 2, '#55514C')
      if (isTaken) rect(o, d.x + 2, d.top - 7, 10, 1, c, ' class="live"')
      rect(o, d.x + 22, d.top + 1, 3, 2, '#F4F3EE')
    },
  },
}

const drawDesk = (L: Layers, d: Desk, dept: Dept, color: string | undefined): void => {
  const look = DESK_LOOKS[dept]
  // The chair sits behind the desk, under whoever is in it.
  const [frame, cushion] = dept === 'council' ? ['#5A1620', '#A12C3B'] : dept === 'writing' ? ['#4A2E17', '#7A4A26'] : ['#2B2E36', '#4A6FA5']
  art(L.furn, d.x + 9, d.top - 8, ['.ffffffff.', 'fcchcccccf', 'fccccccccf', 'ffffffffff', 'a........a'], { f: frame, c: cushion, h: 'rgba(255,255,255,.35)', a: '#8E929A' })
  rect(L.over, d.x, d.top, DESK_W, 4, look.top)
  rect(L.over, d.x, d.top + 4, DESK_W, 8, look.front)
  rect(L.over, d.x + 1, d.top + 12, 2, 2, '#4A2E17')
  rect(L.over, d.x + DESK_W - 3, d.top + 12, 2, 2, '#4A2E17')
  look.dress(L.over, d, color ?? '', color !== undefined)
}

// What stands in a department: the back wall's two pieces (above the clear
// columns at x+36..54 and x+82..100) and the two under the desks (x+6..34, x+54..82).
const DECOR: Record<Dept, (L: Layers, x: number, t: number) => void> = {
  research: ({ furn, floor }, x, t) => {
    bookshelf(furn, x + 2, t + 1, 30, 11)
    bookshelf(furn, x + 37, t + 1, 16, 11)
    rect(floor, x + 82, t + 1, 18, 8, '#E8D5A0'); art(floor, x + 84, t + 2, ['.gg..gg..g...', 'gggggggg.gg..', '.gggg..ggggg.', '..gg....ggg..', '.........g...'], { g: '#7BA05B' })
    rect(floor, x + 89, t + 4, 1, 1, '#D0453F')
    rect(furn, x + 20, t + 66, 2, 4, '#6B4423'); rect(furn, x + 16, t + 70, 10, 1, '#6B4423')
    art(furn, x + 16, t + 57, ['..bbbb..', '.bggbbb.', 'bbbggbbb', 'bgbbbgbb', '.bbggbb.', '..bbbb..', '...kk...', '....k...'], { b: '#38B6E0', g: '#3C9A4A', k: '#C99A1E' })
    sofa(furn, x + 58, t + 58, 16, '#2E7D4F', '#1F5A38'); rect(furn, x + 78, t + 56, 1, 12, '#C99A1E'); rect(furn, x + 76, t + 54, 5, 3, '#F5C542', ' class="lamp"')
  },
  studio: ({ furn, floor }, x, t) => {
    rect(floor, x + 37, t + 1, 16, 9, '#C9A66B')
    ;['#F5C542', '#E8A0BF', '#A9D6F5', '#7BD88F', '#F08A24', '#E5484D'].forEach((c, i) => rect(floor, x + 38 + (i % 3) * 5, t + 2 + Math.floor(i / 3) * 4, 4, 3, c))
    rect(floor, x + 83, t + 0, 16, 10, '#E6E3DA'); rect(furn, x + 98, t + 1, 3, 3, '#F4F3EE', ' class="flash"'); rect(furn, x + 99, t + 4, 1, 8, '#3A3A3C')
    art(furn, x + 12, t + 52, ['.kkkkkkkk.', '.kwwwwwwk.', '.kwbbyywk.', '.kwbyyrwk.', '.kwwgrrwk.', '.kkkkkkkk.', '..k....k..', '.k......k.', 'k........k'], { k: '#7A4A26', w: '#F4F3EE', b: '#2F6FD8', y: '#F5C542', r: '#E5484D', g: '#3C9A4A' })
    art(furn, x + 62, t + 53, ['..ss..', '.pppp.', 'pppppp', '.pppp.', '.pppp.', 'pppppp', '..kk..', '..kk..', '.kkkk.', 'kk..kk'], { s: '#C9A66B', p: '#E8A0BF', k: '#3A3A3C' })
    rect(furn, x + 72, t + 60, 1, 4, '#F5C542')
  },
  writing: ({ furn, floor }, x, t) => {
    rect(floor, x + 37, t + 1, 16, 9, '#C9A66B')
    for (let i = 0; i < 4; i++) rect(floor, x + 39 + (i % 2) * 7, t + 2 + Math.floor(i / 2) * 4, 5, 3, '#F4F3EE')
    rect(floor, x + 84, t + 1, 14, 8, '#A9D6F5', ' class="o-sky"'); rect(floor, x + 90.5, t + 1, 1, 8, '#F1ECE2'); rect(floor, x + 82, t + 0, 3, 10, '#A12C3B'); rect(floor, x + 97, t + 0, 3, 10, '#A12C3B')
    rect(furn, x + 8, t + 54, 26, 16, '#8E6F5A'); rect(furn, x + 12, t + 58, 18, 12, '#2B2524')
    art(furn, x + 15, t + 61, ['..o...o..', '.ooo.oyo.', 'ooyoooyoo', 'oyyyoyyyo', '.yyyyyyy.'], { o: '#F08A24', y: '#F5C542' }, 'fire')
    rect(furn, x + 6, t + 53, 30, 2, '#6B4423')
    sofa(furn, x + 58, t + 58, 12, '#A12C3B', '#7A1F2B')
    art(furn, x + 76, t + 62, ['.kkkk.', 'kwkwwk', 'kkkkkk', '.kkkk.', '.kkkk.'], { k: '#55514C', w: '#F4F3EE' })
  },
  engineering: ({ furn, floor }, x, t) => {
    const rack = (rx0: number, ry: number, h: number) => {
      rect(furn, rx0, ry, 14, h, '#1F2430')
      for (let yy = ry + 2; yy < ry + h - 1; yy += 3) {
        rect(furn, rx0 + 2, yy, 10, 1, '#3A3D45')
        rect(furn, rx0 + 9, yy, 1, 1, '#7BD88F', ` class="led l${(yy + rx0) % 3}"`)
        rect(furn, rx0 + 11, yy, 1, 1, '#38B6E0', ` class="led l${(yy + rx0 + 1) % 3}"`)
      }
    }
    rack(x + 38, t + 0, 12)
    rect(floor, x + 82, t + 1, 18, 8, '#F4F3EE'); rect(floor, x + 84, t + 3, 4, 3, 'none', ' stroke="#2F6FD8" stroke-width=".6"'); rect(floor, x + 92, t + 3, 4, 3, 'none', ' stroke="#E5484D" stroke-width=".6"'); rect(floor, x + 88, t + 4, 4, 0.6, '#3A3A3C')
    rect(furn, x + 6, t + 58, 28, 4, '#8E929A'); rect(furn, x + 6, t + 62, 28, 6, '#5E6168')
    rect(furn, x + 10, t + 52, 10, 6, '#3A3D45'); rect(furn, x + 12, t + 54, 6, 3, '#F08A24', ' class="live"'); rect(furn, x + 24, t + 55, 6, 2, '#C9CCD2'); rect(furn, x + 26, t + 53, 2, 2, '#C9CCD2')
    rack(x + 60, t + 50, 18)
    rack(x + 3, t + 0, 12)
  },
  qa: ({ furn, floor }, x, t) => {
    rect(floor, x + 37, t + 1, 16, 9, '#F4F3EE')
    for (let i = 0; i < 3; i++) {
      art(floor, x + 39, t + 2 + i * 3, ['....g', '...g.', 'g.g..', '.g...'].slice(0, 2), { g: '#3B9C5F' })
      rect(floor, x + 45, t + 2 + i * 3, 6, 0.6, '#8E929A')
    }
    rect(floor, x + 86, t + 1, 10, 6, '#3B9C5F'); rect(floor, x + 89, t + 2, 4, 4, '#F4F3EE'); rect(floor, x + 90.5, t + 2.5, 1, 3, '#3B9C5F'); rect(floor, x + 89.5, t + 3.5, 3, 1, '#3B9C5F')
    rect(furn, x + 6, t + 60, 28, 4, '#F4F3EE'); rect(furn, x + 6, t + 64, 28, 6, '#B8BEC9')
    art(furn, x + 16, t + 51, ['..kk..', '...k..', '..kkk.', '...k..', '..kk..', '.kkkk.', 'kkkkkk'], { k: '#3A3A3C' })
    rect(furn, x + 56, t + 60, 26, 4, '#F4F3EE'); rect(furn, x + 56, t + 64, 26, 6, '#B8BEC9')
    ;['#E5484D', '#F5C542', '#7BD88F', '#38B6E0', '#8f8cf4'].forEach((c, i) => { rect(furn, x + 59 + i * 4, t + 54, 2, 6, '#C9CCD2'); rect(furn, x + 59 + i * 4, t + 57, 2, 3, c) })
    rect(furn, x + 61, t + 52, 1, 1, '#7BD88F', ' class="bub"'); rect(furn, x + 73, t + 51, 1, 1, '#38B6E0', ' class="bub b2"')
  },
  council: ({ furn, floor }, x, t) => {
    art(floor, x + 40, t + 0, ['kkkkkkkkkk', 'krrrrrrrrk', 'krryyyyrrk', 'krryrryrrk', 'krryyyyrrk', 'krrrrrrrrk', '.krrrrrrk.', '..krrrrk..', '...krrk...', '....kk....'], { k: '#C99A1E', r: '#7A1F2B', y: '#F5C542' })
    art(floor, x + 84, t + 0, ['..yyyyyyyyyy..', '.yrrrrrrrrrry.', '.yrrrrrrrrrry.', '.yrr.yyyy.rry.', '.yrrrrrrrrrry.', '.yrrrrrrrrrry.'], { y: '#F5C542', r: '#A12C3B' })
    rect(furn, x + 84, t + 6, 14, 6, '#7A1F2B'); rect(furn, x + 86, t + 3, 10, 4, '#A12C3B')
    art(furn, x + 14, t + 52, ['kkkkkkkkkkkk', 'kwwwwwwwwwwk', '.kkkkkkkkkk.', '...kkkkkk...', '...kkkkkk...', '...kkkkkk...', '...kkkkkk...', '..kkkkkkkk..', '.kkkkkkkkkk.'], { k: '#4A2E17', w: '#E8D5A0' })
    art(furn, x + 60, t + 50, ['....kk....', '..kkkkkk..', 'kkk.kk.kkk', 'y...kk...y', 'yy..kk..yy', '....kk....', '..kkkkkk..', '.wwwwwwww.', '.wwwwwwww.', '.wwwwwwww.', '.wwwwwwww.'], { k: '#C99A1E', y: '#F5C542', w: '#E6E3DA' })
  },
  sales: ({ furn, floor }, x, t) => {
    rect(furn, x + 37, t + 0, 16, 12, '#8C5A33')
    for (let i = 0; i < 6; i++) rect(furn, x + 38 + (i % 3) * 5, t + 1 + Math.floor(i / 3) * 6, 4, 4, ['#C9A66B', '#E5484D', '#2F6FD8', '#F5C542', '#3C9A4A', '#E8A0BF'][i] as string)
    rect(floor, x + 83, t + 1, 16, 6, '#E5484D'); rect(floor, x + 85, t + 3, 12, 2, '#F4F3EE')
    art(furn, x + 8, t + 54, ['kkkkkkkkkkkkkkkkkkkkkkkk', 'kbbbrrrkyyykgggkpppkbbbk', 'kbbbrrrkyyykgggkpppkbbbk', 'kkkkkkkkkkkkkkkkkkkkkkkk', 'kcccbbbkrrrkyyykgggkccck', 'kcccbbbkrrrkyyykgggkccck', 'kkkkkkkkkkkkkkkkkkkkkkkk', 'k......................k'], { k: '#6B4423', b: '#2F6FD8', r: '#E5484D', y: '#F5C542', g: '#3C9A4A', p: '#E8A0BF', c: '#C9A66B' })
    rect(furn, x + 60, t + 56, 16, 14, '#5E6168'); rect(furn, x + 61, t + 57, 14, 12, '#8E929A'); rect(furn, x + 66, t + 61, 4, 4, '#C9CCD2'); rect(furn, x + 67.5, t + 62.5, 1, 1, '#3A3A3C')
  },
  general: ({ furn, floor }, x, t) => {
    rect(floor, x + 37, t + 1, 16, 8, '#F4F3EE'); rect(floor, x + 39, t + 3, 8, 0.6, '#2F6FD8'); rect(floor, x + 39, t + 5, 11, 0.6, '#E5484D')
    rect(floor, x + 83, t + 1, 16, 7, '#A9D6F5', ' class="o-sky"'); rect(floor, x + 90.5, t + 1, 1, 7, '#F1ECE2')
    art(furn, x + 8, t + 60, ['..pppp....oooo..', '.pppppp..oooooo.', 'pppppppp.oooooo.', 'pppppppp.oooooo.', '.pppppp...oooo..'], { p: '#8f8cf4', o: '#F08A24' })
    rect(furn, x + 62, t + 52, 6, 6, '#A9D6F5'); rect(furn, x + 61, t + 58, 8, 10, '#C9CCD2')
    plant(furn, x + 74, t + 62)
  },
}

// The ground floor and the fillers have no desks: their own furniture and spots.
type Common = { draw: (L: Layers, x: number, t: number) => void; spots: (room: Room) => Stop[] }
const COMMON: Record<'lobby' | 'cafe' | 'lounge' | 'gym' | 'greenhouse', Common> = {
  lobby: {
    draw: ({ floor, furn, over }, x, t) => {
      rect(floor, x + 18, t + 46, 40, 22, '#C0504D'); rect(floor, x + 20, t + 48, 36, 18, '#D9734E')
      rect(floor, x + 8, t + 1, 20, 6, '#A9D6F5', ' class="o-sky"'); rect(floor, x + 17, t + 1, 1, 6, '#F1ECE2')
      furn.push(`<circle cx="${x + 50}" cy="${t + 4.5}" r="3" fill="#ffffff" stroke="#3A3A3C" stroke-width=".6"/><path d="M${x + 50} ${t + 2.5}v2h1.5" stroke="#3A3A3C" stroke-width=".5" fill="none"/>`)
      rect(over, x + 14, t + 26, 38, 4, '#D9A066'); rect(over, x + 14, t + 30, 38, 8, '#8C5A33'); rect(over, x + 18, t + 21, 9, 5, '#2B2E36'); rect(over, x + 40, t + 23, 2, 3, '#F5C542')
      sofa(furn, x + 64, t + 36, 36, '#4A6FA5', '#3D5A8A')
      plant(furn, x + 3, t + 10); plant(furn, x + 98, t + 10)
      // The crab on the welcome mat by the front.
      rect(floor, x + 30, t + IN_H - 4, 46, 4, '#8C5A33')
    },
    spots: () => [],
  },
  cafe: {
    draw: ({ floor, furn }, x, t) => {
      rect(furn, x + 2, t + 6, 76, 4, '#D9D7CF'); rect(furn, x + 2, t + 10, 76, 6, '#8C5A33')
      rect(furn, x + 7, t + 0, 10, 10, '#3A3A3C'); rect(furn, x + 9, t + 2, 2, 1, '#D0453F', ' class="live"'); rect(furn, x + 12, t + 6, 2, 2, '#E6E3DA')
      rect(furn, x + 22, t + 3, 3, 3, '#F5C542'); rect(furn, x + 26, t + 3, 3, 3, '#E5484D'); rect(furn, x + 30, t + 4, 3, 2, '#C68E57')
      rect(furn, x + 36, t + 6, 14, 4, '#A9B4C2')
      rect(furn, x + 58, t + 0, 18, 6, '#2B2524'); furn.push(`<text x="${x + 60}" y="${t + 4.2}" font-family="${FONT}" font-size="3.4" fill="#F4F3EE">MENU</text>`)
      rect(furn, x + 86, t + 1, 16, 26, '#E6E8EE'); rect(furn, x + 86, t + 10, 16, 1, '#B8BEC9'); rect(furn, x + 99, t + 4, 1, 4, '#8E929A'); rect(furn, x + 99, t + 13, 1, 6, '#8E929A')
      for (const tx of [18, 58]) {
        furn.push(`<ellipse cx="${x + tx + 10}" cy="${t + 46}" rx="11" ry="5" fill="#D9A066"/><ellipse cx="${x + tx + 10}" cy="${t + 47}" rx="11" ry="5" fill="#A9713F" opacity=".5"/>`)
        rect(furn, x + tx + 8, t + 44, 3, 2, '#E6E3DA')
      }
    },
    spots: room => [st(room, 12, 24, 'cup'), st(room, 43, 24, 'drop'), st(room, 94, 34, 'apple'), st(room, 22, 58, 'cup'), st(room, 38, 58, 'chat'), st(room, 62, 58, 'cup'), st(room, 78, 58, 'chat')],
  },
  lounge: {
    draw: ({ floor, furn }, x, t) => {
      rect(floor, x + 44, t + 22, 56, 32, '#3E7F57')
      rect(furn, x + 8, t + 0, 26, 12, '#1F2430'); rect(furn, x + 9, t + 1, 24, 9, '#5B3E96', ' class="tv"'); rect(furn, x + 18, t + 12, 6, 2, '#3A3A3C')
      art(furn, x + 12, t + 22, ['.pppp.', 'pppppp', 'pppppp', '.pppp.'], { p: '#E8A0BF' })
      rect(furn, x + 52, t + 28, 40, 18, '#2E6FA8'); rect(furn, x + 52, t + 36.5, 40, 1, '#ffffff'); rect(furn, x + 71.5, t + 27, 1, 20, '#E6E8EE')
      rect(furn, x + 88, t + 0, 14, 20, '#5B3E96'); rect(furn, x + 90, t + 2, 10, 6, '#1F2430'); rect(furn, x + 91, t + 3, 8, 4, '#38B6E0', ' class="live"'); rect(furn, x + 91, t + 12, 3, 2, '#E5484D')
      sofa(furn, x + 6, t + 56, 34, '#4A6FA5', '#3D5A8A')
      art(furn, x + 50, t + 62, ['.mm.', 'mmmm'], { m: '#F5C542' }); art(furn, x + 80, t + 62, ['.mm.', 'mmmm'], { m: '#E5484D' })
    },
    spots: room => [st(room, 21, 30, 'music'), st(room, 45, 44, 'ball'), st(room, 99, 44, 'ball'), st(room, 95, 28, 'star'), st(room, 14, 66, 'zzz'), st(room, 30, 66, 'zzz')],
  },
  gym: {
    draw: ({ floor, furn }, x, t) => {
      rect(floor, x + 4, t + 1, 30, 8, '#C9CCD2'); rect(floor, x + 5, t + 2, 28, 6, '#A9D6F5', ' class="o-sky"')
      for (const tx of [10, 32]) { rect(furn, x + tx, t + 18, 14, 20, '#2B2E36'); rect(furn, x + tx + 2, t + 20, 10, 16, '#55514C', ' class="belt"'); rect(furn, x + tx, t + 14, 14, 4, '#8E929A'); rect(furn, x + tx + 4, t + 15, 6, 2, '#7BD88F', ' class="live"') }
      rect(furn, x + 56, t + 12, 30, 2, '#8E929A'); for (let i = 0; i < 5; i++) rect(furn, x + 58 + i * 6, t + 9, 3, 5, '#3A3A3C')
      rect(furn, x + 96, t + 10, 1, 8, '#8E929A'); rect(furn, x + 93, t + 18, 7, 14, '#C0392B', ' class="pbag"')
      rect(furn, x + 56, t + 58, 16, 10, '#8f8cf4'); rect(furn, x + 76, t + 58, 16, 10, '#20A39E')
    },
    spots: room => [st(room, 17, 32, 'drop'), st(room, 39, 32, 'drop'), st(room, 70, 22, 'bolt'), st(room, 88, 36, 'star'), st(room, 64, 66, 'zzz'), st(room, 84, 66, 'zzz')],
  },
  greenhouse: {
    draw: ({ floor, furn }, x, t) => {
      for (const [px, py] of [[6, 18], [56, 18], [6, 46], [56, 46]] as const) {
        rect(furn, x + px, t + py + 6, 36, 8, '#8C5A33'); rect(furn, x + px + 1, t + py + 6, 34, 2, '#5A3519')
        for (let i = 0; i < 5; i++) art(furn, x + px + 2 + i * 7, t + py, ['.f.', 'fyf', '.g.', 'ggg', '.g.', '.g.'], { f: ['#E8A0BF', '#F5C542', '#E5484D', '#8f8cf4', '#F08A24'][i] as string, y: '#F5C542', g: '#3C9A4A' })
      }
      art(furn, x + 46, t + 66, ['..kkk..', '.k...k.', 'gggggg.', 'gggggg.', '.gggg..'], { k: '#8E929A', g: '#3C9A4A' })
    },
    spots: room => [st(room, 50, 30, 'flower'), st(room, 50, 58, 'flower'), st(room, 98, 30, 'drop'), st(room, 98, 58, 'flower'), st(room, 24, 74, 'sun')],
  },
}

// --- the grounds.

const GATE_X = rx(1) + 53
const gardenSpots = (rows: number): Stop[] => {
  const g = roomTop(rows)
  const s = (x: number, dy: number, icon: Icon): Stop => ({ x, y: g + dy, icon, isGarden: true })
  return [s(96, 54, 'fish'), s(122, 46, 'fish'), s(160, 28, 'zzz'), s(GATE_X + 26, 50, 'drop'), s(268, 50, 'apple'), s(296, 50, 'cup'), s(340, 28, 'flower'), s(60, 30, 'sun')]
}

const grounds = (L: Layers, rows: number, H: number): void => {
  const { floor, furn } = L
  const g = roomTop(rows)
  rect(floor, 0, 0, LW, H, '#86B86A', ' class="o-grass"')
  for (let i = 0; i < 50; i++) {
    const r = 5 + (hash(`gr${i}`) % 10)
    floor.push(`<ellipse cx="${hash(`gx${i}`) % LW}" cy="${hash(`gy${i}`) % H}" rx="${r}" ry="${r * 0.6}" fill="${i % 2 ? 'rgba(255,255,220,.07)' : 'rgba(20,60,20,.08)'}"/>`)
  }
  for (let i = 0; i < 120; i++) rect(floor, hash(`bx${i}`) % LW, hash(`by${i}`) % H, 1, 2, i % 3 ? 'rgba(40,90,30,.3)' : 'rgba(200,240,160,.25)')
  // The path from the gate, round the fountain, out to the street.
  tiles(floor, GATE_X - 6, g, 12, GARDEN_H - 10, 6, '#D8C9A8', '#CDBD9A')
  rect(floor, 0, H - 10, LW, 10, '#B9A98A'); for (let x = 2; x < LW; x += 9) rect(floor, x, H - 6, 5, 1, 'rgba(0,0,0,.12)')
  // The fountain.
  furn.push(`<ellipse cx="${GATE_X}" cy="${g + 40}" rx="16" ry="9" fill="#B8B5AA"/><ellipse cx="${GATE_X}" cy="${g + 39}" rx="16" ry="8" fill="#CFCCC2"/><ellipse cx="${GATE_X}" cy="${g + 40}" rx="13" ry="6.5" fill="#4E9BC9"/><ellipse cx="${GATE_X - 2}" cy="${g + 39}" rx="9" ry="4" fill="#6EC0EA"/>`)
  rect(furn, GATE_X - 1.5, g + 31, 3, 9, '#B8B5AA'); rect(furn, GATE_X - 4, g + 29, 8, 2, '#B8B5AA')
  art(furn, GATE_X - 3, g + 23, ['..b..', '.b.b.', 'b...b', 'b...b'], { b: '#A9D6F5' }, 'spray')
  // The pond, with a duck.
  furn.push(`<ellipse cx="108" cy="${g + 45}" rx="25" ry="12" fill="#8E8A7E"/><ellipse cx="108" cy="${g + 44}" rx="24" ry="11" fill="#3E86B5"/><ellipse cx="104" cy="${g + 42}" rx="18" ry="7" fill="#5FB4E0"/><ellipse cx="98" cy="${g + 40}" rx="7" ry="2" fill="rgba(255,255,255,.35)"/>`)
  art(furn, 100, g + 38, ['.yy..', 'yyyyo', 'wwww.', '.ww..'], { y: '#F5E6A8', o: '#F08A24', w: '#F4F3EE' }, 'duck')
  art(furn, 118, g + 46, ['.gg.', 'gggg', '.gg.'], { g: '#3C9A4A' })
  // Bench, picnic table, flower beds, lamp posts, trees.
  rect(furn, 150, g + 22, 22, 3, '#8C5A33'); rect(furn, 150, g + 25, 22, 2, '#6B4423'); rect(furn, 152, g + 27, 2, 3, '#4A2E17'); rect(furn, 168, g + 27, 2, 3, '#4A2E17')
  rect(furn, 262, g + 36, 40, 8, '#C68E57'); rect(furn, 262, g + 34, 40, 2, '#E5484D'); rect(furn, 262, g + 44, 40, 2, '#8C5A33')
  for (let i = 0; i < 8; i++) rect(furn, 264 + i * 5, g + 34, 2, 2, '#F4F3EE')
  for (const [fx, fy] of [[320, 12], [340, 40], [210, 16]] as const) {
    rect(furn, fx, fy + g, 26, 8, '#6B4423')
    for (let i = 0; i < 6; i++) art(furn, fx + 1 + i * 4, g + fy - 2, ['.f.', 'fff', '.g.'], { f: ['#E8A0BF', '#F5C542', '#E5484D', '#8f8cf4'][i % 4] as string, g: '#3C9A4A' })
  }
  // Lamp posts: by night a soft pool of light round each head and on the path beneath.
  const lamps: string[] = []
  for (const lx of [GATE_X - 14, GATE_X + 14, 60, 250]) {
    rect(furn, lx, g + 8, 1, 12, '#3A3A3C'); rect(furn, lx - 1, g + 6, 3, 2, '#F5E6A8')
    lamps.push(`<circle cx="${lx + 0.5}" cy="${g + 7}" r="10" fill="url(#lampglow)"/><ellipse cx="${lx + 0.5}" cy="${g + 21}" rx="13" ry="5" fill="url(#lampglow)"/>`)
  }
  L.glow.push(`<radialGradient id="lampglow"><stop offset="0" stop-color="#FFE9A8"/><stop offset=".45" stop-color="#FFE9A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient><g class="o-lamp">${lamps.join('')}</g>`)
  for (const [x, y, k] of [[20, 14, 0], [34, 52, 1], [230, 50, 0], [240, 18, 1], [370, 54, 0], [190, 56, 1]] as const) tree(furn, x, g + y, k)
  // Trees down both sides of the building.
  for (let y = 4; y < g - 8; y += 22) {
    tree(furn, 2, y + (hash(`l${y}`) % 6), (y / 22) % 2)
    tree(furn, LW - 11, y + 8 + (hash(`r${y}`) % 6), ((y / 22) + 1) % 2)
  }
}

// By night the lights are on inside: a warm pool under each room's ceiling lamps, and down the hallways.
const indoorLights = (L: Layers, rooms: Room[], rows: number): void => {
  const pools = rooms.map(r => `<ellipse cx="${r.x + IN_W / 2}" cy="${r.top + IN_H / 2}" rx="${IN_W * 0.62}" ry="${IN_H * 0.66}" fill="url(#roomglow)"/>`)
  for (let r = 0; r < rows; r++) {
    for (let x = RX0 + 40; x < RIGHT; x += 90) pools.push(`<ellipse cx="${x}" cy="${hallTop(r) + HALL_H / 2}" rx="34" ry="14" fill="url(#roomglow)"/>`)
  }
  L.glow.push(`<radialGradient id="roomglow"><stop offset="0" stop-color="#FFD98A" stop-opacity=".75"/><stop offset=".6" stop-color="#FFD98A" stop-opacity=".35"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient><g class="o-light">${pools.join('')}</g>`)
}

const building = (L: Layers, rooms: Room[], rows: number, labels: OfficeLabels, counts: Map<Room, number>): void => {
  const { floor, furn } = L
  const right = RIGHT + WALL
  const bottom = roomTop(rows)
  // The building's shadow on the lawn, then its walls: lit along the top, dark below.
  rect(floor, BX + 3, BY + 4, right - BX, bottom - BY, 'rgba(0,0,0,.28)')
  rect(floor, BX, BY, right - BX, bottom - BY, '#3E4250')
  rect(floor, BX, BY, right - BX, 1.2, '#7A8094')
  rect(floor, BX, bottom - 1.2, right - BX, 1.2, '#24262E')
  // Every opening is sunk into the wall: a dark lip above and left, a lit one below and right.
  const bevel = (x: number, y: number, w: number, h: number) => {
    rect(floor, x - 1, y - 1, w + 2, 1, '#262932')
    rect(floor, x - 1, y, 1, h, '#262932')
    rect(floor, x - 1, y + h, w + 2, 1, '#6B7184')
    rect(floor, x + w, y - 1, 1, h + 1, '#565C6E')
  }
  // The corridor down the left, with stairs at each landing.
  const corrH = hallTop(rows - 1) + HALL_H - roomTop(0)
  bevel(CORR_X, roomTop(0), 20, corrH)
  tiles(floor, CORR_X, roomTop(0), 20, corrH, 10, '#E3DBC8', '#DAD1BC')
  for (let r = 0; r < rows; r++) {
    bevel(CORR_X, hallTop(r), right - CORR_X - WALL, HALL_H)
    tiles(floor, CORR_X, hallTop(r), right - CORR_X - WALL, HALL_H, 11, '#EDE6D6', '#E4DBC8')
    rect(floor, RX0 + 10, hallY(r) - 4, RIGHT - RX0 - 20, 6, '#C9B99A')
    rect(floor, RX0 + 11, hallY(r) - 3, RIGHT - RX0 - 22, 4, '#D9CDB4')
    rect(floor, CORR_X, hallTop(r), right - CORR_X - WALL, 2.5, 'rgba(0,0,0,.16)')
    for (let s = 0; s < 6; s++) {
      rect(floor, CORR_X + 2, roomTop(r) + 22 + s * 5, 16, 2, '#CFC5AE')
      rect(floor, CORR_X + 2, roomTop(r) + 24 + s * 5, 16, 0.8, 'rgba(0,0,0,.14)')
    }
    plant(furn, RX0 + 2, hallTop(r) + 1)
    plant(furn, RIGHT - 8, hallTop(r) + 1)
  }
  // The front gate onto the garden, with a doormat.
  rect(floor, GATE_X - 8, roomTop(rows) - WALL - 0.6, 16, WALL + 0.6, '#D8C9A8')
  rect(floor, GATE_X - 6, roomTop(rows) - WALL, 12, 3, '#8C5A33')
  // The ground hallway's water cooler and printer.
  const ht = hallTop(rows - 1)
  rect(furn, 132, ht, 6, 6, '#A9D6F5'); rect(furn, 131, ht + 6, 8, 6, '#C9CCD2')
  rect(furn, 300, ht + 1, 13, 9, '#E6E8EE'); rect(furn, 302, ht, 9, 2, '#F8F6F1'); rect(furn, 300, ht + 6, 13, 1, '#8E929A')

  type Floor = ['planks' | 'carpet', string, string] | ['tiles', string, string, number]
  const floors: Record<RoomKind, Floor> = {
    research: ['planks', '#D9BE94', '#CDAF83'],
    studio: ['tiles', '#EEE9E0', '#E4DED3', 17],
    writing: ['planks', '#B98A5B', '#A97A4D'],
    engineering: ['tiles', '#D5D9E0', '#C8CDD6', 10],
    qa: ['tiles', '#EEF2F3', '#DCE4E6', 8],
    council: ['carpet', '#8E3A3A', '#C9A66B'],
    sales: ['planks', '#E3CBA2', '#D6BC92'],
    general: ['planks', '#EADFC8', '#DDD0B4'],
    lobby: ['planks', '#E3CBA2', '#D6BC92'],
    cafe: ['tiles', '#EDEFF3', '#C9D0DB', 8],
    lounge: ['planks', '#C99A6A', '#B98A5B'],
    gym: ['carpet', '#4A4F5C', '#5E6372'],
    greenhouse: ['tiles', '#CFE3C0', '#BFD8AE', 12],
  }
  // The back wall's face, papered in some rooms, over a skirting board.
  const faces: Partial<Record<RoomKind, [string, boolean]>> = {
    council: ['#7A2F33', true],
    writing: ['#C9B08A', true],
    lobby: ['#EFE3CC', true],
    lounge: ['#E6D3B8', true],
    engineering: ['#C9CED8', false],
    qa: ['#E1EAEC', false],
    studio: ['#F6F2EC', false],
    gym: ['#5E6372', false],
    greenhouse: ['#DDEFF5', false],
  }
  for (const room of rooms) {
    const { x, top: t, kind } = room
    bevel(x, t, IN_W, IN_H)
    const f = floors[kind]
    if (f[0] === 'tiles') tiles(floor, x, t + 12, IN_W, IN_H - 12, f[3], f[1], f[2])
    else if (f[0] === 'carpet') carpet(floor, x, t + 12, IN_W, IN_H - 12, f[1], f[2])
    else planks(floor, x, t + 12, IN_W, IN_H - 12, f[1], f[2])
    const [face, isPapered] = faces[kind] ?? ['#EFE8DA', false]
    rect(floor, x, t, IN_W, 12, face)
    if (isPapered) for (let sx = 2; sx < IN_W; sx += 4) rect(floor, x + sx, t + 1.5, 0.7, 8.5, 'rgba(0,0,0,.07)')
    rect(floor, x, t, IN_W, 1.5, 'rgba(255,255,255,.3)')
    rect(floor, x, t + 10, IN_W, 2, kind === 'council' ? '#C9A66B' : '#8C6A4A')
    rect(floor, x, t + 10, IN_W, 0.6, 'rgba(255,255,255,.3)')
    // The walls' shade on the floor: along the back wall and down the left.
    rect(floor, x, t + 12, IN_W, 2.5, 'rgba(0,0,0,.16)')
    rect(floor, x, t + 12, 2, IN_H - 12, 'rgba(0,0,0,.10)')
    // The door, with a threshold strip.
    rect(floor, doorX(room) - 8, t + IN_H, 16, WALL + 0.6, '#E4DBC8')
    rect(floor, doorX(room) - 8, t + IN_H, 16, 1, '#B8AC98')
  }
  // Each room's name on its back wall, with how many work there.
  for (const room of rooms) {
    const label = labels[room.kind]
    const count = counts.get(room) ?? 0
    const lw = Math.round(textW(label, 5) + (count ? 16 : 8))
    const lx = room.x + IN_W / 2 - lw / 2
    furn.push(`<rect x="${lx}" y="${room.top - 6}" width="${lw}" height="8" rx="2" fill="#2B2E36"/><text x="${lx + 4}" y="${room.top}" font-family="${FONT}" font-size="5" font-weight="700" fill="#ffffff">${xml(label)}</text>`)
    if (count) furn.push(`<circle cx="${lx + lw - 5}" cy="${room.top - 2}" r="2.6" fill="#8f8cf4"/><text x="${lx + lw - 5}" y="${room.top - 0.3}" text-anchor="middle" font-family="${FONT}" font-size="4" font-weight="700" fill="#ffffff">${count}</text>`)
  }
}

// --- the scene.

export type OfficeInput = {
  W: number
  crabs: OfficeCrab[]
  labels: OfficeLabels
  /** Milliseconds: where each loop is when the scene is drawn. */
  now: number
  /** The crabs' own CSS (their walk and prop animations). */
  crabCss: string
  /** The words for a working crab with nothing to say. */
  working: string
}

export const MAX_RESTING = 12

// Which rooms stand: a department for every team that has a crab, filled out to
// whole floors with a gym and a greenhouse, over the ground floor.
export const layoutOf = (all: readonly OfficeCrab[]): { rooms: Room[]; rows: number } => {
  const crabs = all.filter(c => !c.isLead)
  const present = new Set(crabs.map(c => deptOf(c.costume)))
  // A department's overflow works in the open space.
  const running = new Map<Dept, number>()
  for (const c of crabs) if (c.status === 'running') running.set(deptOf(c.costume), (running.get(deptOf(c.costume)) ?? 0) + 1)
  if ([...running.entries()].some(([d, n]) => d !== 'general' && n > 4)) present.add('general')
  const kinds: RoomKind[] = DEPTS.filter(d => present.has(d))
  const fillers: RoomKind[] = ['gym', 'greenhouse']
  while (kinds.length % 3) kinds.push(fillers.shift() ?? 'general')
  kinds.push('lobby', 'cafe', 'lounge')
  const rows = kinds.length / 3
  return { rooms: kinds.map((kind, i) => ({ kind, r: Math.floor(i / 3), c: i % 3, x: rx(i % 3), top: roomTop(Math.floor(i / 3)) })), rows }
}

export const officeHeight = (W: number, crabs: readonly OfficeCrab[]): number => Math.round((W * heightOf(layoutOf(crabs).rows)) / LW)

export const officeSvg = ({ W, crabs, labels, now, crabCss, working }: OfficeInput): string[] => {
  const { rooms, rows } = layoutOf(crabs)
  const H = heightOf(rows)
  const roomFor = (k: RoomKind): Room | undefined => rooms.find(r => r.kind === k)
  const lobby = roomFor('lobby') as Room
  const cafe = roomFor('cafe') as Room

  // Seats: each department's four desks by arrival; the overflow goes to the open space.
  const seats = new Map<Room, Desk[]>()
  for (const room of rooms) if ((DEPTS as readonly string[]).includes(room.kind)) seats.set(room, desksOf(room))
  const taken = new Map<Desk, string>()
  const workers: { c: OfficeCrab; desk: Desk }[] = []
  for (const c of crabs.filter(c => c.status === 'running' && !c.isLead)) {
    const own = roomFor(deptOf(c.costume))
    const open = roomFor('general')
    const desk = [own, open].flatMap(r => (r ? (seats.get(r) ?? []) : [])).find(d => !taken.has(d))
    if (!desk) continue
    taken.set(desk, c.color)
    workers.push({ c, desk })
  }
  const counts = new Map<Room, number>()
  for (const w of workers) counts.set(w.desk.room, (counts.get(w.desk.room) ?? 0) + 1)

  const lead = crabs.find(c => c.isLead)
  const others = crabs.filter(c => !c.isLead)
  const resting = others.filter(c => c.status === 'done').slice(0, MAX_RESTING)
  const waiting = [...others.filter(c => c.status === 'failed'), ...others.filter(c => c.status === 'planned')]

  const hallStops = [{ x: 135, y: hallY(rows - 1), icon: 'drop' as const, hall: rows - 1 }, { x: 306, y: hallY(rows - 1), icon: 'paper' as const, hall: rows - 1 }]
  const cafeSpots = COMMON.cafe.spots(cafe)
  const breakSpots: Stop[] = [
    ...rooms.flatMap(r => (r.kind === 'lounge' || r.kind === 'cafe' || r.kind === 'gym' || r.kind === 'greenhouse' ? COMMON[r.kind].spots(r) : [])),
    ...gardenSpots(rows),
  ]

  // Each crab: its own CSS (the loops), its body, and its tag; packed into Svgs below.
  const placed: { css: string; body: string; tag: string }[] = []
  const sec = now / 1000

  const place = (c: OfficeCrab, i: number, visits: Visit[], speed: number, isWalking: boolean) => {
    const css: string[] = []
    const loop = loopOf(visits, speed, rows)
    const P = loop.period
    const delay = -(((sec + (hash(c.id) % 997) * 0.731) % P) + P) % P
    const anim = (name: string, timing: string) => `animation:${name} ${P.toFixed(3)}s ${timing} infinite ${delay.toFixed(3)}s`
    const home = visits[0]?.at ?? (hallStops[0] as Stop)
    if (visits.length > 1) {
      css.push(`.mv${i}{transform:${at(home)};${anim(`mv${i}`, 'linear')}}`)
      css.push(`@keyframes mv${i}{${loop.moves.map(m => `${pct(m.t, P)}{transform:${at(m)}}`).join('')}100%{transform:${at(home)}}}`)
      if (loop.faces.length > 1) {
        css.push(`.fl${i}{${anim(`fl${i}`, 'step-end')}}`)
        css.push(`@keyframes fl${i}{${loop.faces.map(f => `${pct(f.t, P)}{transform:${f.f < 0 ? FLIP : 'none'}}`).join('')}100%{transform:none}}`)
      }
    } else {
      css.push(`.mv${i}{transform:${at(home)}}`)
    }
    const bubbles = visits
      .map((v, j) => {
        const show = loop.shows[j]
        if (!show) return ''
        if (visits.length === 1) return `<g>${bubble(v)}</g>`
        css.push(`.bb${i}_${j}{opacity:${j === 0 ? 1 : 0};${anim(`bb${i}_${j}`, 'step-end')}}`)
        css.push(`@keyframes bb${i}_${j}{0%{opacity:${show.from === 0 ? 1 : 0}}${show.from === 0 ? '' : `${pct(show.from, P)}{opacity:1}`}${pct(show.to, P)}{opacity:0}100%{opacity:0}}`)
        return `<g class="om bb${i}_${j}">${bubble(v)}</g>`
      })
      .join('')
    // Body and tag ride the same loop in two layers: furniture hides a body, never its tag.
    placed.push({
      css: css.join(''),
      body: `<g class="om mv${i}"><ellipse cx="${FOOT_X}" cy="${FOOT_Y - 0.4}" rx="6.5" ry="1.8" fill="rgba(0,0,0,.28)"/><g class="om fl${i}">${compact(c.draw(isWalking))}</g></g>`,
      tag: `<g class="om mv${i}">${nameTag(c)}${bubbles}</g>`,
    })
  }

  let n = 0
  // The lead behind the front desk; while working, off to check on each busy room and back.
  if (lead) {
    const desk = st(lobby, 33, 25, 'dots', [{ x: 58, y: 25 }])
    const text = lead.activity || working
    const visits: Visit[] = [{ at: desk, dwell: 20, text }]
    const busy = [...new Set(workers.map(w => w.desk.room))].slice(0, 3)
    if (lead.status === 'running') {
      for (const room of busy) {
        const w = workers.find(w => w.desk.room === room) as (typeof workers)[number]
        visits.push({ at: besideDesk(w.desk), dwell: 4 }, { at: desk, dwell: 16, text })
      }
    } else {
      visits.push({ at: cafeSpots[0] as Stop, dwell: 6 }, { at: desk, dwell: 16, text })
    }
    if (visits.length > 1) visits.pop()
    place(lead, n++, visits, 32, true)
  }
  workers.forEach(({ c, desk }) => {
    const r = rng(hash(c.id))
    const home = seatOf(desk)
    const text = c.activity || working
    const mates = workers.filter(w => w.c !== c).map(w => w.desk)
    const visits: Visit[] = [{ at: home, dwell: 12 + r() * 8, text }]
    for (let trip = 0; trip < 3; trip++) {
      // Mostly errands that suit the department; now and then coffee, the hallway, or a chat.
      const roll = r()
      const errand =
        roll < 0.5
          ? pick(r, errandsOf(desk.room))
          : roll < 0.72
            ? pick(r, cafeSpots.slice(0, 3))
            : roll < 0.86 || !mates.length
              ? pick(r, hallStops)
              : besideDesk(pick(r, mates))
      visits.push({ at: errand, dwell: 4 + r() * 3 })
      visits.push({ at: home, dwell: 12 + r() * 8, text })
    }
    visits.pop()
    place(c, n++, visits, 20, true)
  })
  resting.forEach(c => {
    const r = rng(hash(c.id))
    const pool = [...breakSpots]
    const visits: Visit[] = []
    for (let j = 0; j < 4 && pool.length; j++) visits.push({ at: pool.splice(Math.floor(r() * pool.length), 1)[0] as Stop, dwell: 6 + r() * 7 })
    place(c, n++, visits, 12, true)
  })
  // The lobby: the sofa, then a row by the door; failed crabs at the front desk.
  const lobbySpots = [st(lobby, 68, 46, 'wait'), st(lobby, 96, 46, 'wait'), ...[0, 1, 2, 3].map(i => st(lobby, 14 + i * 28, IN_H - 8, 'wait'))]
  let queued = 0
  let failed = 0
  waiting.forEach(c => {
    const isFailed = c.status === 'failed'
    const spot = isFailed ? st(lobby, 22 + (failed++ % 3) * 10, 56, 'bang') : lobbySpots[queued++]
    if (!spot) return
    place(c, n++, [{ at: spot, dwell: 1 }], 12, false)
  })

  const L = newLayers()
  cur = L
  grounds(L, rows, H)
  building(L, rooms, rows, labels, counts)
  indoorLights(L, rooms, rows)
  for (const room of rooms) {
    if ((DEPTS as readonly string[]).includes(room.kind)) {
      const dept = room.kind as Dept
      DECOR[dept](L, room.x, room.top)
      for (const d of seats.get(room) ?? []) drawDesk(L, d, dept, taken.get(d))
    } else {
      COMMON[room.kind as keyof typeof COMMON].draw(L, room.x, room.top)
    }
  }

  // Paint order, each piece tagged with the group it belongs in and the CSS it needs.
  type Piece = { wrap: string; html: string; css?: string; isCrab?: boolean }
  const CRISP = 'shape-rendering="crispEdges"'
  const FX = `${CRISP} filter="url(#ofx)"`
  const pieces: Piece[] = [
    ...L.floor.map(html => ({ wrap: CRISP, html })),
    ...L.furn.map(html => ({ wrap: FX, html })),
    ...L.furnAnim.map(html => ({ wrap: CRISP, html })),
    ...placed.map(p => ({ wrap: '', html: p.body, css: p.css, isCrab: true })),
    ...L.over.map(html => ({ wrap: FX, html })),
    ...L.overAnim.map(html => ({ wrap: CRISP, html })),
    { wrap: '', html: skyOf(rows, H) },
    ...L.glow.map(html => ({ wrap: '', html })),
    ...placed.map(p => ({ wrap: '', html: p.tag, css: p.css })),
  ]
  return pack(pieces, W, H, crabCss, dayCss(now))
}

// --- the day: the light at each hour, as [hour, dark outdoors, dark indoors, warm glow, lamps, sky].
type Light = readonly [number, number, number, number, number, string]
const DAY: readonly Light[] = [
  [0, 0.48, 0.1, 0, 1, '#1B2550'],
  [4.5, 0.48, 0.1, 0, 1, '#1B2550'],
  [5.5, 0.26, 0.05, 0.14, 0.8, '#5B5A8C'],
  [6.25, 0.06, 0.02, 0.2, 0.3, '#F2B38A'],
  [7.25, 0, 0, 0, 0, '#A9D6F5'],
  [17.25, 0, 0, 0, 0, '#A9D6F5'],
  [18.5, 0.08, 0.02, 0.24, 0.5, '#F08A5D'],
  [19.5, 0.28, 0.06, 0.12, 1, '#4A3F7A'],
  [20.75, 0.48, 0.1, 0, 1, '#1B2550'],
  [24, 0.48, 0.1, 0, 1, '#1B2550'],
]
const DAY_S = 86_400

// Seconds since local midnight: where the day's loop is when the scene is drawn.
const daySec = (now: number): number => {
  const d = new Date(now)
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
}

// The light now, for a viewer whose animations do not run: the key before this hour.
const lightAt = (sec: number): Light => [...DAY].reverse().find(k => k[0] * 3600 <= sec) ?? (DAY[0] as Light)

const LIGHTS: readonly [string, string, (k: Light) => string][] = [
  ['o-out', 'opacity', k => String(k[1])],
  ['o-in', 'opacity', k => String(k[2])],
  ['o-warm', 'opacity', k => String(k[3])],
  ['o-lamp', 'opacity', k => String(k[4] * 0.85)],
  ['o-light', 'opacity', k => String(k[4] * 0.4)],
  ['o-sky', 'fill', k => k[5]],
]

export const dayCss = (now: number): string => {
  const sec = daySec(now)
  const light = lightAt(sec)
  return LIGHTS.map(
    ([cls, prop, val]) =>
      `.${cls}{${prop}:${val(light)};animation:${cls} ${DAY_S}s linear infinite -${sec}s}` +
      `@keyframes ${cls}{${DAY.map(k => `${((k[0] / 24) * 100).toFixed(3)}%{${prop}:${val(k)}}`).join('')}}`,
  ).join('')
}

// The night over the scene: deeper outdoors than in the lit building, and a warm wash at dawn and dusk.
const skyOf = (rows: number, H: number): string => {
  const right = RIGHT + WALL
  const bottom = roomTop(rows)
  return `<path class="o-out" fill="#0B1030" fill-rule="evenodd" d="M0 0H${LW}V${H}H0z M${BX} ${BY}V${bottom}H${right}V${BY}z"/>` +
    `<rect class="o-in" fill="#0B1030" x="${BX}" y="${BY}" width="${right - BX}" height="${bottom - BY}"/>` +
    `<rect class="o-warm" fill="#FF7A2F" width="${LW}" height="${H}"/>`
}

const SCENE_CSS = `.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
.led{animation:p 1s steps(1) infinite}.l1{animation-delay:-.33s}.l2{animation-delay:-.66s;animation-duration:.7s}
.fire{animation:fl .4s steps(1) infinite}@keyframes fl{50%{transform:translateY(-.6px);opacity:.75}}
.bub{animation:bu 1.2s steps(3) infinite}.b2{animation-delay:-.6s}@keyframes bu{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-4px);opacity:0}}
.spray{animation:p 1s steps(2) infinite}.duck{animation:dk 6s ease-in-out infinite}@keyframes dk{50%{transform:translateX(-10px)}}
.flash{animation:fs 3s steps(1) infinite}@keyframes fs{0%,90%{opacity:.3}95%{opacity:1}}
.tv{animation:tv 2s steps(4) infinite}@keyframes tv{25%{fill:#20A39E}50%{fill:#E5484D}75%{fill:#F5C542}}
.belt{animation:p .5s steps(1) infinite}.pbag{transform-origin:50% 0;transform-box:fill-box;animation:sw 1.5s ease-in-out infinite}@keyframes sw{50%{transform:rotate(6deg)}}
.lamp{opacity:.8}
@media (prefers-reduced-motion: reduce){.om,.live,.led,.fire,.bub,.spray,.duck,.flash,.tv,.belt,.pbag{animation:none!important}}`

const FILTER = `<filter id="ofx" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
<feMorphology in="SourceAlpha" operator="dilate" radius=".55" result="d"/>
<feFlood flood-color="#1B1A22" flood-opacity=".55"/><feComposite in2="d" operator="in" result="o"/>
<feOffset in="d" dx=".9" dy="1.8" result="s0"/><feFlood flood-color="#000" flood-opacity=".24"/><feComposite in2="s0" operator="in" result="s"/>
<feMerge><feMergeNode in="s"/><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`

// Fills Svgs in paint order (each with the scene's CSS and the light of the hour), starting a new one before a piece would take one past
// the limit. Stacked one over another, the Svgs draw the scene a single one would.
const pack = (pieces: { wrap: string; html: string; css?: string; isCrab?: boolean }[], W: number, H: number, crabCss: string, lightCss: string): string[] => {
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.round((W * H) / LW)}" viewBox="0 0 ${LW} ${H}">`
  const out: string[] = []
  let body = ''
  let css = ''
  let wrap: string | null = null
  let hasCrab = false
  let usesFilter = false
  let usesIcons = false
  const sizeOf = () => head.length + SCENE_CSS.length + lightCss.length + (hasCrab ? crabCss.length : 0) + css.length + body.length + 4000
  const flush = () => {
    if (wrap !== null) body += '</g>'
    if (body) {
      const defs = `${usesFilter ? FILTER : ''}${usesIcons ? iconDefs() : ''}`
      out.push(`${head}<style>${SCENE_CSS}${lightCss}${css}</style>${hasCrab ? crabCss : ''}${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`)
    }
    body = ''
    css = ''
    wrap = null
    hasCrab = false
    usesFilter = false
    usesIcons = false
  }
  for (const p of pieces) {
    const extra = p.html.length + (p.css?.length ?? 0) + (p.isCrab && !hasCrab ? crabCss.length : 0) + p.wrap.length + 20
    if (body && sizeOf() + extra > PACK_AT) flush()
    if (wrap !== p.wrap) {
      if (wrap !== null) body += '</g>'
      body += p.wrap ? `<g ${p.wrap}>` : '<g>'
      wrap = p.wrap
    }
    body += p.html
    if (p.css && !css.includes(p.css)) css += p.css
    if (p.isCrab) hasCrab = true
    if (p.wrap.includes('filter')) usesFilter = true
    if (p.html.includes('href="#i-')) usesIcons = true
  }
  flush()
  return out
}
