import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } as never } as const

function engine(on: On) {
  mock.clock(on, { now: Date.parse('2026-11-10T12:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('settings.read', async () => ({ value: {} }) as never)
  // The engine's own placeholder, for a band this mod leaves to the rest.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e as never) as any
    return (<Text key="below">below</Text>) as never
  })
}

async function band($: Engine, surface: 'terminal' | 'desktop') {
  return $.ui.mount({ plugin: 'savvy-progress', surface, ...BAND })
}

test('terminal: with no flow reporting, the bar shows Crab Office and Ready', async ($, on) => {
  engine(on)
  const ui = await band($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /^Crab Office$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Ready$/ })).toBeDefined()
  expect((await ui.find({ key: 'savvy-agents' }))?.props.label).toBe('×0')
})

test('desktop: with no flow reporting, the bar is one Svg saying Crab Office: Ready', async ($, on) => {
  engine(on)
  const ui = await band($, 'desktop')
  const svg = await ui.findAll({ type: 'Svg' })
  expect(svg.length).toBe(1)
  expect(String(svg[0]?.props.alt)).toBe('Crab Office: Ready, 0%')
})

test('the idle bar counts the agents of the session', async ($, on) => {
  engine(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }))
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Read the docs', subagentType: 'general-purpose', provider: 'engine', parentModel: 'claude-opus-5-5', background: true, fork: false } as never)
  const ui = await band($, 'terminal')
  // One agent started and still running: none of one done.
  expect(await ui.find({ type: 'Text', text: /^Agents 0\/1$/ })).toBeDefined()
  expect((await ui.find({ key: 'savvy-agents' }))?.props.label).toBe('×1')
})

test('a reported flow takes the bar over', async ($, on) => {
  engine(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.tool.call({ tool: 'mcp__savvy-progress__progress', title: 'Ship it', total: 4, done: 1, phase: 'delegate' } as never)
  const ui = await band($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /^Ship it$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Crab Office$/ })).toBeUndefined()
})

test('the ✕ hides the idle bar for the chat', async ($, on) => {
  engine(on)
  const ui = await band($, 'terminal')
  await ui.press({ key: 'savvy-dismiss' })
  expect(await ui.find({ type: 'Text', text: /^Crab Office$/ })).toBeUndefined()
})

test('barAtStart no: no bar until a flow reports', { options: { barAtStart: 'no' } }, async ($, on) => {
  engine(on)
  const ui = await band($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /^Crab Office$/ })).toBeUndefined()
})
