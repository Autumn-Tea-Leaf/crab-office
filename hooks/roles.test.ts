import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NAMES, POOL, pickLook, pickName, plannedCostume, roleOf, typeCostume } from './roles'

const PLUGIN = 'savvy-progress'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

// The descriptions this session's agents were actually spawned with.
const ROLES: readonly (readonly [description: string, costume: string | null, label?: string])[] = [
  ['Council: The Contrarian', 'devil', 'Contrarian'],
  ['Council: First Principles', 'professor', 'First Principles'],
  ['Council: The Expansionist', 'rocket', 'Expansionist'],
  ['Council: The Outsider', 'traveller', 'Outsider'],
  ['Council: The Executor', 'stopwatch', 'Executor'],
  ['Council peer review 3', 'judge', 'Peer review'],
  ['Council: Chairman verdict', 'crown', 'Chairman'],
  ['Designer: critique Fold', 'artist', 'Designer'],
  ['Polish the landing page', 'artist', 'Designer'],
  ['Research award-winning websites', 'explorer', 'Researcher'],
  ['Build Tallyhop SaaS demo', 'builder', 'Builder'],
  ['Mod: role costumes and names', 'tailor', 'Costume designer'],
  ['Mod: fix the band layout', 'hacker', 'Coder'],
  ['Fix the plugin loader', 'hacker', 'Coder'],
  ['Humanizer pass on the README', 'writer', 'Writer'],
  ['Write copy for the hero', 'writer', 'Writer'],
  ['CONTRARIAN, IN CAPS', 'devil', 'Contrarian'],
  ['Find the config file', 'explorer', 'Researcher'],
  ['Search the docs for hooks', 'explorer', 'Researcher'],
  ['Motion designer: hero loop', 'director', 'Motion designer'],
  ['Animation pass on the logo', 'director', 'Motion designer'],
  ['Council: opening statements', 'toga', 'Council'],
  ['Verify the build', 'scientist', 'QA'],
  ['QA the checkout', 'scientist', 'QA'],
  ['Run the tests', 'scientist', 'QA'],
  ['Generate hero images with Gemini', 'photographer', 'Photographer'],
  ['Photo retouch', 'photographer', 'Photographer'],
  ['Fiverr seller outreach', 'shopkeeper', 'Seller'],
  ['Sales follow-ups', 'shopkeeper', 'Seller'],
  ['Tidy the notes', null],
  ['', null],
]

for (const [description, costume, label] of ROLES) {
  test(`role: "${description}" wears ${costume ?? 'its tier costume'}`, () => {
    const role = roleOf(description)
    expect(role?.costume ?? null).toBe(costume)
    if (label) expect(role?.label).toBe(label)
  })
}

test('names: about 60 short, distinct names', () => {
  expect(NAMES.length).toBeGreaterThanOrEqual(55)
  expect(new Set(NAMES).size).toBe(NAMES.length)
  for (const n of NAMES) expect(n.length).toBeLessThanOrEqual(8)
})

test('names: the same id always gets the same name', () => {
  expect(pickName('agent-abc')).toBe(pickName('agent-abc'))
  expect(NAMES).toContain(pickName('agent-abc'))
})

test('names: never a name a running agent already has', () => {
  const taken: string[] = []
  for (let i = 0; i < NAMES.length; i++) taken.push(pickName(`a${i}`, taken))
  expect(new Set(taken).size).toBe(NAMES.length)
  // Past 60 running at once the repeat is numbered, still unique.
  const extra = pickName('one-more', taken)
  expect(taken).not.toContain(extra)
})

test('names: a name shown earlier is skipped while others remain, reused only when all are gone', () => {
  const first = pickName('x1')
  expect(pickName('x1', [], [first])).not.toBe(first)
  // Every name was shown, none is running: the hashed one comes back.
  expect(pickName('x1', [], NAMES)).toBe(first)
})

// The panel: three agents spawned with council and design descriptions.
const spawnAll = async ($: Engine, on: On, descriptions: string[]) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `agent-${++n}` }))
  for (const [i, description] of descriptions.entries()) {
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description, subagentType: 'general-purpose', provider: 'engine', parentModel: 'claude-opus-5-5', background: true, fork: false } as never)
  }
}

const DESCRIPTIONS = ['Council: The Contrarian', 'Designer: critique Fold', 'Tidy the notes']

