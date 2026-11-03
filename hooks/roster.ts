// Autumn's fork: the crab roster. Every ROLE is a group of crabs: slot 0 is the
// role's own crab, slot 1, 2... the siblings that step in when more agents of the
// role run at once. Each crab has a fixed name and a fixed look (costume, accent
// variant, prop), kept in a JSON file across sessions. No two crabs share a name,
// and no two look alike. Pure functions; the file I/O is in register.tsx.

import { accentOf, isClose } from './colors'
import { NAMES, POOL, hash, roleOf, typeCostume } from './roles'

/** One crab of a role: its fixed name and look. */
export type Member = {
  name: string
  costume: string
  /** 0 is the costume's own accent; n is the nth palette hue. */
  variant: number
  /** 0 is the costume's own prop; n swaps the held tool (artist, tailor) or adds charm n. */
  prop: number
}

export type Group = { role: string; crabs: Member[] }

export type Roster = { version: 2; roles: Group[] }

/** A member with its role and slot, as an agent wears it. */
export type Crab = Member & { role: string; slot: number }

/** Every costume a crab can wear: roles, the pool, then the savvy tiers. */
export const ALL_COSTUMES: readonly string[] = [
  'devil', 'professor', 'rocket', 'traveller', 'stopwatch', 'judge', 'crown', 'toga', 'tailor', 'director', 'artist',
  'writer', 'photographer', 'shopkeeper', 'scientist', 'explorer', 'hacker', 'builder',
  ...POOL,
  'fable', 'heavy', 'careful', 'medium', 'light',
]

/** How a role is matched: case, spacing and punctuation do not count. */
export const roleKey = (role: string): string => role.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export const lookKey = (c: { costume: string; variant: number; prop: number }): string => `${c.costume}#${c.variant}#${c.prop}`

type Look = { costume: string; variant: number; prop: number }

/** Two looks a glance cannot tell apart: same costume, same prop, accents of a like hue. */
export const looksAlike = (a: Look, b: Look): boolean =>
  a.costume === b.costume && a.prop === b.prop && isClose(accentOf(a.costume, a.variant), accentOf(b.costume, b.variant))

const titleCase = (s: string): string =>
  s.trim().replace(/\s+/g, ' ').replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase())

// The keyword table's labels, as roles are named in the roster.
const RELABEL: Record<string, string> = { 'Peer review': 'Peer reviewer', Coder: 'Mod engineer' }

// Words after "Role:" that are a task, not a specialty ("Designer: critique").
const TASK_WORDS = new Set([
  'add', 'audit', 'build', 'check', 'clean', 'critique', 'design', 'draft', 'edit', 'find', 'fix', 'make', 'plan',
  'polish', 'refactor', 'research', 'review', 'run', 'ship', 'test', 'tidy', 'update', 'verify', 'write',
])

const TYPE_ROLE: Record<string, string> = { 'general purpose': 'Generalist', explore: 'Explorer', plan: 'Planner', fork: 'Fork' }

/**
 * The role an agent plays, from its Agent `description` and `subagent_type`:
 * a keyword role ("Council: The Contrarian" is Contrarian), a one-word specialty
 * after it ("Researcher: typography"), else a "Prefix:" the description starts
 * with ("Ops: rotate keys" is Ops), else its type (general-purpose is Generalist).
 */
export const normaliseRole = (description: string | undefined, type?: string): string => {
  const d = (description ?? '').trim()
  const role = roleOf(d)
  const head = /^([^:]{1,40}):\s*(.+)$/.exec(d)
  if (role) {
    let name = RELABEL[role.label] ?? role.label
    if (name === 'Writer' && /\bhumani[sz]er?\b/i.test(d)) name = 'Humanizer'
    const q = head?.[2]?.trim() ?? ''
    const isSpecialty =
      head && roleOf(head[1])?.label === role.label && /^[\p{L}\p{N}-]{2,24}$/u.test(q) && !TASK_WORDS.has(q.toLowerCase()) && !roleOf(q)
    return isSpecialty ? `${name}: ${q.toLowerCase()}` : name
  }
  if (head?.[1]) return titleCase(head[1])
  const bare = (type ?? '').replace(/^[^:]*:/, '')
  const tier = /^savvy-(\w+)$/i.exec(bare)
  if (tier?.[1]) return `Savvy ${tier[1].toLowerCase()}`
  const key = roleKey(bare)
  if (!key) return 'Generalist'
  return TYPE_ROLE[key] ?? titleCase(key)
}

/** The costume a role starts from: its keyword's, its type's, else a pool one by the role's name. */
export const baseCostume = (role: string, description?: string, type?: string): string =>
  roleOf(description)?.costume ?? roleOf(role)?.costume ?? typeCostume(type) ?? (POOL[hash(roleKey(role)) % POOL.length] as string)

