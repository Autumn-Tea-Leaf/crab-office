import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { accentOf, isClose } from './colors'
import { ALL_COSTUMES, SEED, assign, baseCostume, findGroup, looksAlike, members, normaliseRole, parseRoster, seedRoster, serializeRoster } from './roster'
import type { Crab, Roster } from './roster'

const PLUGIN = 'savvy-progress'
const FILE = 'C:/Users/t/.claude/crab-office/roster/crabs.json'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

// Every name differs and no two crabs look alike, across every role and slot.
const expectUnique = (r: Roster) => {
  const all = members(r)
  expect(new Set(all.map(c => c.name.toLowerCase())).size).toBe(all.length)
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const [a, b] = [all[i] as Crab, all[j] as Crab]
      if (looksAlike(a, b)) throw new Error(`${a.name} (${a.role}) looks like ${b.name} (${b.role})`)
    }
}

// --- roles

const ROLES: readonly (readonly [description: string, type: string, role: string])[] = [
  ['Council: The Contrarian', 'general-purpose', 'Contrarian'],
  ['contrarian take on pricing', 'general-purpose', 'Contrarian'],
  ['Council peer review 3', 'general-purpose', 'Peer reviewer'],
  ['Council: Chairman verdict', 'general-purpose', 'Chairman'],
  ['Designer: critique Fold', 'general-purpose', 'Designer'],
  ['Motion designer: hero loop', 'general-purpose', 'Motion designer'],
  ['Researcher: typography', 'general-purpose', 'Researcher: typography'],
  ['Research award-winning websites', 'general-purpose', 'Researcher'],
  ['Mod: role costumes and names', 'general-purpose', 'Costume designer'],
  ['Mod: crab roster siblings', 'general-purpose', 'Costume designer'],
  ['Tailor the sprite outfits', 'general-purpose', 'Costume designer'],
  ['Mod: fix the band layout', 'general-purpose', 'Mod engineer'],
  ['Humanizer pass on the README', 'general-purpose', 'Humanizer'],
  ['Write copy for the hero', 'general-purpose', 'Writer'],
  ['Ops: rotate keys', 'general-purpose', 'Ops'],
  ['Tidy the notes', 'general-purpose', 'Generalist'],
  ['Tidy the notes', 'savvy-heavy', 'Savvy heavy'],
  ['', 'Explore', 'Explorer'],
]

for (const [description, type, role] of ROLES) {
  test(`role: "${description}" (${type}) is ${role}`, () => {
    expect(normaliseRole(description, type)).toBe(role)
  })
}

test('role: the costume designer is a tailor', () => {
  expect(baseCostume('Costume designer', 'Mod: role costumes and names')).toBe('tailor')
})

// --- the roster, pure

test('roster: the seed is unique, and designers come with three siblings', () => {
  expectUnique(seedRoster())
  expect(new Set(SEED.map(g => g.role.toLowerCase())).size).toBe(SEED.length)
  expect(findGroup(seedRoster(), 'Designer')?.crabs.map(c => c.name)).toEqual(['Coco', 'Mabel', 'Ruby', 'Taro'])
  expect(findGroup(seedRoster(), 'Costume designer')?.crabs[0]).toMatchObject({ name: 'Bobbin', costume: 'tailor' })
})

test('roster: a round trip through the file text keeps every crab', () => {
  let r = assign(seedRoster(), 'Ops', 'ninja').roster
  r = assign(r, 'Ops', 'ninja', 3).roster
  expect(parseRoster(serializeRoster(r))).toEqual(r)
})

test('roster: a role always gets the same crab, slot by slot', () => {
  const first = assign(seedRoster(), 'Ops', 'ninja', 2)
  const again = assign(first.roster, 'ops', 'pirate', 2)
  expect(again.isNew).toBe(false)
  expect(again.crab).toEqual(first.crab)
  expect(again.roster).toBe(first.roster)
  expect(assign(first.roster, 'Ops', 'ninja', 1).crab.name).toBe(findGroup(first.roster, 'Ops')?.crabs[1]?.name)
  expect(assign(seedRoster(), normaliseRole('Council: The Contrarian'), 'devil').crab.name).toBe('Pepper')
  expect(assign(seedRoster(), 'Designer', 'artist', 2).crab.name).toBe('Ruby')
})

