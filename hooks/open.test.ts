import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = 'savvy-agents'

// The engine's side for these tests: panes it opens and closes, and prompts that reach the bottom.
function engine(on: On) {
  const opened: string[] = []
  const titles: string[] = []
  const open = new Set<string>()
  const reached: string[] = []
  mock.clock(on, { now: Date.parse('2026-11-04T12:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.start', async (_$, e) => ({ cwd: e.cwd }) as never)
  on('tool.register', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    titles.push(String(e.title))
    open.add(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    open.delete(e.id)
    return { value: undefined } as never
  })
  on('ui.panes', () => ({ value: [...open].map(id => ({ id, isPlaced: true })) }) as never)
  on('prompt.submit', async (_$, e) => {
    reached.push(e.text)
    return { text: e.text }
  })
  return { opened, titles, reached }
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: false } as never)

test('a new chat opens the Crab Office once, and a reload does not open it again', async ($, on) => {
  const seen = engine(on)
  await start($)
  expect(seen.opened).toEqual([PANE])
  expect(seen.titles).toEqual(['Crab Office'])
  // A reload of the mod runs session.start again in the same chat.
  await start($)
  expect(seen.opened).toEqual([PANE])
})

test('openAtStart no: a new chat leaves the Crab Office shut', { options: { openAtStart: 'no' } }, async ($, on) => {
  const seen = engine(on)
  await start($)
  expect(seen.opened).toEqual([])
})

test('"open crab office" at the prompt opens the pane and never reaches the model', async ($, on) => {
  const seen = engine(on)
  for (const text of ['open crab office', 'Claude, open the crab office please', 'Show my Crab-Office!']) {
    const out = await $.prompt.submit({ text, wait: false } as never)
    expect(out).toEqual({ drop: 'Crab Office opened.' })
  }
  expect(seen.opened).toEqual([PANE, PANE, PANE])
  expect(seen.reached).toEqual([])
})

test('other prompts about the crab office go through untouched', async ($, on) => {
  const seen = engine(on)
  for (const text of ['what is the crab office', 'open crab office and add a plant', 'open the office']) {
    const out = await $.prompt.submit({ text, wait: false } as never)
    expect(out).toMatchObject({ text })
  }
  expect(seen.opened).toEqual([])
  expect(seen.reached).toEqual(['what is the crab office', 'open crab office and add a plant', 'open the office'])
})

test('/crab-office toggles the pane, and /crab-office open only opens it', async ($, on) => {
  const seen = engine(on)
  expect(await $.command.run({ command: 'crab-office', args: '' } as never)).toMatchObject({ text: 'Crab Office opened.' })
  expect(await $.command.run({ command: 'crab-office', args: '' } as never)).toMatchObject({ text: 'Crab Office closed.' })
  expect(await $.command.run({ command: 'crab-office', args: 'open' } as never)).toMatchObject({ text: 'Crab Office opened.' })
  expect(await $.command.run({ command: 'crab-office', args: 'open' } as never)).toMatchObject({ text: 'Crab Office opened.' })
  expect(seen.opened).toEqual([PANE, PANE, PANE])
})