const one = (role: string, name: string, costume: string, variant = 0, prop = 0): Group => ({ role, crabs: [{ name, costume, variant, prop }] })

// Seeded with the roles this setup uses. Designers come with three siblings:
// a blue beret with a pencil, a red one with colour swatches, a green one with a roller.
export const SEED: readonly Group[] = [
  one('Contrarian', 'Pepper', 'devil'),
  one('First Principles', 'Otto', 'professor'),
  one('Expansionist', 'Nova', 'rocket'),
  one('Outsider', 'Wren', 'traveller'),
  one('Executor', 'Dot', 'stopwatch'),
  one('Peer reviewer', 'Hazel', 'judge'),
  one('Chairman', 'Hugo', 'crown'),
  one('Council', 'Olive', 'toga'),
  {
    role: 'Designer',
    crabs: [
      { name: 'Coco', costume: 'artist', variant: 0, prop: 0 },
      { name: 'Mabel', costume: 'artist', variant: 1, prop: 1 },
      { name: 'Ruby', costume: 'artist', variant: 2, prop: 2 },
      { name: 'Taro', costume: 'artist', variant: 3, prop: 3 },
    ],
  },
  one('Costume designer', 'Bobbin', 'tailor'),
  one('Motion designer', 'Ziggy', 'director'),
  one('Researcher', 'Indy', 'explorer'),
  one('Researcher: typography', 'Fig', 'explorer', 1, 1),
  one('Explorer', 'Juno', 'explorer', 2, 2),
  one('Builder', 'Gus', 'builder'),
  one('Mod engineer', 'Pip', 'hacker'),
  one('Writer', 'Quill', 'writer'),
  one('Humanizer', 'Honey', 'writer', 2, 1),
  one('Photographer', 'Kiki', 'photographer'),
  one('Seller', 'Penny', 'shopkeeper'),
  one('QA', 'Sage', 'scientist'),
  one('Generalist', 'Bean', 'wizard'),
]

const copy = (g: Group): Group => ({ role: g.role, crabs: g.crabs.map(c => ({ ...c })) })

export const seedRoster = (): Roster => ({ version: 2, roles: SEED.map(copy) })

/** Every crab of the roster, with its role and slot. */
export const members = (r: Roster): Crab[] => r.roles.flatMap(g => g.crabs.map((c, slot) => ({ ...c, role: g.role, slot })))

export const findGroup = (r: Roster, role: string): Group | undefined => r.roles.find(g => roleKey(g.role) === roleKey(role))

/** The role's own crab (slot 0). */
export const findCrab = (r: Roster, role: string): Crab | undefined => {
  const g = findGroup(r, role)
  const c = g?.crabs[0]
  return g && c ? { ...c, role: g.role, slot: 0 } : undefined
}

const isMember = (c: unknown): c is Member => {
  const x = c as Member
  return !!x && typeof x.name === 'string' && !!x.name.trim() && typeof x.costume === 'string' && ALL_COSTUMES.includes(x.costume) &&
    Number.isInteger(x.variant) && x.variant >= 0 && Number.isInteger(x.prop ?? 0) && (x.prop ?? 0) >= 0
}

/**
 * Reads a roster file's text, version 2 or the version 1 list of one crab per
 * role (moved over: a seed role takes its seed group, any other keeps its crab).
 * Unreadable gives null. A crab that repeats a name or the look of one before
 * it is dropped, so the roster stays unique after a hand edit; seed roles the
 * file lacks are added back.
 */
export const parseRoster = (text: string): Roster | null => {
  let raw: { version?: number; roles?: unknown; crabs?: unknown }
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  let groups: { role: string; crabs: unknown[] }[]
  if (Array.isArray(raw.roles)) {
    groups = (raw.roles as Group[]).filter(g => g && typeof g.role === 'string' && Array.isArray(g.crabs))
  } else if (Array.isArray(raw.crabs)) {
    groups = (raw.crabs as (Member & { role: string })[])
      .filter(c => c && typeof c.role === 'string')
      .map(c => SEED.find(s => roleKey(s.role) === roleKey(c.role)) ?? { role: c.role, crabs: [{ ...c, prop: c.prop ?? 0 }] })
  } else return null

  const out: Group[] = []
  const names = new Set<string>()
  const kept: Look[] = []
  for (const g of groups) {
    if (!roleKey(g.role) || out.some(o => roleKey(o.role) === roleKey(g.role))) continue
    const crabs: Member[] = []
    for (const c of g.crabs.filter(isMember)) {
      const m = { name: c.name.trim(), costume: c.costume, variant: c.variant, prop: c.prop ?? 0 }
      if (names.has(m.name.toLowerCase()) || kept.some(k => looksAlike(k, m))) {
        if (!crabs.length) break // a role whose own crab is gone starts over
        continue
      }
      names.add(m.name.toLowerCase())
      kept.push(m)
      crabs.push(m)
    }
    if (crabs.length) out.push({ role: g.role.trim(), crabs })
  }
  let roster: Roster = { version: 2, roles: out }
  for (const s of SEED) {
    if (findGroup(roster, s.role)) continue
    const fits = s.crabs.every(c => !names.has(c.name.toLowerCase()) && !kept.some(k => looksAlike(k, c)))
    roster = fits ? { version: 2, roles: [...roster.roles, copy(s)] } : assign(roster, s.role, s.crabs[0]?.costume ?? 'wizard').roster
  }
  return roster
}