test('roster: a new role gets a crab whose name and look nobody has', () => {
  const r = seedRoster()
  const { crab, isNew, roster } = assign(r, 'Mod engineer: telemetry', 'hacker')
  expect(isNew).toBe(true)
  expect(members(roster)).toHaveLength(members(r).length + 1)
  expect(members(r).map(c => c.name)).not.toContain(crab.name)
  expect(crab.costume).toBe('hacker')
  expectUnique(roster)
})

test('siblings: eight designers at once, each its own name, a distinct hue and a distinct prop', () => {
  const r = assign(seedRoster(), 'Designer', 'artist', 7).roster
  const crabs = findGroup(r, 'Designer')?.crabs ?? []
  expect(crabs).toHaveLength(8)
  expect(crabs.every(c => c.costume === 'artist')).toBe(true)
  expect(new Set(crabs.map(c => c.prop)).size).toBe(8)
  const hues = crabs.map(c => accentOf(c.costume, c.variant))
  for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) expect(isClose(hues[i] ?? '', hues[j] ?? '')).toBe(false)
  expectUnique(r)
})

test('siblings: 300 roles with up to 8 crabs each, every name and every look unique', () => {
  let r = seedRoster()
  for (let i = 0; i < 300; i++) {
    const role = i % 3 ? `Researcher: topic${i}` : `Role number ${i}`
    r = assign(r, role, baseCostume(role), i % 8).roster
  }
  expect(r.roles.length).toBe(SEED.length + 300)
  for (const c of members(r)) expect(ALL_COSTUMES).toContain(c.costume)
  expectUnique(r)
})

test('roster: a version 1 file moves over to role groups', () => {
  const v1 = JSON.stringify({
    version: 1,
    crabs: [
      { role: 'Designer', name: 'Coco', costume: 'artist', variant: 0 },
      { role: 'Ops', name: 'Zest', costume: 'ninja', variant: 3 },
    ],
  })
  const r = parseRoster(v1)
  expect(r?.version).toBe(2)
  expect(findGroup(r as Roster, 'Designer')?.crabs.map(c => c.name)).toEqual(['Coco', 'Mabel', 'Ruby', 'Taro'])
  expect(findGroup(r as Roster, 'Ops')?.crabs).toEqual([{ name: 'Zest', costume: 'ninja', variant: 3, prop: 0 }])
  expectUnique(r as Roster)
})

test('roster: a hand-edited file with twins keeps the first of each', () => {
  const text = JSON.stringify({
    version: 2,
    roles: [
      { role: 'Ops', crabs: [{ name: 'Zest', costume: 'ninja', variant: 3, prop: 0 }, { name: 'Zest', costume: 'ninja', variant: 4, prop: 1 }] },
      { role: 'Ops 3', crabs: [{ name: 'Yam', costume: 'ninja', variant: 3, prop: 0 }] },
      { role: 'Bad', crabs: [{ name: 'Nope', costume: 'not-a-costume', variant: 0, prop: 0 }] },
    ],
  })
  const r = parseRoster(text) as Roster
  expect(findGroup(r, 'Ops')?.crabs.map(c => c.name)).toEqual(['Zest'])
  expect(findGroup(r, 'Ops 3')).toBeUndefined()
  expect(findGroup(r, 'Bad')).toBeUndefined()
  expect(findGroup(r, 'Contrarian')).toBeDefined()
  expect(parseRoster('not json')).toBeNull()
  expectUnique(r)
})

// --- through the plugin, with the roster file in memory

const disk = (on: On, files: Map<string, string>) => {
  mock.env(on, { USERPROFILE: 'C:/Users/t', LANG: 'en_US.UTF-8' })
  // The engine hands paths over in the platform's spelling: compare with forward slashes.
  const key = (p: string) => p.split(String.fromCharCode(92)).join('/')
  on('fs.read', (_$, e) => {
    const text = files.get(key(e.path))
    // A missing file answers as the engine does: the read rejects.
    if (text === undefined) return Promise.reject(new Error(`ENOENT: ${e.path}`)) as never
    return { value: text } as never
  })
  on('fs.write', (_$, e) => {
    files.set(key(e.path), e.text)
    return { value: undefined } as never
  })
}

