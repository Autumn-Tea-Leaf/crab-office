// Autumn's fork: a costume per ROLE, read from the Agent tool's `description`, and a
// friendly name per run. Pure functions, so the tests can call them directly.

export type Role = { costume: string; label: string }

// First match wins: the council's seats sit above the broad words ("review",
// "design", "build") so "Council: The Contrarian" never falls through to them,
// and "motion designer" sits above "designer".
const ROLES: readonly [RegExp, Role][] = [
  [/\bcontrarian\b/, { costume: 'devil', label: 'Contrarian' }],
  [/\bfirst[\s-]*principles?\b/, { costume: 'professor', label: 'First Principles' }],
  [/\bexpansionist\b/, { costume: 'rocket', label: 'Expansionist' }],
  [/\boutsider\b/, { costume: 'traveller', label: 'Outsider' }],
  [/\bexecutor\b/, { costume: 'stopwatch', label: 'Executor' }],
  [/\bpeer[\s-]*review\w*|\breviewers?\b|\bjudge\b/, { costume: 'judge', label: 'Peer review' }],
  [/\bchair(man|woman|person)?\b/, { costume: 'crown', label: 'Chairman' }],
  [/\bcouncil\b/, { costume: 'toga', label: 'Council' }],
  // Before "design" and "mod/code": the agent dressing the crabs is a tailor who codes.
  [/\bcostumes?\b|\boutfits?\b|\btailor\w*|\brosters?\b|\bsprites?\b|\bcrabs?\b/, { costume: 'tailor', label: 'Costume designer' }],
  [/\bmotion\b|\banimat(e|ed|es|ion|ions|or|ors)\b|\bvideos?\b/, { costume: 'director', label: 'Motion designer' }],
  [/\bdesign(er|ers|s|ing)?\b|\bcritique\w*|\bpolish\w*|\bmakeover\b/, { costume: 'artist', label: 'Designer' }],
  [/\bwriter\b|\bwriting\b|\bcopy(writ\w*|edit\w*)?\b|\bhumani[sz]er?\b/, { costume: 'writer', label: 'Writer' }],
  [/\bimages?\b|\bphoto\w*|\bgemini\b|\bpictures?\b|\bscreenshots?\b/, { costume: 'photographer', label: 'Photographer' }],
  [/\bfiverr\b|\bsell(er|ers|ing)?\b|\bsales?\b|\bshop\w*|\bgigs?\b|\bclients?\b|\bpricing\b/, { costume: 'shopkeeper', label: 'Seller' }],
  [/\bverif\w*|\btest(s|er|ers|ing)?\b|\bqa\b|\bvalidat\w*|\baudit\w*/, { costume: 'scientist', label: 'QA' }],
  [/\bresearch(er|ers|ing)?\b|\bexplor\w*|\bsearch\w*|\bfind\b|\blook\s?up\b/, { costume: 'explorer', label: 'Researcher' }],
  [/\bmods?\b|\bplugins?\b|\bcod(e|er|ing)\b/, { costume: 'hacker', label: 'Coder' }],
  [/\bbuild(er|ers|ing|s)?\b/, { costume: 'builder', label: 'Builder' }],
]

/** The role a description names, case-insensitively; null when it names none. */
export const roleOf = (description: string | undefined): Role | null => {
  const d = (description ?? '').toLowerCase()
  if (!d.trim()) return null
  return ROLES.find(([re]) => re.test(d))?.[1] ?? null
}

/** Every role costume, for the drawings and the tests. */
export const ROLE_COSTUMES: readonly string[] = [...new Set(ROLES.map(([, r]) => r.costume))]

const TIERS: readonly string[] = ['fable', 'heavy', 'careful', 'medium', 'light']

/**
 * The costume an agent TYPE stands for: a savvy tier's own, Explore the explorer,
 * a fork the builder, else whatever role the type's name spells (`seo-auditor` is
 * QA, `claude-code-guide` a coder); null for a type that says nothing.
 */
export const typeCostume = (type: string | undefined): string | null => {
  const bare = (type ?? '').replace(/^[^:]*:/, '')
  const tier = bare.replace(/^savvy-/, '').toLowerCase()
  if (bare.startsWith('savvy-') && TIERS.includes(tier)) return tier
  if (/^explore$/i.test(bare)) return 'explorer'
  if (/\bfork\b/i.test(bare)) return 'builder'
  return roleOf((type ?? '').replace(/[-_:]+/g, ' '))?.costume ?? null
}

/** Whimsical costumes for an agent nothing else describes, picked by its id. */
export const POOL: readonly string[] = [
  'pirate', 'wizard', 'spaceman', 'knight', 'ninja', 'cowboy',
  'viking', 'beekeeper', 'magician', 'sailor', 'firefighter', 'party',
]