export const serializeRoster = (r: Roster): string => JSON.stringify(r, null, 2) + '\n'

const freeName = (role: string, taken: Set<string>): string => {
  const start = hash(roleKey(role)) % NAMES.length
  const at = (i: number) => NAMES[(start + i) % NAMES.length] as string
  for (let i = 0; i < NAMES.length; i++) if (!taken.has(at(i).toLowerCase())) return at(i)
  for (let n = 2; ; n++) for (let i = 0; i < NAMES.length; i++) if (!taken.has(`${at(i)} ${n}`.toLowerCase())) return `${at(i)} ${n}`
}

// The looks a role's own crab tries, in order: its costume in its own and then
// palette accents, pool costumes from the role's hashed slot, every costume's
// accents, then its costume with ever more props (a look is always free).
function* mainLooks(base: string, role: string): Generator<Look> {
  for (let v = 0; v < 6; v++) yield { costume: base, variant: v, prop: 0 }
  const start = hash(roleKey(role)) % POOL.length
  for (let i = 0; i < POOL.length; i++) yield { costume: POOL[(start + i) % POOL.length] as string, variant: 0, prop: 0 }
  for (let v = 0; v < 11; v++) for (const c of ALL_COSTUMES) yield { costume: c, variant: v, prop: 0 }
  for (let p = 1; ; p++) for (let v = 0; v < 11; v++) yield { costume: base, variant: v, prop: p }
}

// A sibling keeps the role's costume and takes a hue and a prop no crab of its
// role has, so siblings on screen together differ in colour AND prop.
function* siblingLooks(group: Group): Generator<Look> {
  const costume = group.crabs[0]?.costume ?? 'wizard'
  const hues = group.crabs.map(c => accentOf(c.costume, c.variant))
  const props = new Set(group.crabs.map(c => c.prop))
  for (let v = 1; v < 400; v++) {
    if (hues.some(h => isClose(h, accentOf(costume, v)))) continue
    for (let p = 0; p < 50; p++) if (!props.has(p)) yield { costume, variant: v, prop: p }
  }
  for (let p = 0; ; p++) for (let v = 1; v < 400; v++) yield { costume, variant: v, prop: p }
}

const firstFree = (gen: Generator<Look>, taken: readonly Look[]): Look => {
  for (const l of gen) if (!taken.some(t => looksAlike(t, l))) return l
  throw new Error('unreachable: the generators never end')
}

/**
 * The crab for `role` in `slot` (0 the role's own, 1.. its siblings): the
 * roster's, or new ones appended (every missing slot up to `slot`) with names
 * and looks no other crab has. Returns the roster unchanged when it exists.
 */
export const assign = (r: Roster, role: string, base: string, slot = 0): { roster: Roster; crab: Crab; isNew: boolean } => {
  const all = members(r)
  const names = new Set(all.map(c => c.name.toLowerCase()))
  const taken: Look[] = [...all]
  let group = findGroup(r, role)
  let isNew = false
  let roles = r.roles
  if (!group) {
    const look = firstFree(mainLooks(ALL_COSTUMES.includes(base) ? base : 'wizard', role), taken)
    const name = freeName(role, names)
    group = { role: role.trim(), crabs: [{ name, ...look }] }
    names.add(name.toLowerCase())
    taken.push(look)
    roles = [...roles, group]
    isNew = true
  }
  while (group.crabs.length <= slot) {
    const look = firstFree(siblingLooks(group), taken)
    const name = freeName(`${role} ${group.crabs.length}`, names)
    const grown: Group = { role: group.role, crabs: [...group.crabs, { name, ...look }] }
    names.add(name.toLowerCase())
    taken.push(look)
    roles = roles.map(g => (g === group ? grown : g))
    group = grown
    isNew = true
  }
  const c = group.crabs[slot] as Member
  return { roster: isNew ? { version: 2, roles } : r, crab: { ...c, role: group.role, slot }, isNew }
}

/** The lowest slot (0 up) no running agent of the same role holds. */
export const freeSlot = (held: readonly number[]): number => {
  const set = new Set(held)
  let n = 0
  while (set.has(n)) n++
  return n
}