test('desktop: each row wears its role costume and shows "Name · Role"', async ($, on) => {
  await spawnAll($, on, DESCRIPTIONS)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  // The lead's row aside: the plain crab is the lead's alone.
  const drawn = (await ui.findAll({ type: 'Svg' })).filter(el => !String(el.props.alt).startsWith('Claude ·')).map(el => String(el.props.source)).join('')
  expect(drawn).toContain('c-devil run')
  expect(drawn).toContain('c-artist run')
  // No role and a type that says nothing: a pool costume, never the plain crab.
  expect(drawn).not.toContain('c-other')
  expect(POOL.some(c => drawn.includes(`c-${c} run`))).toBe(true)
  expect(drawn).toMatch(/>[A-Z][a-z]+ · Contrarian</)
  expect(drawn).toMatch(/>[A-Z][a-z]+ · Designer</)
  // No role keyword and a general-purpose type: the Generalist crab.
  expect(drawn).toMatch(/>[A-Z][a-z]+ · Generalist</)
  // Reduced motion still stops every costume.
  expect(drawn).toContain('prefers-reduced-motion: reduce')
})

test('terminal: running agents never share a name, and names stay put across redraws', async ($, on) => {
  await spawnAll($, on, ['Council: The Contrarian', 'Council: First Principles', 'Council: The Expansionist', 'Council: The Outsider', 'Council: The Executor'])
  const names = async () => {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane })
    const rows = await ui.findAll({ type: 'Text', text: /^[A-Z][a-z]+ · [A-Z]/ })
    await ui.unmount()
    return rows.map(r => r.text)
  }
  const first = await names()
  expect(first).toHaveLength(5)
  expect(new Set(first.map(t => t.split(' · ')[0])).size).toBe(5)
  expect(first.some(t => t.endsWith(' · Outsider'))).toBe(true)
  expect(await names()).toEqual(first)
})

test('types: Explore explores, a fork builds, savvy tiers keep theirs, general-purpose says nothing', () => {
  expect(typeCostume('Explore')).toBe('explorer')
  expect(typeCostume('fork')).toBe('builder')
  expect(typeCostume('savvy-heavy')).toBe('heavy')
  expect(typeCostume('savvy-flow:savvy-light')).toBe('light')
  expect(typeCostume('searchfit-seo:seo-auditor:AGENT')).toBe('scientist')
  expect(typeCostume('general-purpose')).toBeNull()
  expect(typeCostume('Plan')).toBeNull()
})

test('looks: an agent nothing describes gets a pool costume, the same one for the same id', () => {
  const look = pickLook('agent-7', 'Tidy the notes', 'general-purpose')
  expect(POOL).toContain(look.costume)
  expect(pickLook('agent-7', 'Tidy the notes', 'general-purpose')).toEqual(look)
  expect(POOL.length).toBeGreaterThanOrEqual(12)
})

test('looks: no agent ever falls back to the plain crab', () => {
  const cases: [string, string][] = [['', ''], ['Tidy the notes', 'general-purpose'], ['x', 'Plan'], ['', 'fork'], ['', 'Explore'], ['zzz', 'statusline-setup']]
  for (const [d, t] of cases) expect(pickLook(`id-${d}-${t}`, d, t).costume).not.toBe('other')
  expect(plannedCostume('Tidy the notes', '')).not.toBe('other')
  expect(POOL).toContain(plannedCostume('Tidy the notes', ''))
  expect(plannedCostume('Wire the CLI', 'light')).toBe('light')
})

test('looks: running agents in the pool all wear different costumes until it runs out, then a new accent', () => {
  const worn: { costume: string; variant: number }[] = []
  for (let i = 0; i < POOL.length; i++) worn.push(pickLook(`u${i}`, 'Tidy the notes', 'general-purpose', worn))
  expect(new Set(worn.map(w => w.costume)).size).toBe(POOL.length)
  expect(worn.every(w => w.variant === 0)).toBe(true)
  const extra = pickLook('u-extra', 'Tidy the notes', 'general-purpose', worn)
  expect(extra.variant).toBe(1)
})

test('looks: two running agents in the same role wear different accent variants', () => {
  const first = pickLook('r1', 'Council peer review 1', 'general-purpose')
  const second = pickLook('r2', 'Council peer review 2', 'general-purpose', [first])
  const third = pickLook('r3', 'Council peer review 3', 'general-purpose', [first, second])
  expect([first.costume, second.costume, third.costume]).toEqual(['judge', 'judge', 'judge'])
  expect([first.variant, second.variant, third.variant]).toEqual([0, 1, 2])
  // A finished one frees its variant: only running agents are passed in.
  expect(pickLook('r4', 'Council peer review 4', 'general-purpose', [second]).variant).toBe(0)
})