/** What a run wears: the costume and its accent variant (0 is the costume's own). */
export type Look = { costume: string; variant: number }

export const NAMES: readonly string[] = [
  'Pip', 'Nib', 'Bo', 'Taz', 'Mo', 'Kit', 'Juno', 'Zuzu', 'Pepper', 'Biscuit',
  'Mochi', 'Pickle', 'Noodle', 'Waffle', 'Ziggy', 'Rory', 'Echo', 'Fig', 'Olive', 'Basil',
  'Clover', 'Maple', 'Hazel', 'Pebble', 'Sprout', 'Bean', 'Dot', 'Gus', 'Hugo', 'Iggy',
  'Jojo', 'Kiki', 'Lulu', 'Milo', 'Nova', 'Otto', 'Penny', 'Remy', 'Sunny', 'Tilly',
  'Umi', 'Vee', 'Wren', 'Yuki', 'Zara', 'Coco', 'Daisy', 'Finn', 'Goldie', 'Honey',
  'Indy', 'Jazz', 'Kai', 'Luna', 'Momo', 'Nell', 'Ozzy', 'Poppy', 'Rio', 'Sage',
  'Quill', 'Ash', 'Bix', 'Cleo', 'Dex', 'Ember', 'Flick', 'Gizmo', 'Hops', 'Ivy',
  'Jinx', 'Kip', 'Lark', 'Moss', 'Nimbus', 'Opal', 'Puck', 'Quinn', 'Rusty', 'Scout',
  'Tango', 'Uno', 'Vito', 'Wally', 'Yoyo', 'Zest', 'Arlo', 'Bunny', 'Cricket', 'Dusty',
  'Elf', 'Fizz', 'Gem', 'Hank', 'Inky', 'Jett', 'Koda', 'Lolly', 'Mint', 'Nugget',
  'Skip', 'Tofu', 'Ulla', 'Vesper', 'Wink', 'Yam', 'Zippy', 'Acorn', 'Bramble', 'Chip',
  'Doodle', 'Fennel', 'Gumbo', 'Hiccup', 'Jelly', 'Kazoo', 'Lentil', 'Marbles', 'Pretzel', 'Pudding',
  'Mabel', 'Ruby', 'Taro', 'Bobbin', 'Thimble', 'Basti', 'Cosmo', 'Dimple', 'Fable', 'Gilly',
]

// FNV-1a: the same id always lands on the same slot.
export const hash = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * The look for run `id`: its role's costume, else its type's, else a pool costume
 * hashed from the id that no running agent wears while one is free. `worn` is what
 * the session's running agents wear; the variant is the lowest one none of them
 * wears in the same costume, so two running agents never look identical.
 */
export const pickLook = (id: string, description: string | undefined, type: string | undefined, worn: readonly Look[] = []): Look => {
  let costume = roleOf(description)?.costume ?? typeCostume(type)
  if (!costume) {
    const used = new Set(worn.map(w => w.costume))
    const start = hash(id) % POOL.length
    const at = (i: number) => POOL[(start + i) % POOL.length] as string
    costume = at(0)
    for (let i = 0; i < POOL.length; i++) {
      if (!used.has(at(i))) {
        costume = at(i)
        break
      }
    }
  }
  const taken = new Set(worn.filter(w => w.costume === costume).map(w => w.variant))
  let variant = 0
  while (taken.has(variant)) variant++
  return { costume, variant }
}

/** A planned task's costume: its title's role, its tier's, else a pool costume hashed from the title. */
export const plannedCostume = (title: string, tier: string): string =>
  roleOf(title)?.costume ?? (TIERS.includes(tier) ? tier : (POOL[hash(title) % POOL.length] as string))

/**
 * The name for run `id`: its hashed slot in NAMES, stepping on past any name in
 * `taken` (the session's running agents' names, which must never repeat; then,
 * while names remain, every name already shown this session).
 */
export const pickName = (id: string, taken: Iterable<string> = [], avoid: Iterable<string> = []): string => {
  const hard = new Set(taken)
  const soft = new Set([...avoid, ...hard])
  const start = hash(id) % NAMES.length
  const at = (i: number) => NAMES[(start + i) % NAMES.length] as string
  for (let i = 0; i < NAMES.length; i++) if (!soft.has(at(i))) return at(i)
  for (let i = 0; i < NAMES.length; i++) if (!hard.has(at(i))) return at(i)
  // More than 60 running at once: number the repeat so it is still unique.
  for (let n = 2; ; n++) for (let i = 0; i < NAMES.length; i++) if (!hard.has(`${at(i)} ${n}`)) return `${at(i)} ${n}`
}
