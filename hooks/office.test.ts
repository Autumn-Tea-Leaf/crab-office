import { expect, mock, test } from 'claude-code/testing'

import { dayCss, layoutOf, officeSvg, route, ROOM_NAMES, SVG_LIMIT } from './office'
import type { OfficeCrab } from './office'

const crab = (id: string, costume: string): OfficeCrab => ({ id, name: id, color: '#888', status: 'running', costume, activity: '', progress: null, draw: () => '' })

const PLUGIN = 'savvy-progress'
const PROGRESS = 'mcp__savvy-progress__progress'
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

test('desktop: the view button switches the panel to the office and back', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  mock.clock(on, { now: Date.parse('2026-11-02T10:00:00Z') })
  await $.tool.call({ tool: PROGRESS, title: 'Ship it', phase: 'delegate', tasks: [{ title: 'Write the parser', tier: 'careful' }, { title: 'Council: The Contrarian', tier: 'heavy' }] } as never)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  expect((await ui.find({ key: 'view' }))?.props.label).toBe('▦ Office')

  await ui.press({ key: 'view' })
  expect((await ui.find({ key: 'view' }))?.props.label).toBe('☰ Agents')
  // The planned task waits in reception, under its title.
  const office = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
  expect(office).toContain('Lobby')
  expect(office).toContain('Council Chamber')
  expect(office).toContain('1. Wr')
  expect(await ui.find({ text: /0 working · 0 on break · 2 waiting/ })).toBeDefined()

  await ui.press({ key: 'view' })
  expect((await ui.find({ key: 'view' }))?.props.label).toBe('▦ Office')
  expect(await ui.find({ text: /Planned · 2/ })).toBeDefined()
})

test('vscode: the crab rows and the office are drawn there too', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  mock.clock(on, { now: Date.parse('2026-11-04T10:00:00Z') })
  await $.tool.call({ tool: PROGRESS, title: 'Ship it', phase: 'delegate', tasks: [{ title: 'Write the parser', tier: 'careful' }] } as never)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'vscode', component: 'Pane', requestId: 'savvy-agents', props: pane })
  const alts = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.alt))
  expect(alts).toContain('Claude · Lead: Waiting for you')

  await ui.press({ key: 'view' })
  expect((await ui.find({ key: 'view' }))?.props.label).toBe('☰ Agents')
  const office = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
  expect(office).toContain('Lobby')
  expect(office).toContain('>Claude<')
})

test('terminal: no office button where there is no drawing', async $ => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane })
  expect(await ui.find({ key: 'view' })).toBeUndefined()
})

test('the lead, the main session, is on the list and at the front desk, working through a turn and waiting between', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-11-03T10:00:00Z') })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('turn.start', () => ({ turnId: 'turn' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok' }) as never)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  const alt = async () => (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.alt)).find(a => a.startsWith('Claude ·'))
  expect(await alt()).toBe('Claude · Lead: Waiting for you')

  await ($.turn.start as (e: unknown) => Promise<unknown>)({ text: 'hi', turnId: 'turn' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/app.json' } as never)
  expect(await alt()).toBe('Claude · Lead: Reading app.json')

  await ui.press({ key: 'view' })
  const office = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
  expect(office).toContain('>Claude<')
  expect(office).toContain('Reading app.json')

  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', usage: null })
  await ui.press({ key: 'view' })
  expect(await alt()).toBe('Claude · Lead: Waiting for you')
})

test('the lead takes the name set in leadName', { options: { leadName: 'Sunny' } }, async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  const alts = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.alt))
  expect(alts).toContain('Sunny · Lead: Waiting for you')
})

test('the lead joins no department: alone, the office is the ground floor', async () => {
  const lead = { ...crab('lead', 'other'), isLead: true }
  expect(layoutOf([lead]).rooms.map(r => r.kind)).toEqual(['lobby', 'cafe', 'lounge'])
  expect(layoutOf([lead, crab('a', 'hacker')]).rooms.some(r => r.kind === 'general')).toBe(false)
})

test('the light follows the local clock: clear at noon, lamps lit at night, the loop started at the hour', async () => {
  // Local times: the day loop runs from local midnight, whatever the time zone.
  const noon = dayCss(new Date(2026, 10, 3, 12, 0, 0).getTime())
  expect(noon).toContain('.o-out{opacity:0;animation:o-out 86400s linear infinite -43200s}')
  expect(noon).toContain('.o-sky{fill:#A9D6F5;')
  const late = dayCss(new Date(2026, 10, 3, 22, 30, 0).getTime())
  expect(late).toContain('.o-out{opacity:0.48;')
  expect(late).toContain('.o-lamp{opacity:0.85;animation:o-lamp 86400s linear infinite -81000s}')
  // Every Svg of the scene carries it, so the windows' sky changes with the overlay.
  for (const source of officeSvg({ W: 400, crabs: [], labels: ROOM_NAMES, now: 0, crabCss: '', working: '' })) expect(source).toContain('@keyframes o-sky')
})

test('a route between rooms goes through both doors and the hallway, never diagonally', async () => {
  // A desk upstairs in the third room, the lounge sofa on the ground floor.
  const { rooms, rows } = layoutOf([crab('a', 'hacker'), crab('b', 'explorer'), crab('c', 'devil')])
  const lab = rooms.find(r => r.kind === 'engineering')
  const lounge = rooms.find(r => r.kind === 'lounge')
  if (!lab || !lounge) throw new Error('rooms missing')
  expect(rows).toBe(2)
  const desk = { x: lab.x + 22, y: lab.top + 20, icon: 'dots', room: lab, via: [{ x: lab.x + 45, y: lab.top + 20 }] } as const
  const couch = { x: lounge.x + 14, y: lounge.top + 66, icon: 'zzz', room: lounge } as const
  const path = route(desk, couch, rows)
  expect(path[0]).toEqual({ x: desk.x, y: desk.y })
  expect(path[path.length - 1]).toEqual({ x: couch.x, y: couch.y })
  // Down the corridor on the left between the floors.
  expect(path.some(p => p.x === 28)).toBe(true)
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    expect(a?.x === b?.x || a?.y === b?.y).toBe(true)
  }
})

test('a full house still fits: every Svg of the scene is under the engine cap', async () => {
  const costumes = ['explorer', 'artist', 'writer', 'hacker', 'scientist', 'devil', 'shopkeeper', 'wizard']
  // A crab body of about the real sprite's size, so the packing is tested at scale.
  const sprite = '<rect x="1" y="2" width="3" height="4" fill="#D97757"/>'.repeat(160)
  const crabs: OfficeCrab[] = Array.from({ length: 60 }, (_, i) => ({
    ...crab(`c${i}`, costumes[i % costumes.length] as string),
    status: i < 32 ? 'running' : i < 50 ? 'done' : i < 55 ? 'failed' : 'planned',
    activity: `Editing file-${i}.ts`,
    draw: () => sprite,
  }))
  const sources = officeSvg({ W: 560, crabs, labels: ROOM_NAMES, now: 0, crabCss: '<style>.run{}</style>', working: 'Working' })
  expect(sources.length).toBeGreaterThan(1)
  for (const source of sources) expect(source.length).toBeLessThan(SVG_LIMIT)
})