const spawner = (on: On) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `agent-${++n}` }))
  on('turn.complete', () => ({ text: '' }) as never)
  let t = 0
  return async ($: Engine, description: string) =>
    $.agent.spawn({ tool_use_id: `t${++t}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'x', background: true, fork: false } as never)
}

const finish = ($: Engine, agentId: string) =>
  ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId, reason: 'answer', answer: 'ok', usage: null })

const rows = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  const out = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).filter(s => s.includes('class="c-'))
  await ui.unmount()
  return out
}

// The name line of each row, and the crab drawing of each (without the text).
const nameOf = (svg: string) => /font-weight="600">([^<]*) · /.exec(svg)?.[1] ?? ''
const drawingOf = (svg: string) => svg.slice(svg.indexOf('<g transform'), svg.indexOf('<text'))

test('persistence: a new role is written to the roster file, an old one read from it', async ($, on) => {
  const files = new Map<string, string>([[FILE, serializeRoster({ version: 2, roles: [{ role: 'Ops', crabs: [{ name: 'Zest', costume: 'ninja', variant: 3, prop: 0 }] }] })]])
  disk(on, files)
  const spawn = spawner(on)

  await spawn($, 'Ops: rotate keys')
  const drawn = (await rows($)).join('')
  expect(drawn).toContain('>Zest · Ops<')
  expect(drawn).toContain('class="c-ninja')

  await spawn($, 'Billing: reconcile invoices')
  const saved = parseRoster(files.get(FILE) ?? '') as Roster
  const billing = findGroup(saved, 'Billing')?.crabs[0]
  expect(billing).toBeDefined()
  expect(findGroup(saved, 'Ops')?.crabs).toEqual([{ name: 'Zest', costume: 'ninja', variant: 3, prop: 0 }])
  expect((await rows($)).join('')).toContain(`>${billing?.name} · Billing<`)
  expectUnique(saved)
})

test('persistence: an unreadable roster file is backed up before it is replaced', async ($, on) => {
  const files = new Map<string, string>([[FILE, '{ broken']])
  disk(on, files)
  const spawn = spawner(on)
  await spawn($, 'Council: The Contrarian')
  const backups = [...files.keys()].filter(k => k.startsWith(`${FILE}.bak-`))
  expect(backups).toHaveLength(1)
  expect(files.get(backups[0] ?? '')).toBe('{ broken')
  expect(findGroup(parseRoster(files.get(FILE) ?? '') as Roster, 'Contrarian')?.crabs[0]?.name).toBe('Pepper')
})

test('persistence: a version 1 roster file is backed up, then moved over', async ($, on) => {
  const v1 = JSON.stringify({ version: 1, crabs: [{ role: 'Designer', name: 'Coco', costume: 'artist', variant: 0 }] })
  const files = new Map<string, string>([[FILE, v1]])
  disk(on, files)
  await spawner(on)($, 'Designer: critique Fold')
  const backups = [...files.keys()].filter(k => k.startsWith(`${FILE}.bak-`))
  expect(backups.map(b => files.get(b))).toEqual([v1])
  expect(parseRoster(files.get(FILE) ?? '')?.version).toBe(2)
})

test('siblings: four designers at once are four crabs, none alike, the same four every time', async ($, on) => {
  const files = new Map<string, string>()
  disk(on, files)
  const spawn = spawner(on)
  for (let i = 1; i <= 4; i++) await spawn($, `Designer: critique screen ${i}`)
  const drawn = (await rows($)).filter(s => s.includes('class="c-artist'))
  expect(drawn).toHaveLength(4)
  // The panel lists the newest first.
  expect(drawn.map(nameOf).reverse()).toEqual(['Coco', 'Mabel', 'Ruby', 'Taro'])
  expect(new Set(drawn.map(drawingOf)).size).toBe(4)
  expect(drawn.join('')).not.toMatch(/ II |class="badge"/)

  // All four finish; the next two take the first two slots again: Coco, then Mabel.
  for (let i = 1; i <= 4; i++) await finish($, `agent-${i}`)
  await spawn($, 'Designer: polish the deck')
  await spawn($, 'Designer: polish the site')
  const running = (await rows($)).filter(s => s.includes('class="c-artist run'))
  expect(running.map(nameOf).reverse()).toEqual(['Coco', 'Mabel'])
})

test('siblings: a fifth designer creates a new crab, saved for next time', async ($, on) => {
  const files = new Map<string, string>()
  disk(on, files)
  const spawn = spawner(on)
  for (let i = 1; i <= 5; i++) await spawn($, `Designer: screen ${i}`)
  const group = findGroup(parseRoster(files.get(FILE) ?? '') as Roster, 'Designer')
  expect(group?.crabs).toHaveLength(5)
  const fifth = group?.crabs[4]
  expect(['Coco', 'Mabel', 'Ruby', 'Taro']).not.toContain(fifth?.name)
  expect((await rows($)).join('')).toContain(`>${fifth?.name} · Designer<`)
})
