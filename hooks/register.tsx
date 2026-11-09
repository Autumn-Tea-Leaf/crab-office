import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, Flow, Lead, Panel, Phase, PlannedTask, RosterCrab } from '../types'
import { accentOf } from './colors'
import { pickLook, pickName, plannedCostume, roleOf } from './roles'
import { CRAB_S, officeHeight, officeSvg } from './office'
import type { OfficeCrab } from './office'
import { assign, baseCostume, findCrab, freeSlot, members, normaliseRole, parseRoster, roleKey, seedRoster, serializeRoster } from './roster'
import type { Crab, Roster } from './roster'

// What a crab wears: costume, accent variant and prop.
type Look = { costume: string; variant: number; prop: number }

const flow = atom({ plugin: 'savvy-progress', key: 'flow' } as const, null)
const agents = atom({ plugin: 'savvy-progress', key: 'agents' } as const, [])
const panel = atom({ plugin: 'savvy-progress', key: 'panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
  autoOpenedFor: '',
  view: 'list',
  isStartOpened: false,
})
const now = atom({ plugin: 'savvy-progress', key: 'now' } as const, 0)
// The persistent crab roster, mirrored for drawing (planned rows look up their crab here).
const crabs = atom({ plugin: 'savvy-progress', key: 'crabs' } as const, [])
// The lead, the main session: always on the list and at the office's front desk.
const leadAtom = atom({ plugin: 'savvy-progress', key: 'lead' } as const, { isWorking: false, activity: '' })

const TOOL = 'mcp__savvy-progress__progress'
const STEP_TOOL = 'mcp__savvy-progress__step'
// Added to the end of each savvy worker's brief. Their system prompt words step
// reporting as a condition ("if the step tool appears among your tools") and they
// skip it even with the tool listed; the same request in the brief is followed.
const STEP_BRIEF = `

Progress reporting: before any other work, call \`${STEP_TOOL}\` with \`total\` (your plan in 3-8 steps) and \`done: 0\`; call it again with \`done\` and a few-word \`note\` as each step finishes. It only draws a progress bar.`
const PANE = 'savvy-agents'
const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']
const TIERS: readonly string[] = ['fable', 'heavy', 'careful', 'medium', 'light']
// The tools' schemas are advice to the model, not a check: what a call may ask
// the band and the panel to draw is bounded here.
const MAX_TASKS = 200
const MAX_AFTER = 20
const MAX_TITLE = 120
const ACCENT = '#8f8cf4'
const DONE = '#5fbf8f'

type ProgressInput = {
  title?: string
  total?: number
  done?: number
  phase?: Phase
  finished?: boolean
  tasks?: { title?: string; tier?: string; after?: number[] }[]
}

// ---------------------------------------------------------------------------
// Language: the `language` option, else Claude Code's `language` setting, else the
// process locale; English when nothing says Hebrew or Russian.

type Lang = 'en' | 'ru' | 'he'

const STRINGS = {
  en: {
    pane: 'Crab Office',
    ready: 'Ready',
    cost: 'Cost',
    tokens: 'Tokens',
    time: 'Time',
    collapse: 'Collapse',
    expand: 'Expand',
    running: 'Running',
    finished: 'Finished',
    planned: 'Planned',
    empty: 'No subagents yet.',
    round: 'round',
    failed: 'error',
    after: 'after',
    tokensWord: 'tokens',
    agentsCount: 'agents',
    isRunning: 'running',
    isFinished: 'finished',
    isPlanned: 'planned',
    opened: 'Crab Office opened.',
    closed: 'Crab Office closed.',
    done: 'Done',
    plan: 'Plan',
    design: 'Design',
    tasks: 'Tasks',
    review: 'Review',
    busy: 'running',
    ctx: 'ctx',
    tier: { light: 'light', medium: 'medium', careful: 'careful', heavy: 'heavy', fable: 'fable', other: 'other' },
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
    office: 'Office',
    agentsView: 'Agents',
    rooms: {
      research: 'Research Library', studio: 'Design Studio', writing: "Writers' Room", engineering: 'Dev Lab', qa: 'QA Lab',
      council: 'Council Chamber', sales: 'Shop Floor', general: 'Open Space', lobby: 'Lobby', cafe: 'Café', lounge: 'Lounge', gym: 'Gym', greenhouse: 'Greenhouse',
    },
    deskBusy: 'Working…',
    lead: 'Lead',
    leadIdle: 'Waiting for you',
    atWork: 'working',
    onBreak: 'on break',
    waiting: 'waiting',
    verbs: { read: 'Reading', edit: 'Editing', write: 'Writing', search: 'Searching', find: 'Finding', run: 'Running', fetch: 'Fetching', delegate: 'Delegating', use: 'Using' },
  },
  ru: {
    pane: 'Офис крабов',
    ready: 'Готов',
    cost: 'Стоимость',
    tokens: 'Токены',
    time: 'Время',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    running: 'Работают',
    finished: 'Завершены',
    planned: 'Запланированы',
    empty: 'Субагентов пока нет.',
    round: 'раунд',
    failed: 'ошибка',
    after: 'после',
    tokensWord: 'токенов',
    agentsCount: 'агентов',
    isRunning: 'работает',
    isFinished: 'завершён',
    isPlanned: 'запланирована',
    opened: 'Офис крабов открыт.',
    closed: 'Офис крабов закрыт.',
    done: 'Готово',
    plan: 'План',
    design: 'Дизайн',
    tasks: 'Задачи',
    review: 'Ревью',
    busy: 'в работе',
    ctx: 'ctx',
    tier: { light: 'light', medium: 'medium', careful: 'careful', heavy: 'heavy', fable: 'fable', other: 'other' },
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
    office: 'Офис',
    agentsView: 'Агенты',
    rooms: {
      research: 'Библиотека', studio: 'Студия', writing: 'Комната авторов', engineering: 'Лаборатория', qa: 'Отдел QA',
      council: 'Зал совета', sales: 'Магазин', general: 'Опенспейс', lobby: 'Холл', cafe: 'Кафе', lounge: 'Лаунж', gym: 'Спортзал', greenhouse: 'Оранжерея',
    },
    deskBusy: 'Работаю…',
    lead: 'Лидер',
    leadIdle: 'Жду вас',
    atWork: 'работают',
    onBreak: 'на перерыве',
    waiting: 'ждут',
    verbs: { read: 'Читает', edit: 'Правит', write: 'Пишет', search: 'Ищет', find: 'Ищет файлы', run: 'Запускает', fetch: 'Загружает', delegate: 'Поручает', use: 'Использует' },
  },
  he: {
    pane: 'משרד הסרטנים',
    ready: 'מוכן',
    cost: 'עלות',
    tokens: 'טוקנים',
    time: 'זמן',
    collapse: 'כיווץ',
    expand: 'הרחבה',
    running: 'פועלים',
    finished: 'הסתיימו',
    planned: 'מתוכננים',
    empty: 'עדיין אין סוכנים.',
    round: 'סבב',
    failed: 'שגיאה',
    after: 'אחרי',
    tokensWord: 'טוקנים',
    agentsCount: 'סוכנים',
    isRunning: 'פועל',
    isFinished: 'הסתיים',
    isPlanned: 'מתוכנן',
    opened: 'משרד הסרטנים נפתח.',
    closed: 'משרד הסרטנים נסגר.',
    done: 'הושלם',
    plan: 'תכנון',
    design: 'עיצוב',
    tasks: 'משימות',
    review: 'בדיקה',
    busy: 'בעבודה',
    ctx: 'הקשר',
    tier: { light: 'קל', medium: 'בינוני', careful: 'זהיר', heavy: 'כבד', fable: 'פייבל', other: 'אחר' },
    effort: { low: 'נמוך', medium: 'בינוני', high: 'גבוה', xhigh: 'גבוה מאוד', max: 'מקסימלי' },
    office: 'משרד',
    agentsView: 'סוכנים',
    rooms: {
      research: 'ספרייה', studio: 'סטודיו', writing: 'חדר כותבים', engineering: 'מעבדת פיתוח', qa: 'מעבדת QA',
      council: 'חדר המועצה', sales: 'חנות', general: 'חלל פתוח', lobby: 'לובי', cafe: 'קפה', lounge: 'טרקלין', gym: 'חדר כושר', greenhouse: 'חממה',
    },
    deskBusy: 'עובד…',
    lead: 'ראש צוות',
    leadIdle: 'מחכה לך',
    atWork: 'עובדים',
    onBreak: 'בהפסקה',
    waiting: 'ממתינים',
    verbs: { read: 'קורא', edit: 'עורך', write: 'כותב', search: 'מחפש', find: 'מאתר', run: 'מריץ', fetch: 'טוען', delegate: 'מאציל', use: 'משתמש ב' },
  },
} as const

// Module scope is fine here: session.start sets it again on every (re)load.
let lang: Lang = 'en'
const tr = () => STRINGS[lang]

// Hebrew draws every row mirrored: crab and title on the right, numbers on the left.
const isRtl = () => lang === 'he'

// Tier and effort words as shown; anything unknown shows as it came.
const tierWord = (tier: string): string => (tr().tier as Record<string, string>)[tier] ?? tier
const effortWord = (effort: string): string => (tr().effort as Record<string, string>)[effort] ?? effort

const isRussian = (v: unknown): boolean => typeof v === 'string' && /^(ru|russian|рус)/i.test(v.trim())
const isHebrew = (v: unknown): boolean => typeof v === 'string' && /^(he|iw|hebrew|עברית)/i.test(v.trim())
const langOf = (v: unknown): Lang => (isHebrew(v) ? 'he' : isRussian(v) ? 'ru' : 'en')

async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  if (option === 'en' || option === 'ru' || option === 'he') return option
  try {
    const settings = (await $.settings.read()) as Record<string, unknown>
    if (typeof settings.language === 'string' && settings.language.trim()) return langOf(settings.language)
  } catch {
    // No settings: fall through to the locale.
  }
  const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
  return langOf(locale)
}

const blank = (): Flow => ({
  title: 'savvy-flow',
  total: 0,
  done: 0,
  running: 0,
  phase: 'plan',
  isFinished: false,
  tasks: [],
})

const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  !prev || prev.isFinished || (input.title !== undefined && clip(input.title.trim(), MAX_TITLE) !== prev.title)

// Only a known tier is kept: the name is later a key into the tier tables.
const tierName = (v: string): string => {
  const t = v.replace(/^savvy-/, '').trim().toLowerCase()
  return TIERS.includes(t) ? t : ''
}

const cleanTasks = (tasks: ProgressInput['tasks']): PlannedTask[] | undefined =>
  tasks
    ?.filter(t => t.title?.trim())
    .slice(0, MAX_TASKS)
    .map(t => ({
      title: (t.title ?? '').trim(),
      tier: tierName(t.tier ?? ''),
      after: (t.after ?? []).filter(n => Number.isInteger(n) && n > 0).slice(0, MAX_AFTER),
    }))

const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  // A new title means a new flow: never carry counters over from an earlier one.
  const base = isNewFlow(prev, input) || !prev ? blank() : { ...blank(), ...prev }
  const tasks = cleanTasks(input.tasks) ?? base.tasks
  const total = Math.min(MAX_TASKS, Math.max(0, Math.round(input.total ?? (input.tasks ? tasks.length : base.total))))
  const done = Math.min(total || Infinity, Math.max(0, Math.round(input.done ?? base.done)))
  const phase = input.phase && PHASES.includes(input.phase) ? input.phase : base.phase
  return {
    ...base,
    title: clip(input.title?.trim() || base.title, MAX_TITLE),
    total,
    done,
    phase: input.finished ? 'close' : phase,
    isFinished: input.finished === true,
    tasks,
  }
}

const label = (f: Flow): string => {
  const s = tr()
  if (f.isIdle) return f.total ? `${s.agentsView} ${f.done}/${f.total}` : s.ready
  if (f.isFinished) return s.done
  if (f.phase === 'plan') return s.plan
  if (f.phase === 'design') return s.design
  const count = f.total ? `${f.done}/${f.total}` : `${f.running} ${s.busy}`
  return `${f.phase === 'review' ? s.review : s.tasks} ${count}`
}

const ratio = (f: Flow): number => (f.isFinished ? 1 : f.total ? f.done / f.total : 0)

// Deterministic noise so the dither does not shimmer between redraws.
const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// The whole row is one SVG: the desktop wraps sibling elements onto new lines,
// so title, bar, percent and the crab live in one drawing; only the count and
// the dismiss are Buttons beside it.
const H = 22
const BAR_H = 16
const CRAB_W = 26
// The crab's drawing grid is 30 units wide, props included.
const CRAB_BOX = 30
const CELL = 3
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s)

// CJK, fullwidth forms and emoji advance about 1em; at 0.56em a Chinese title was sized at half its width and the bar drew over it.
// 中日韩文字、全角标点和 emoji 约占 1em；按 0.56em 算时中文标题宽度被低估近一半，进度条会压到标题上。
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF01-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u

// Rough advance of system UI text, in em; good enough to size the title's slot.
const charEm = (ch: string): number =>
  WIDE.test(ch) ? 1 : /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.56

const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

// Cuts `s` to fit `maxW` pixels, with an ellipsis when it had to cut.
const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}

const rowSvg = (f: Flow, W: number, isWorking: boolean): string => {
  // The title takes what it needs, up to 40% of the row; the bar takes the rest.
  const title = fitText(f.title, 13, Math.max(60, W * 0.4))
  const BAR_X = Math.round(16 + textWidth(title, 13) + 12)
  const BAR_W = Math.max(60, W - BAR_X - 46 - CRAB_W)
  const color = f.isFinished ? DONE : ACCENT
  const y0 = (H - BAR_H) / 2
  const fillW = Math.round(BAR_W * ratio(f))
  const runW = f.total ? Math.round((BAR_W * Math.min(f.total, f.done + f.running)) / f.total) : 0
  const dots: string[] = []
  // Positions are worked out left to right; right to left mirrors each box
  // inside the bar (`bx`) and across the row (`rx`). Text is never mirrored.
  const rtl = isRtl()
  const bx = (x: number, w: number): number => (rtl ? BAR_W - x - w : x)
  const rx = (x: number, w: number): number => (rtl ? W - x - w : x)

  // Dithered fill: sparse at the start, dense toward the head.
  const cols = Math.floor(fillW / CELL)
  const rows = Math.floor(BAR_H / CELL)
  for (let c = 0; c < cols; c++) {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < rows; r++) {
      if (noise(c, r) < density) dots.push(`<rect class="t${Math.floor(noise(r, c) * 4)}" x="${bx(c * CELL + 1, 2)}" y="${r * CELL + 1}" width="2" height="2"/>`)
    }
  }
  // Handed to workers, not yet accepted: a faint second layer.
  const faint: string[] = []
  for (let c = cols; c < Math.floor(runW / CELL); c++) {
    for (let r = 0; r < rows; r++) {
      if (noise(c + 7, r + 3) < 0.2) faint.push(`<rect class="t${Math.floor(noise(r + 5, c) * 4)}" x="${bx(c * CELL + 1, 1.7)}" y="${r * CELL + 1}" width="1.7" height="1.7"/>`)
    }
  }

  const ticks: string[] = []
  for (let i = 1; i < f.total; i++) {
    const x = Math.round((BAR_W * i) / f.total)
    if (x > fillW + 4) ticks.push(`<rect x="${bx(x, 1.5)}" y="${BAR_H / 2 - 4}" width="1.5" height="8" rx="0.75"/>`)
  }

  const text = label(f)
  const pillW = Math.round(18 + text.length * 6.6)
  const pillX = bx(Math.max(0, Math.min(BAR_W - pillW, fillW - pillW)), pillW)
  const percent = `${Math.round(ratio(f) * 100)}%`
  // `direction="rtl"` puts Hebrew words and numbers in reading order; `start` is then the right edge.
  const titleAt = rtl ? `x="${W - 16}" direction="rtl" text-anchor="start"` : 'x="16"'
  const percentAt = rtl ? `x="${CRAB_W + 6}" y="${H / 2 + 4.5}"` : `x="${W - CRAB_W - 6}" y="${H / 2 + 4.5}" text-anchor="end"`
  const crabW = CRAB_BOX * 0.8

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
.t{fill:#1f1f1f}.m{fill:#8a8a8a}.k{fill:#e4e4e2}.tk{fill:#b4b4b0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.m{fill:#9a9a9a}.k{fill:#2c2c2c}.tk{fill:#5a5a5a}}
/* Pixels twinkle in four out-of-phase groups; a finished bar settles to a slow glow. */
.t0,.t1,.t2,.t3{animation:tw ${f.isFinished ? 3.2 : 2.2}s ease-in-out infinite}
.t1{animation-duration:${f.isFinished ? 3.8 : 2.8}s;animation-delay:-.7s}.t2{animation-duration:${f.isFinished ? 4.4 : 1.9}s;animation-delay:-1.3s}.t3{animation-duration:${f.isFinished ? 3.5 : 3.3}s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${f.isFinished ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style>
<defs><clipPath id="c"><rect x="0" y="0" width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath></defs>
<circle cx="${rtl ? W - 5 : 5}" cy="${H / 2}" r="4" fill="${color}"/>
<text class="t" ${titleAt} y="${H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="500">${xml(title)}</text>
<g transform="translate(${rx(BAR_X, BAR_W)},${y0})">
<rect class="k" width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/>
<g clip-path="url(#c)">
<g fill="${color}">${dots.join('')}</g>
<g fill="${color}" opacity="0.45">${faint.join('')}</g>
<g class="tk">${ticks.join('')}</g>
</g>
<rect x="${pillX}" width="${pillW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
<text x="${pillX + pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle"${rtl ? ' direction="rtl"' : ''} font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">${xml(text)}</text>
</g>
<text class="m" ${percentAt} font-family="${FONT}" font-size="12.5" font-variant-numeric="tabular-nums">${percent}</text>
${CRAB_CSS}${crab(rx(W - CRAB_W + 1, crabW), 0, 'other', false, isWorking, 0.8, rtl)}
</svg>`
}

const barText = (f: Flow, width: number): string => {
  const filled = Math.round(width * ratio(f))
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

// ---------------------------------------------------------------------------
// Agents panel: every subagent of the session, plus the tasks the flow planned.

const TIER_COLOR: Record<string, string> = {
  fable: '#7F77DD',
  heavy: '#D85A30',
  careful: '#BA7517',
  medium: '#378ADD',
  light: '#1D9E75',
  other: '#888780',
}

// What each savvy tier runs on, for planned tasks that have no run yet.
const colorOf = (tier: string): string => TIER_COLOR[tier] ?? '#888780'

const TIER_MODEL: Record<string, [model: string, effort: string]> = {
  fable: ['Fable', 'high'],
  heavy: ['Opus', 'xhigh'],
  careful: ['Opus', 'high'],
  medium: ['Opus', 'medium'],
  light: ['Opus', 'low'],
}

// "Opus · xhigh", with the effort word in the panel's language; '' for an unknown tier.
const tierModel = (tier: string): string => {
  const m = TIER_MODEL[tier]
  return m ? `${m[0]} · ${effortWord(m[1])}` : ''
}

// "Opus 5.5 · low" for a run, or just the model when no effort was seen.
const runModel = (a: AgentRun): string => (a.effort ? `${modelName(a.model)} · ${effortWord(a.effort)}` : modelName(a.model))

// USD per million tokens: input, output, cache read, cache write. The first row that
// matches a model id wins, so a release sits above its family.
// The engine reports tokens, not money, so the panel's cost is an estimate. It reports
// one cache-write count with no split by lifetime; writes are priced at the 1-hour
// rate (2x input), which is what Claude Code writes on a subscription.
type Price = [input: number, output: number, cacheRead: number, cacheWrite: number]

const PRICES: [RegExp, Price][] = [
  [/(fable|mythos)-5-1/, [10, 50, 0.25, 20]],
  [/fable|mythos/, [10, 50, 1, 20]],
  [/opus-5-5/, [4, 20, 0.2, 8]],
  [/opus/, [5, 25, 0.5, 10]],
  [/sonnet-5-5/, [2, 10, 0.1, 4]],
  [/sonnet-5/, [2, 10, 0.2, 4]],
  [/sonnet/, [3, 15, 0.3, 6]],
  [/haiku-5-5/, [0.1, 0.5, 0.01, 0.2]],
  [/haiku/, [1, 5, 0.1, 2]],
]

// Haiku 5.5 is priced by prompt length: a request whose prompt (input, cache reads and
// cache writes together) is over 100,000 tokens pays these prices instead.
const HAIKU_LONG_PROMPT = 100_000
const HAIKU_LONG: Price = [0.5, 2.5, 0.05, 1]

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string, prompt: number): Price => {
  const id = model.toLowerCase()
  if (prompt > HAIKU_LONG_PROMPT && /haiku-5-5/.test(id)) return HAIKU_LONG
  return PRICES.find(([re]) => re.test(id))?.[1] ?? [4, 20, 0.2, 8]
}

// `isRequest` says the usage is one model request, which is what a prompt-length price
// is set by; a turn's sum is priced at the model's ordinary prices.
const costOf = (model: string, u: Usage, isRequest: boolean): number => {
  const prompt = isRequest ? (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0
  const [i, o, r, w] = priceOf(model, prompt)
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

// Haiku 4.5 and the Claude 3 models have a 200K window; the rest, Haiku 5.5 included, 1M.
const windowOf = (model: string): number => (/haiku-4|claude-3/i.test(model) ? 200_000 : 1_000_000)

// `savvy-careful`, or `savvy-flow:savvy-careful` when the agents ship in a plugin.
const tierOf = (type: string): string => {
  const bare = type.replace(/^[^:]*:/, '')
  const t = bare.replace(/^savvy-/, '').toLowerCase()
  return Object.hasOwn(TIER_COLOR, t) && bare.startsWith('savvy-') ? t : 'other'
}

const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

const fmtCost = (usd: number): string => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

type Planned = PlannedTask & { n: number }

const plannedOf = (f: Flow | null, list: AgentRun[]): Planned[] => {
  if (!f || f.isFinished) return []
  const started = new Set(list.map(a => norm(a.description)))
  return (f.tasks ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

const totals = (list: AgentRun[], at: number) => {
  const cost = list.reduce((s, a) => s + a.costUsd, 0)
  const tokens = list.reduce((s, a) => s + a.tokens, 0)
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  return { cost, tokens, time: list.length ? end - start : 0 }
}

// --- desktop drawings: each row is one SVG, as the band above the prompt is.

// The pane's backdrop: a dotted grid as tall as the content laid over it; the
// row SVGs are transparent, so it shows through between their marks.
const GRID_STEP = 16
// A Text or Button row on the desktop is about 20px; the grid errs taller.
const LINE_H = 24
// The engine refuses an Svg taller than 4096px, so a long grid is stacked from
// tiles of at most this height; a multiple of GRID_STEP keeps the dots aligned.
const GRID_TILE = 4096
const gridTiles = (H: number) => Array.from({ length: Math.ceil(H / GRID_TILE) }, (_, i) => Math.min(GRID_TILE, H - i * GRID_TILE))
const gridSvg = (W: number, H: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.d{fill:#d9d8d4}@media (prefers-color-scheme: dark){.d{fill:#3a3a38}}</style>
<defs><pattern id="g" width="${GRID_STEP}" height="${GRID_STEP}" patternUnits="userSpaceOnUse"><circle class="d" cx="${GRID_STEP / 2}" cy="${GRID_STEP / 2}" r="1"/></pattern></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`

const PANE_CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.k{fill:#2c2c2b}.ln{stroke:#333331}.tile{fill:#262625}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`

// Pixel Clawd from DockCrab (Clawdy): a 24×18 crab on a 30×28 grid, one costume per tier.
// The body keeps the brand clay; the tier's color lives in the costume's accent.
const CLAY = '#D97757'
const INK = '#1F1E1D'

// `cls` puts a pixel in a named group: `bd` (the default) is the body and its
// costume, `la`/`lb` the leg pairs, anything else a prop with its own motion.
type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

// `armCls` lets a raised claw travel with the prop it holds.
const crabBody = (f: Fill, armFront = 0, armCls?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

// Pure CSS, run by the compositor: no redraws. Periods divide one second, so the
// once-a-second redraw of a running row restarts them in phase. Every crab walks;
// each costume adds its prop's own motion on top.
const CRAB_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.c-fable.run{animation:float 1s ease-in-out infinite}
.c-fable.run .la,.c-fable.run .lb,.c-fable.run .bd{animation:none}
.c-fable.run .ant{animation:blink 1s steps(1) infinite}
.c-fable.run .star{animation:blink .5s steps(1) infinite -.25s}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.15}}
.c-heavy.run .it{animation:scan 1s steps(1) infinite}
.c-heavy.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}
.c-careful.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
@keyframes twist{50%{transform:rotate(-35deg)}}
.c-medium.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}
.c-medium.run .egg{animation:flip 1s ease-in-out infinite}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}
.c-light.run .la{animation-duration:.25s}.c-light.run .lb{animation-duration:.25s;animation-delay:-.125s}
.c-light.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}
@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-pirate.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}
@keyframes fence{50%{transform:rotate(25deg)}}
@keyframes swing{50%{transform:rotate(10deg)}}@keyframes poke{50%{transform:translateY(-2px)}}
@keyframes tick{25%{transform:translateX(1px)}75%{transform:translateX(-1px)}}
@keyframes bang{50%{transform:rotate(-22deg)}}@keyframes flame{50%{transform:scaleY(.5)}}
.c-devil.run .it{animation:poke .5s steps(1) infinite}
.c-devil.run .tl{transform-origin:100% 50%;animation:swing .5s ease-in-out infinite}
.c-professor.run .it{animation:tick .5s steps(1) infinite}
.c-professor.run .ds{animation:blink .5s steps(1) infinite -.25s}
.c-professor.run .ts{transform-origin:50% 0;animation:swing 1s ease-in-out infinite}
.c-rocket.run{animation:float .5s ease-in-out infinite}
.c-rocket.run .la,.c-rocket.run .lb,.c-rocket.run .bd{animation:none}
.c-rocket.run .fl{transform-origin:50% 0;animation:flame .25s steps(1) infinite}
.c-traveller.run .bag{transform-origin:50% 0;animation:swing .5s ease-in-out infinite}
.c-stopwatch.run .it{animation:tick 1s steps(1) infinite}
.c-stopwatch.run .hd{animation:blink .5s steps(1) infinite}
.c-judge.run .it{transform-origin:50% 100%;animation:bang .5s ease-in infinite}
.c-crown.run .jw{animation:blink 1s steps(1) infinite}
.c-crown.run .sp{animation:blink .5s steps(1) infinite -.25s}
.c-artist.run .it{transform-origin:0 100%;animation:swing .5s ease-in-out infinite}
.c-explorer.run .it{animation:tick 1s steps(1) infinite}
.c-builder.run .it{transform-origin:50% 100%;animation:bang .5s ease-in infinite}
.c-hacker.run .sc{animation:blink .5s steps(1) infinite}
.c-hacker.run .sd{animation:blink .5s steps(1) infinite -.25s}
.c-writer.run .it{animation:tick .5s steps(1) infinite}
@keyframes clap{50%{transform:rotate(-25deg)}}@keyframes coin{50%{transform:translateY(-2px) scaleX(.34)}}
@keyframes spin{50%{transform:rotate(45deg)}}@keyframes twirl{25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
@keyframes buzz{25%{transform:translate(-2px,1px)}50%{transform:translate(-1px,3px)}75%{transform:translate(1px,1px)}}
@keyframes blow{50%{transform:scaleX(1.5)}}
.c-director.run .cl{transform-origin:0 100%;animation:clap .5s steps(1) infinite}
.c-toga.run .it{animation:poke 1s steps(1) infinite}.c-toga.run .lf{animation:blink 1s steps(1) infinite -.5s}
.c-scientist.run .it{animation:scan 1s steps(1) infinite}.c-scientist.run .gl{animation:blink 1s steps(1) infinite -.5s}
.c-photographer.run .fs{animation:blink .5s steps(1) infinite}
.c-shopkeeper.run .cn{transform-origin:50% 50%;animation:coin .5s steps(1) infinite}
.c-wizard.run .sr{animation:blink .5s steps(1) infinite}.c-wizard.run .orb{animation:blink 1s steps(1) infinite -.5s}.c-wizard.run .it{animation:poke 1s steps(1) infinite}
.c-spaceman.run{animation:float 1s ease-in-out infinite}.c-spaceman.run .la,.c-spaceman.run .lb,.c-spaceman.run .bd{animation:none}
.c-spaceman.run .ant{animation:blink 1s steps(1) infinite}.c-spaceman.run .pt{animation:blink 1s steps(1) infinite -.5s}
.c-knight.run .pl{transform-origin:50% 100%;animation:swing .5s ease-in-out infinite}.c-knight.run .it{animation:poke 1s steps(1) infinite}
.c-ninja.run .tl{transform-origin:100% 50%;animation:wave .25s steps(1) infinite}.c-ninja.run .st{animation:spin .5s steps(1) infinite}
.c-cowboy.run .ls{transform-origin:50% 100%;animation:twirl 1s ease-in-out infinite}
.c-viking.run .sh{animation:poke .5s steps(1) infinite}.c-viking.run .br{animation:blink 1s steps(1) infinite}
.c-beekeeper.run .bee{animation:buzz 1s steps(1) infinite}
.c-magician.run .rb{animation:blink 1s steps(1) infinite}.c-magician.run .sp{animation:blink .5s steps(1) infinite -.25s}
.c-magician.run .it{transform-origin:50% 100%;animation:swing .5s ease-in-out infinite}
.c-sailor.run .an{transform-origin:50% 100%;animation:twirl 1s ease-in-out infinite}
.c-firefighter.run .wt{animation:blink .5s steps(1) infinite}.c-firefighter.run .wu{animation:blink .5s steps(1) infinite -.25s}
.c-party.run .hn{transform-origin:0 50%;animation:blow .5s steps(1) infinite}
.c-party.run .c1{animation:blink .5s steps(1) infinite}.c-party.run .c2{animation:blink .5s steps(1) infinite -.25s}
.c-tailor.run .bl{transform-origin:50% 100%;animation:snip .5s steps(1) infinite}@keyframes snip{50%{transform:scaleX(.4)}}
.run .chm{animation:hover 1s ease-in-out infinite}@keyframes hover{50%{transform:translateY(-1px)}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

const COSTUMES: Record<string, (f: Fill, t: string, prop: number) => void> = {
  // Fable: astronaut in a glass dome; floats instead of walking, the antenna and the star blink.
  fable: (f, t) => {
    crabBody(f)
    f(6, 7, 18, 1, '#E6E8EE'); f(5, 8, 1, 14, '#E6E8EE'); f(24, 8, 1, 14, '#E6E8EE'); f(6, 22, 18, 1, '#C9CCD2')
    f(6, 8, 18, 14, 'rgba(169,214,245,.32)'); f(8, 9, 2, 1, '#fff'); f(8, 10, 1, 2, '#fff')
    f(14, 4, 2, 3, '#C9CCD2'); f(14, 2, 2, 2, t, 'ant'); f(13, 18, 4, 2, t)
    f(27, 3, 1, 3, '#F5C542', 'star'); f(26, 4, 3, 1, '#F5C542', 'star')
  },
  // Heavy: detective with a deerstalker; the magnifier sweeps and glints.
  heavy: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 3, ['......bbbbbb......', '....bbcbbcbbbb....', '...bbbbbbbbbbbb...', '..bcbbcbbcbbcbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'], { b: '#7A4A26', c: '#A0703F', d: '#5A3519' })
    f(6, 9, 18, 1, t)
    stamp(f, 23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3A3A3C' }, 'it')
    f(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it'); f(25, 6, 1, 4, '#7A4A26', 'it'); f(24, 2, 1, 1, '#fff', 'gl')
  },
  // Careful: engineer in a hard hat; the wrench turns a bolt.
  careful: (f, t) => {
    crabBody(f)
    stamp(f, 6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
    f(13, 5, 4, 2, t)
    stamp(f, 0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8E929A' }, 'it')
  },
  // Medium: chef, the toque traced from DockCrab's Sprites.chefHat; tosses the omelette.
  medium: (f, t) => {
    crabBody(f, -4, 'pan')
    stamp(f, 6, 0, ['........lll.......', '.......lllll......', '.wwwwgwwwwwwgwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwgwwwwwggwwwww', '.wwwwgwwwwwggwwwww', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.'], { w: '#F4F3EE', l: '#F7F6F2', g: '#D2D1C8', b: t, d: '#B45F43' })
    f(22, 8, 7, 2, '#4A4A48', 'pan'); f(26, 10, 1, 1, '#4A4A48', 'pan'); f(24, 7, 3, 1, '#F5B731', 'egg')
  },
  // Light: racer in a helmet; runs at double pace, the checkered flag flutters.
  light: (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 5, ['....rrrrrrrrrr....', '..rrrrrrwwrrrrrr..', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.kkkkkkkkkkkkkkkkr'], { r: t, w: '#F8F6F1', k: INK })
    f(25, 1, 1, 9, '#8E929A')
    stamp(f, 26, 1, ['wkwk', 'kwkw', 'wkwk'], { w: '#F8F6F1', k: INK }, 'flag')
  },
  // Pirate (pool): tricorn, eyepatch; the cutlass fences.
  pirate: (f, t) => {
    crabBody(f)
    stamp(f, 5, 3, ['.kk..............kk.', '.kkk....kkkk....kkk.', '..kkkkkkkwwkkkkkkk..', '..kkkkkkkkkkkkkkkk..', '.gggggggggggggggggg.'], { k: '#55514C', w: '#F8F6F1', g: t })
    f(7, 11, 11, 1, INK); f(18, 11, 4, 3, INK)
    f(27, 6, 1, 9, '#C9CCD2', 'it'); f(26, 15, 3, 1, '#7A4A26', 'it')
  },
  // --- Role costumes (Autumn's fork), picked from the agent's description by roleOf.
  // Contrarian: devil horns and a pitchfork that pokes; the tail wags.
  devil: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 7, 5, ['h..............h', 'hh............hh', 'hhh..........hhh', '.hhh........hhh.', '..hh........hh..'], { h: t })
    stamp(f, 23, 0, ['k.k.k', 'k.k.k', 'kkkkk'], { k: '#3A3A3C' }, 'it')
    f(25, 3, 1, 7, '#3A3A3C', 'it')
    f(4, 20, 3, 1, CLAY, 'tl'); stamp(f, 1, 19, ['.a.', 'aaa', '.a.'], { a: t }, 'tl')
  },
  // First Principles: professor in a mortarboard; the chalk scribbles, dust puffs, the tassel sways.
  professor: (f, t) => {
    crabBody(f, -4, 'it')
    f(9, 7, 12, 3, t); f(9, 9, 12, 1, 'rgba(0,0,0,.25)'); f(6, 5, 18, 1, '#3A3A3E'); f(5, 6, 20, 1, '#2B2B2E'); f(14, 4, 2, 1, t)
    f(16, 5, 6, 1, t); f(22, 6, 1, 3, t, 'ts'); f(21, 9, 3, 2, t, 'ts')
    f(25, 6, 1, 4, '#F4F3EE', 'it')
    f(27, 5, 1, 1, '#F4F3EE', 'ds'); f(28, 7, 1, 1, '#F4F3EE', 'ds')
  },
  // Expansionist: rocket pack and goggles; floats, the flame flickers.
  rocket: (f, t) => {
    stamp(f, 0, 7, ['.ss.', 'tttt', 'tttt', 'ssss', 'tttt', 'tttt', 'tttt', 'tttt', 'dddd'], { s: '#E6E8EE', t, d: '#8E929A' })
    crabBody(f)
    f(7, 10, 16, 1, '#55514C'); f(9, 9, 3, 2, '#A9D6F5'); f(18, 9, 3, 2, '#A9D6F5')
    stamp(f, 0, 16, ['oyyo', '.oo.', '.o..'], { o: '#F08A24', y: '#F5C542' }, 'fl')
  },
  // Outsider: traveller's hat and a suitcase with a sticker that swings.
  traveller: (f, t) => {
    crabBody(f)
    stamp(f, 4, 5, ['.....cccccccccccc.....', '.....cccccccccccc.....', '.....cccccccccccc.....', '.....tttttttttttt.....', 'bbbbbbbbbbbbbbbbbbbbbb'], { c: t, t: '#3A3A3C', b: '#6B4423' })
    stamp(f, 0, 18, ['..hhh..', '.h...h.', 'sssssss', 'sksssks', 'sssssss', 'sttssss', 'sssssss'], { h: '#5A3519', s: '#A0703F', k: '#5A3519', t }, 'bag')
  },
  // Executor: cap, clipboard and a stopwatch that ticks.
  stopwatch: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 7, 6, ['...cccccccccc...', '.cccccccccccccc.', 'cccccccwwccccccc'], { c: t, w: '#F8F6F1' })
    f(3, 9, 20, 1, '#3A3A3C')
    stamp(f, 23, 2, ['..b..', '.sss.', 'swwws', 'swkws', 'swwws', 'swwws', '.sss.'], { b: '#8E929A', s: '#8E929A', w: '#F8F6F1', k: INK }, 'it')
    f(25, 4, 1, 1, '#D0453F', 'hd')
    stamp(f, 0, 11, ['.cc.', 'bccb', 'bwwb', 'bkwb', 'bwwb', 'bkwb', 'bwwb', 'bbbb'], { c: '#8E929A', b: '#A0703F', w: '#F8F6F1', k: '#6B6B68' })
  },
  // Peer review: judge's wig; the gavel bangs.
  judge: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 3, ['...wwwwwwwwwwww...', '.wwgwwgwwgwwgwwgw.', 'wwwwwwwwwwwwwwwwww', 'wgwwgwwgwwgwwgwwgw', 'ww..............ww', 'gw..............wg', 'ww..............ww', 'wg..............gw', 'ww..............ww', '.w..............w.'], { w: '#F1EFE8', g: '#C9C6BC' })
    f(7, 16, 16, 6, t); f(13, 16, 4, 3, '#F8F6F1'); f(14, 19, 2, 2, '#F8F6F1')
    f(25, 3, 1, 7, '#7A4A26', 'it'); f(23, 1, 5, 3, '#5A3519', 'it'); f(25, 1, 1, 3, '#F5C542', 'it')
  },
  // Chairman: crown with blinking jewels and a sceptre.
  crown: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 9, 5, ['g....gg....g', 'gg..gggg..gg', 'gggggggggggg', 'ghggggggghgg', 'gggggggggggg'], { g: '#F5C542', h: '#FBE08A' })
    f(10, 8, 1, 1, '#D0453F', 'jw'); f(14, 8, 2, 1, '#3D7DD8', 'jw'); f(19, 8, 1, 1, '#D0453F', 'jw')
    f(7, 18, 16, 4, t); f(7, 17, 16, 1, '#F8F6F1'); f(9, 17, 1, 1, INK); f(14, 17, 1, 1, INK); f(19, 17, 1, 1, INK)
    f(25, 4, 1, 7, '#C99A1E', 'it'); f(24, 1, 3, 3, t, 'it')
    f(28, 0, 1, 3, '#F5C542', 'sp'); f(27, 1, 3, 1, '#F5C542', 'sp')
  },
  // Designer: beret, palette and a paintbrush that strokes.
  // Siblings hold another tool: 0 brush, 1 pencil, 2 colour swatches, 3 paint roller.
  artist: (f, t, prop) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 5, ['......s...........', '...bbbbbbbbbb.....', '.bbbbbbbbbbbbbb...', 'bbbbbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbbbbb'], { b: t, s: t })
    const tool = prop % 4
    if (tool === 0) {
      f(24, 9, 1, 1, '#A0703F', 'it'); f(25, 7, 1, 2, '#A0703F', 'it'); f(26, 5, 1, 2, '#A0703F', 'it')
      f(27, 4, 1, 1, '#C9CCD2', 'it'); f(27, 3, 1, 1, '#3A3A3C', 'it'); f(28, 2, 1, 1, '#3A3A3C', 'it'); f(28, 1, 1, 1, '#2F80ED', 'it')
    } else if (tool === 1) {
      f(25, 1, 2, 1, INK, 'it'); f(25, 2, 2, 1, '#E8C9A0', 'it'); f(25, 3, 2, 5, '#F5C542', 'it'); f(25, 3, 1, 5, '#E0A82E', 'it')
      f(25, 8, 2, 1, '#C9CCD2', 'it'); f(25, 9, 2, 1, '#E8A0BF', 'it')
    } else if (tool === 2) {
      f(23, 3, 2, 6, '#E5484D', 'it'); f(25, 2, 2, 7, '#2F6FD8', 'it'); f(27, 3, 2, 6, '#F5C542', 'it')
      f(23, 3, 6, 1, 'rgba(255,255,255,.5)', 'it'); f(25, 9, 1, 1, INK, 'it')
    } else {
      f(23, 2, 6, 3, t, 'it'); f(23, 2, 6, 1, 'rgba(255,255,255,.4)', 'it'); f(28, 5, 1, 2, '#8E929A', 'it'); f(26, 6, 3, 1, '#8E929A', 'it'); f(26, 7, 1, 3, '#5E6168', 'it')
    }
    stamp(f, 0, 15, ['.pppp.', 'prpbpp', 'ppppy.', '.ppp..'], { p: '#E8D5B0', r: '#D0453F', b: '#2F80ED', y: '#F5C542' })
  },
  // Costume designer: a tailor who codes. Vest in the accent with a </> badge,
  // measuring tape round the neck, pincushion on the wrist; the scissors snip.
  tailor: (f, t) => {
    crabBody(f, -4, 'it')
    f(7, 17, 16, 5, t); f(13, 17, 4, 1, CLAY); f(14, 18, 2, 1, CLAY)
    stamp(f, 14, 19, ['.w..ww.', 'w..w..w', '.ww..w.'], { w: '#F8F6F1' })
    stamp(f, 7, 15, ['yyyyyyyyyyyyyyyy', 'yky.yky.yky.yky.'], { y: '#F5C542', k: '#3A3A3C' })
    f(9, 17, 1, 4, '#F5C542'); f(20, 17, 1, 3, '#F5C542'); f(9, 20, 1, 1, '#3A3A3C')
    f(3, 12, 4, 2, '#D0453F'); f(4, 11, 2, 1, '#D0453F'); f(3, 10, 1, 1, '#C9CCD2'); f(5, 9, 1, 2, '#C9CCD2'); f(6, 10, 1, 1, '#F5C542')
    stamp(f, 23, 3, ['s....s', '.s..s.', '..ss..'], { s: '#C9CCD2' }, 'bl')
    stamp(f, 23, 6, ['..kk..', 'rr..rr', 'r.rr.r', 'rr..rr'], { k: INK, r: '#D0453F' }, 'it')
  },
  // Researcher: explorer in a pith helmet, scanning through binoculars.
  explorer: (f, t) => {
    crabBody(f, -4)
    stamp(f, 5, 5, ['......kkkkkkkk......', '....kkkkkkkkkkkk....', '...kkkkkkkkkkkkkk...', '...tttttttttttttt...', 'bbbbbbbbbbbbbbbbbbbb'], { k: '#D8C59A', t, b: '#B9A56E' })
    f(14, 4, 2, 1, '#B9A56E'); f(7, 16, 16, 2, t); f(19, 18, 3, 2, t)
    stamp(f, 8, 11, ['kkkk......kkkk', 'kllkkkkkkkkllk', 'kkkk......kkkk'], { k: '#3A3A3C', l: '#A9D6F5' }, 'it')
  },
  // Builder: orange hard hat; the hammer swings.
  builder: (f, t) => {
    crabBody(f, -4, 'it')
    // The hat takes the accent; the ridge and brim are shades laid over it.
    stamp(f, 6, 4, ['.....oooooooo.....', '...ooooooooooooo...', '..oooooooooooooo..', '..oooooooooooooo..', '.oooooooooooooooo.', 'oooooooooooooooooo'], { o: t })
    stamp(f, 6, 4, ['.......hh.........', '........hh........', '........hh........', '........hh........', '........hh........', 'dddddddddddddddddd'], { h: 'rgba(255,255,255,.4)', d: 'rgba(0,0,0,.22)' })
    f(12, 6, 2, 2, '#F8F6F1')
    f(25, 3, 1, 8, '#A0703F', 'it'); f(23, 1, 5, 2, '#5E6168', 'it'); f(22, 1, 1, 1, '#5E6168', 'it')
  },
  // Coder: hacker hoodie at a laptop; code lines blink as it types.
  hacker: (f, t) => {
    crabBody(f)
    stamp(f, 5, 6, ['.....hhhhhhhhhh.....', '...hhhhhhhhhhhhhh...', '..hhhhhhhhhhhhhhhh..', '.hhhhhhhhhhhhhhhhhh.', 'hhh..............hhh', 'hh................hh', 'hh................hh', 'hh................hh', 'hhh..............hhh'], { h: '#3A3D45' })
    f(11, 15, 1, 2, '#C9CCD2'); f(18, 15, 1, 2, '#C9CCD2')
    f(9, 15, 12, 5, '#1F2430'); f(8, 20, 14, 1, '#8E929A')
    f(10, 16, 4, 1, t, 'sc'); f(15, 16, 3, 1, t); f(10, 17, 6, 1, t, 'sd'); f(10, 18, 3, 1, t, 'sc')
  },
  // Writer: spectacles, a quill that scribbles and an ink pot.
  writer: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 8, 11, ['oooo......oooo', 'o..oooooooo..o', 'o..o......o..o', 'oooo......oooo'], { o: '#3A3A3C' })
    stamp(f, 22, 2, ['....gww', '...gwwt', '..gwwt.', '..gwt..', '.gwt...', '.gt....', '.t.....', 'k......'], { w: '#F8F6F1', g: '#C9CCD2', t, k: INK }, 'it')
    f(7, 16, 16, 2, t); f(9, 18, 2, 3, t)
    stamp(f, 0, 21, ['.kk.', 'kbbk', 'kbbk', 'kkkk'], { k: '#2B2B2E', b: t })
  },
  // Motion designer: film director in a black beret and scarf; the clapperboard claps.
  director: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 5, ['......s...........', '...bbbbbbbbbb.....', '.bbbbbbbbbbbbbb...', 'bbbbbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbbbbb'], { b: '#2B2B2E', s: '#2B2B2E' })
    f(7, 16, 16, 2, t); f(9, 18, 2, 3, t)
    stamp(f, 23, 5, ['kkkkkk', 'kwwwwk', 'kwttwk', 'kwwwwk', 'kkkkkk'], { k: INK, w: '#F8F6F1', t }, 'it')
    stamp(f, 23, 3, ['wkwkwk', 'kwkwkw'], { w: '#F8F6F1', k: INK }, 'cl')
  },
  // Council: toga and laurel wreath; the scroll is raised, the leaves glint.
  toga: (f, t) => {
    crabBody(f, -4, 'it')
    f(7, 17, 16, 5, '#F4F3EE'); f(10, 18, 1, 3, '#D9D7CF'); f(15, 18, 1, 3, '#D9D7CF'); f(19, 18, 1, 3, '#D9D7CF')
    f(16, 16, 4, 1, '#F4F3EE'); f(18, 15, 4, 1, '#F4F3EE'); f(20, 14, 3, 1, '#F4F3EE'); f(20, 15, 2, 2, '#F5C542')
    stamp(f, 7, 8, ['l.l.l.l..l.l.l.l', 'llllllllllllllll'], { l: t })
    f(8, 8, 1, 1, '#F5E6A8', 'lf'); f(20, 8, 1, 1, '#F5E6A8', 'lf')
    f(23, 5, 4, 1, '#C9A66B', 'it'); f(24, 6, 2, 4, '#F4F3EE', 'it')
  },
  // QA: lab coat and goggles; the magnifier scans and glints.
  scientist: (f, t) => {
    crabBody(f, -4, 'it')
    f(7, 15, 16, 7, '#F4F3EE'); f(13, 15, 4, 1, CLAY); f(14, 16, 2, 1, CLAY)
    f(14, 18, 1, 1, '#8E929A'); f(14, 20, 1, 1, '#8E929A'); f(18, 17, 3, 2, '#D9D7CF'); f(19, 15, 1, 2, t)
    f(7, 10, 16, 1, '#55514C'); f(8, 9, 5, 2, t); f(17, 9, 5, 2, t); f(9, 9, 3, 1, '#A9D6F5'); f(18, 9, 3, 1, '#A9D6F5')
    stamp(f, 23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3A3A3C' }, 'it')
    f(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it'); f(25, 6, 1, 4, '#7A4A26', 'it'); f(24, 2, 1, 1, '#fff', 'gl')
  },
  // Photographer: bucket hat, camera up to the eyes; the flash fires.
  photographer: (f, t) => {
    crabBody(f)
    stamp(f, 7, 6, ['...tttttttttt...', '..tttttttttttt..', '.tttttttttttttt.', 'dddddddddddddddd'], { t, d: '#3A3A3C' })
    f(9, 12, 12, 6, '#3A3A3C'); f(11, 11, 4, 1, '#3A3A3C'); f(7, 14, 2, 1, INK); f(21, 14, 2, 1, INK)
    stamp(f, 13, 13, ['.gg.', 'gllg', 'gllg', '.gg.'], { g: '#8E929A', l: '#A9D6F5' })
    f(14, 14, 1, 1, '#fff'); f(18, 13, 2, 1, '#F8F6F1', 'fs')
  },
  // Seller: straw boater and shop apron; tosses a coin.
  shopkeeper: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 6, ['....cccccccccc....', '....cccccccccc....', '....rrrrrrrrrr....', 'cccccccccccccccccc'], { c: '#E8C872', r: '#C0392B' })
    f(11, 10, 1, 3, t); f(18, 10, 1, 3, t); f(11, 13, 8, 2, t); f(10, 15, 10, 7, t)
    f(13, 17, 4, 2, 'rgba(255,255,255,.35)')
    f(24, 5, 3, 3, '#F5C542', 'cn'); f(25, 6, 1, 1, '#C99A1E', 'cn')
  },
  // --- The pool: whimsical costumes for agents nothing else describes.
  // Wizard: starry hat, beard and a staff whose orb glows.
  wizard: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 7, 1, ['..........t.....', '.........tt.....', '........ttt.....', '.......tttt.....', '......tttttt....', '.....tttttttt...', '....tttttttttt..', '...tttttttttttt.', 'tttttttttttttttt'], { t })
    f(7, 9, 16, 1, 'rgba(0,0,0,.3)'); f(15, 5, 1, 1, '#F5C542', 'sr'); f(17, 7, 1, 1, '#F5C542', 'sr'); f(12, 8, 1, 1, '#F5C542')
    stamp(f, 10, 15, ['wwwwwwwwww', '.wwwwwwww.', '..wwwwww..', '...wwww...', '....ww....'], { w: '#F1EFE8' })
    f(25, 3, 1, 7, '#7A4A26', 'it'); f(24, 0, 3, 3, '#A9D6F5', 'it'); f(25, 1, 1, 1, '#fff', 'orb')
  },
  // Spaceman: white helmet and gold visor; floats, the antenna and a planet blink.
  spaceman: (f, t) => {
    crabBody(f)
    stamp(f, 6, 5, ['....wwwwwwwwww....', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'ww..............ww', 'ww..............ww', 'ww..............ww', 'ww..............ww'], { w: '#E6E8EE' })
    f(8, 11, 14, 3, '#F5B731'); f(9, 11, 3, 1, '#FCE6A4')
    f(14, 3, 2, 2, t, 'ant'); f(10, 16, 10, 4, t); f(12, 17, 6, 2, '#C9CCD2'); f(13, 17, 1, 1, t); f(15, 18, 1, 1, '#3DDC84')
    stamp(f, 25, 1, ['.pp.', 'pppp', '.pp.'], { p: '#E8A0BF' }, 'pt'); f(24, 2, 6, 1, '#F5C542', 'pt')
  },
  // Knight: steel helm with a swaying plume, shield and sword.
  knight: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 7, 4, ['....hhhhhhhh....', '..hhhhhhhhhhhh..', '.hhhhhhhhhhhhhh.', 'hhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhh', 'hkkkkkkkkkkkkkkh', 'hhhhhhhhhhhhhhhh'], { h: '#B8BCC4', k: INK })
    f(9, 5, 1, 6, '#E6E8EE')
    stamp(f, 13, 0, ['.tt.', 'tttt', '.tt.', '.t..'], { t }, 'pl')
    stamp(f, 0, 13, ['kkkkk', 'ktwtk', 'kwwwk', 'ktwtk', '.ktk.', '..k..'], { k: '#8E929A', t, w: '#F8F6F1' })
    f(25, 0, 1, 8, '#E6E8EE', 'it'); f(24, 8, 3, 1, '#7A4A26', 'it'); f(25, 9, 1, 1, '#7A4A26', 'it')
  },
  // Ninja: black hood with an eye slit; the headband tails flutter, the star spins.
  ninja: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 7, 7, ['..kkkkkkkkkkkk..', '.kkkkkkkkkkkkkk.', 'kkkkkkkkkkkkkkkk', 'tttttttttttttttt', 'kkkkkkkkkkkkkkkk', '................', '................', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk'], { k: '#2B2B2E', t })
    f(4, 10, 3, 1, t, 'tl'); f(2, 11, 3, 1, t, 'tl')
    stamp(f, 24, 6, ['.s.', 'sss', '.s.'], { s: '#C9CCD2' }, 'st')
  },
  // Cowboy: wide hat and bandana; the lasso twirls.
  cowboy: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 5, 4, ['......cccccccc......', '.....cccccccccc.....', '.....cccccccccc.....', '.....kkkkkkkkkk.....', 'c...cccccccccccc...c', '.cccccccccccccccccc.'], { c: '#8B5A2B', k: '#5A3519' })
    stamp(f, 10, 14, ['tttttttttt', '.tttttttt.', '..tttttt..', '...tttt...'], { t })
    stamp(f, 22, 0, ['.rrrr.', 'r....r', 'r....r', '.rrrr.'], { r: '#C9A66B' }, 'ls'); f(25, 4, 1, 6, '#C9A66B', 'ls')
  },
  // Viking: horned helmet, braided beard; the round shield bumps.
  viking: (f, t) => {
    crabBody(f)
    stamp(f, 8, 6, ['....ssssss....', '..ssssssssss..', '.ssssssssssss.', 'bbbbbbbbbbbbbb'], { s: '#9AA0A8', b: '#B07D3A' })
    f(14, 6, 2, 3, '#B07D3A')
    stamp(f, 4, 3, ['w....', 'ww...', '.ww..', '..ww.', '...ww'], { w: '#F1EFE8' })
    stamp(f, 21, 3, ['....w', '...ww', '..ww.', '.ww..', 'ww...'], { w: '#F1EFE8' })
    stamp(f, 10, 14, ['oooooooooo', 'oooooooooo', '.oo....oo.', '.oo....oo.'], { o: '#E07A2E' })
    f(11, 18, 1, 1, '#F5C542', 'br'); f(18, 18, 1, 1, '#F5C542', 'br')
    stamp(f, 23, 12, ['.ttt.', 'ttwtt', 'twkwt', 'ttwtt', '.ttt.'], { t, w: '#F8F6F1', k: '#8E929A' }, 'sh')
  },
  // Beekeeper: wide hat and veil; a bee buzzes around.
  beekeeper: (f, t) => {
    crabBody(f)
    stamp(f, 5, 5, ['......hhhhhhhh......', '......hhhhhhhh......', '......tttttttt......', 'hhhhhhhhhhhhhhhhhhhh'], { h: t, t: '#EDE3C8' })
    f(6, 9, 18, 7, 'rgba(150,150,150,.4)'); f(6, 15, 18, 1, 'rgba(110,110,110,.6)')
    f(26, 2, 2, 1, '#C9E6F5', 'bee'); stamp(f, 25, 3, ['yk', 'ky'], { y: '#F5C542', k: INK }, 'bee')
  },
  // Magician: top hat with a peeking rabbit, bow tie; the wand waves and sparkles.
  magician: (f, t) => {
    crabBody(f, -4, 'it')
    f(12, 1, 2, 3, '#F8F6F1', 'rb'); f(16, 1, 2, 3, '#F8F6F1', 'rb')
    stamp(f, 9, 4, ['kkkkkkkkkkkk', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk', 'tttttttttttt'], { k: INK, t })
    f(10, 4, 1, 4, '#3A3A3C'); f(6, 9, 18, 1, INK)
    stamp(f, 13, 15, ['t..t', 'tttt', 't..t'], { t })
    f(25, 3, 1, 7, INK, 'it'); f(25, 2, 1, 1, '#F8F6F1', 'it')
    f(28, 0, 1, 3, '#F5C542', 'sp'); f(27, 1, 3, 1, '#F5C542', 'sp')
  },
  // Sailor: white cap and navy collar with a red neckerchief; the anchor swings.
  sailor: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 8, 6, ['...wwwwwwww...', '..wwwwwwwwww..', '.tttttttttttt.', 'wwwwwwwwwwwwww'], { w: '#F8F6F1', t })
    f(7, 15, 16, 2, t); f(7, 16, 16, 1, '#F8F6F1'); f(14, 17, 2, 2, '#D0453F'); f(14, 19, 1, 2, '#D0453F')
    stamp(f, 23, 1, ['..k..', '.k.k.', '..k..', 'kkkkk', '..k..', 'k.k.k', '.kkk.'], { k: '#5E6168' }, 'an'); f(25, 8, 1, 2, '#8E929A', 'an')
  },
  // Firefighter: helmet with a gold badge; the hose sprays.
  firefighter: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 4, ['.....rrrrrrrr.....', '...rrrrrrrrrrrr...', '..rrrrrrrrrrrrrr..', '..rrrrrrrrrrrrrr..', '.rrrrrrrrrrrrrrrr.', 'rrrrrrrrrrrrrrrrrrrr'], { r: t })
    f(6, 9, 20, 1, 'rgba(0,0,0,.22)'); f(9, 6, 1, 2, 'rgba(255,255,255,.35)')
    stamp(f, 13, 5, ['gggg', 'gkkg', 'gggg'], { g: '#F5C542', k: '#C99A1E' })
    f(24, 6, 3, 4, '#8E929A', 'it'); f(25, 5, 1, 1, '#5E6168', 'it')
    f(25, 3, 1, 1, '#5DADE2', 'wt'); f(24, 1, 1, 1, '#5DADE2', 'wu'); f(26, 0, 1, 1, '#5DADE2', 'wt'); f(27, 2, 1, 1, '#5DADE2', 'wu')
  },
  // Party: striped cone hat and confetti; the party horn toots.
  party: (f, t) => {
    crabBody(f)
    stamp(f, 11, 1, ['....o....', '...ooo...', '....t....', '...twt...', '...ttw...', '..twttw..', '..tttwt..', '.twttwtt.', 'ttwttwttw'], { o: '#F5C542', t, w: '#F8F6F1' })
    f(3, 4, 1, 1, '#3DDC84', 'c1'); f(25, 3, 1, 1, '#378ADD', 'c2'); f(27, 7, 1, 1, '#F5C542', 'c1'); f(4, 8, 1, 1, '#E8A0BF', 'c2'); f(7, 2, 1, 1, '#D0453F', 'c2')
    f(21, 13, 4, 1, '#F5C542', 'hn'); f(25, 12, 1, 3, t, 'hn')
  },
  other: f => crabBody(f),
}

// The run's look: stored at spawn; a run stored before the pool existed gets its hashed one.
const lookOf = (a: AgentRun): Look =>
  a.costume ? { costume: a.costume, variant: a.variant ?? 0, prop: a.prop ?? 0 } : { ...pickLook(a.id, a.description, a.type), prop: 0 }

const agentCostume = (a: AgentRun): string => lookOf(a).costume

// The run's name: picked and stored at spawn; a run stored before this fork gets its hashed one.
const nameOf = (a: AgentRun): string => a.name ?? pickName(a.id)

// The row's accent: the costume's, so the name line matches what the crab wears.
const agentColor = (a: AgentRun): string => {
  const look = lookOf(a)
  return accentOf(look.costume, look.variant)
}

// "Coco · Designer": the crab's own name and its role.
const nameLine = (a: AgentRun): string => {
  const tier = tierOf(a.type)
  const role = roleOf(a.description)
  return `${nameOf(a)} · ${a.role ?? (role ? role.label : tier === 'other' ? a.type : tierWord(tier))}`
}

const CRAB_SCALE = 1.1

// A crab's charm, floating by its head: what sets apart siblings that share a tool.
const CHARMS: readonly ((f: Fill) => void)[] = [
  f => stamp(f, 0, 1, ['..y..', '.yyy.', 'yyyyy', '.y.y.'], { y: '#F5C542' }, 'chm'),
  f => stamp(f, 1, 2, ['r.r', 'rrr', '.r.'], { r: '#E5484D' }, 'chm'),
  f => stamp(f, 0, 1, ['..kk', '..k.', '..k.', 'kkk.', 'kk..'], { k: INK }, 'chm'),
  f => stamp(f, 1, 0, ['.yy.', 'yyyy', 'yyyy', '.gg.', '.gg.'], { y: '#F5D742', g: '#8E929A' }, 'chm'),
  f => stamp(f, 1, 1, ['.p.', 'pyp', '.p.', '.g.'], { p: '#E8A0BF', y: '#F5C542', g: '#3C9A4A' }, 'chm'),
  f => stamp(f, 1, 2, ['.c.', 'ccc', '.c.'], { c: '#38B6E0' }, 'chm'),
  f => stamp(f, 0, 0, ['.bb.', 'bbbb', '.bb.', '..k.', '..k.'], { b: '#2F6FD8', k: '#8E929A' }, 'chm'),
  f => stamp(f, 1, 1, ['..g', '.gg', 'gg.'], { g: '#2E9E4F' }, 'chm'),
]

const drawCharm = (f: Fill, n: number): void => {
  if (n >= 1) CHARMS[(n - 1) % CHARMS.length]?.(f)
}

// Body and props nest inside `bd` so a prop rides the bob and adds its own motion;
// legs stay outside it and step on their own. `mirror` flips the crab inside its
// own box (x .. x + CRAB_BOX * scale) so it faces left.
const crab = (x: number, y: number, costume: string, dim = false, isWalking = false, scale = CRAB_SCALE, mirror = false, accent?: string, prop = 0): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = COSTUMES[costume] ?? ((g: Fill) => crabBody(g))
  draw(f, accent ?? accentOf(costume), prop)
  // The artist's first props are its tools; after those, and for every other costume, charms.
  drawCharm(f, costume === 'artist' ? prop - 3 : prop)
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  const place = mirror ? `translate(${x + CRAB_BOX * scale},${y}) scale(${-scale},${scale})` : `translate(${x},${y}) scale(${scale})`
  return `<g transform="${place}" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
}

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#9a9a96" stroke-width="1.4"/><path d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke="#9a9a96" stroke-width="1.4" stroke-linecap="round"/>`
}

// Panel rows are laid out left to right; in Hebrew each box mirrors across the
// row (`mx`) and text hugs the mirrored side. `words` text may hold Hebrew and
// takes `direction="rtl"` (whose `start` is the right edge); numbers stay
// left to right so "≈$0.25" keeps its order.
const mx = (W: number, x: number, w = 0): number => (isRtl() ? W - x - w : x)

// Text that starts at x: left-aligned, or right-aligned at the mirrored x.
const startText = (W: number, x: number, y: number, words = true): string =>
  !isRtl()
    ? `x="${x}" y="${y}"`
    : `x="${W - x}" y="${y}"${words ? ' direction="rtl" text-anchor="start"' : ' text-anchor="end"'}`

// Text that ends at x: right-aligned, or left-aligned at the mirrored x.
const endText = (W: number, x: number, y: number, words = false): string =>
  !isRtl() ? `x="${x}" y="${y}" text-anchor="end"` : `x="${W - x}" y="${y}"${words ? ' direction="rtl" text-anchor="end"' : ''}`

const crabWidth = (scale: number): number => Math.round(CRAB_BOX * scale * 100) / 100

// A panel crab at x in a row of width W: on the mirrored side and facing left in Hebrew.
const rowCrab = (W: number, x: number, y: number, costume: string, dim = false, isWalking = false, accent?: string, prop = 0): string =>
  crab(mx(W, x, crabWidth(CRAB_SCALE)), y, costume, dim, isWalking, CRAB_SCALE, isRtl(), accent, prop)

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${CRAB_CSS}${body}</svg>`

// The pane's own title already says "Agents": the header names the flow, if any.
const headerSvg = (W: number, title: string, t: ReturnType<typeof totals>): string => {
  const s = tr()
  const gap = 6
  const tw = (W - gap * 2) / 3
  const top = title ? 28 : 0
  const tile = (i: number, k: string, v: string) =>
    `<rect class="tile" x="${mx(W, i * (tw + gap), tw)}" y="${top}" width="${tw}" height="40" rx="8"/>
<text class="s" ${startText(W, i * (tw + gap) + 9, top + 16)} font-family="${FONT}" font-size="11">${k}</text>
<text class="t" ${startText(W, i * (tw + gap) + 9, top + 33, false)} font-family="${FONT}" font-size="15" font-weight="600" font-variant-numeric="tabular-nums">${v}</text>`
  return svg(
    W,
    headerHeight(title),
    `${title ? `<text class="t" ${startText(W, 0, 15)} font-family="${FONT}" font-size="14" font-weight="600">${xml(fitText(title, 14, W))}</text>` : ''}
${tile(0, s.cost, '≈' + fmtCost(t.cost))}${tile(1, s.tokens, fmtTokens(t.tokens))}${tile(2, s.time, fmtTime(t.time))}`,
  )
}

const headerHeight = (title: string): number => (title ? 72 : 44)

// The task's own progress when the worker reports steps; a finished run is full.
const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

const agentSvg = (W: number, a: AgentRun, at: number): string => {
  const s = tr()
  const tier = tierOf(a.type)
  const color = agentColor(a)
  const ctx = ctxOf(a)
  const textW = W - 42 - 22
  const who = nameLine(a)
  // With a role on the name line, a savvy tier moves into the grey details.
  const meta = roleOf(a.description) && tier !== 'other' ? [tierWord(tier), runModel(a)] : [runModel(a)]
  if (a.round > 1) meta.push(`${s.round} ${a.round}`)
  if (a.status === 'failed') meta.push(s.failed)
  const barW = textW
  const progress = progressOf(a)
  const stats = `${s.ctx} ${ctx}% · ${fmtTokens(a.contextTokens)}  ≈${fmtCost(a.costUsd)}  ${fmtTime(elapsed(a, at))}`
  const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const stepsW = Math.max(0, barW - textWidth(stats, 11) - 12)
  // Without reported steps the bar falls back to the context, drawn grey.
  const fillW = Math.round(barW * (progress ?? ctx / 100))
  return svg(
    W,
    66,
    `${rowCrab(W, 0, 14, agentCostume(a), false, a.status === 'running', color, lookOf(a).prop)}
<text class="t" ${startText(W, 42, 18)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>
<text ${startText(W, 42, 34)} font-family="${FONT}" font-size="11"><tspan fill="${color}" font-weight="600">${xml(fitText(who, 11, textW * 0.6))}</tspan><tspan class="s">  ${xml(fitText(meta.join('  ·  '), 11, Math.max(30, textW - textWidth(fitText(who, 11, textW * 0.6), 11) - 10)))}</tspan></text>
${steps && stepsW > 30 ? `<text class="t" ${startText(W, 42, 49)} font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(fitText(steps, 11, stepsW))}</text>` : ''}
<text class="s" ${endText(W, 42 + barW, 49, true)} font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="${mx(W, 42, barW)}" y="55" width="${barW}" height="4" rx="2"/><rect${progress === null ? ' class="m"' : ''} x="${mx(W, 42, fillW)}" y="55" width="${fillW}" height="4" rx="2"${progress === null ? '' : ` fill="${color}"`}/>
${statusMark(mx(W, W - 8), 16, a.status, color)}
<line class="ln" x1="0" y1="65.5" x2="${W}" y2="65.5"/>`,
  )
}

// A planned task's crab: the roster's for its role when there is one.
const plannedLook = (p: Planned, roster: readonly RosterCrab[]): { costume: string; accent?: string; prop: number } => {
  const tier = p.tier in TIER_COLOR ? p.tier : 'other'
  const role = normaliseRole(p.title, tier === 'other' ? '' : `savvy-${tier}`)
  const crab = roster.find(c => c.slot === 0 && roleKey(c.role) === roleKey(role))
  return crab ? { costume: crab.costume, accent: accentOf(crab.costume, crab.variant), prop: crab.prop } : { costume: plannedCostume(p.title, tier), prop: 0 }
}

const plannedSvg = (W: number, p: Planned, roster: readonly RosterCrab[] = []): string => {
  const look = plannedLook(p, roster)
  const tier = p.tier in TIER_COLOR ? p.tier : 'other'
  const color = colorOf(tier)
  const textW = W - 42 - 22
  const meta = [tierModel(tier)]
  if (p.after.length) meta.push(`${tr().after} ${p.after.join(', ')}`)
  return svg(
    W,
    46,
    `${rowCrab(W, 0, 6, look.costume, true, false, look.accent, look.prop)}
<text class="s" ${startText(W, 42, 18)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(`${p.n}. ${p.title}`, 13, textW))}</text>
<text ${startText(W, 42, 34)} font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tierWord(tier))}</tspan><tspan class="m">  ${xml(meta.filter(Boolean).join('  ·  '))}</tspan></text>
${statusMark(mx(W, W - 8), 16, 'planned', color)}
<line class="ln" x1="0" y1="45.5" x2="${W}" y2="45.5"/>`,
  )
}

// The lead's row: the plain original crab, in the brand clay, with what the main session is doing.
// Its name is the `leadName` option, read when the module loads.
let leadName = 'Claude'
const leadText = (m: Lead): string => (m.isWorking ? m.activity || tr().deskBusy : tr().leadIdle)

const leadSvg = (W: number, m: Lead): string => {
  const s = tr()
  const textW = W - 42 - 22
  return svg(
    W,
    46,
    `${rowCrab(W, 0, 6, 'other', false, m.isWorking, CLAY)}
<text ${startText(W, 42, 18)} font-family="${FONT}" font-size="13" font-weight="600"><tspan fill="${CLAY}">${xml(leadName)}</tspan><tspan class="s" font-weight="400">  ·  ${xml(s.lead)}</tspan></text>
<text class="s" ${startText(W, 42, 34)} font-family="${FONT}" font-size="11">${xml(fitText(leadText(m), 11, textW))}</text>
${statusMark(mx(W, W - 8), 16, m.isWorking ? 'running' : 'done', CLAY)}
<line class="ln" x1="0" y1="45.5" x2="${W}" y2="45.5"/>`,
  )
}

const compactSvg = (W: number, list: AgentRun[], planned: Planned[], t: ReturnType<typeof totals>, roster: readonly RosterCrab[] = [], lead?: Lead): string => {
  const icons = [
    ...(lead ? [{ k: 'other', c: CLAY, s: lead.isWorking ? 'running' : 'done', dim: false, a: CLAY, p: 0 }] : []),
    ...list.filter(a => a.status === 'running').map(a => ({ k: agentCostume(a), c: agentColor(a), s: 'running', dim: false, a: agentColor(a), p: lookOf(a).prop })),
    ...list.filter(a => a.status !== 'running').map(a => ({ k: agentCostume(a), c: agentColor(a), s: a.status, dim: false, a: agentColor(a), p: lookOf(a).prop })),
    ...planned.map(p => ({ k: plannedLook(p, roster).costume, c: colorOf(p.tier), s: 'planned', dim: true, a: plannedLook(p, roster).accent, p: plannedLook(p, roster).prop })),
  ]
  const fit = Math.max(1, Math.floor((W - 150) / 36))
  const shown = icons.slice(0, fit)
  const more = icons.length - shown.length
  const body = shown
    .map((ic, i) => rowCrab(W, i * 36, 0, ic.k, ic.dim, ic.s === 'running', ic.a, ic.p) + (ic.s === 'running' ? `<circle class="live" cx="${mx(W, i * 36 + 32)}" cy="4" r="3" fill="${ic.c}"/>` : ''))
    .join('')
  const x = shown.length * 36 + (more ? 4 : 0)
  return svg(
    W,
    32,
    `${body}${more ? `<text class="s" ${startText(W, x, 21, false)} font-family="${FONT}" font-size="12">+${more}</text>` : ''}
<text class="s" ${endText(W, W, 21)} font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(t.time)}</text>`,
  )
}

// --- terminal drawing: the same rows in text.

const ctxBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗', planned: '◷' }

// What a subagent's tool call is doing, for its bubble in the office: "Editing app.json".
const QUIET_TOOLS = new Set(['ToolSearch', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', TOOL, STEP_TOOL])
const baseName = (v: unknown): string => (typeof v === 'string' ? (v.split(/[\\/]/).filter(Boolean).pop() ?? '') : '')

const activityOf = (e: Record<string, unknown>): string => {
  const v = tr().verbs
  const tool = String(e.tool ?? '')
  const str = (k: string): string => (typeof e[k] === 'string' ? (e[k] as string).trim() : '')
  const text = (() => {
    switch (tool) {
      case 'Read':
        return `${v.read} ${baseName(e.file_path)}`
      case 'Edit':
      case 'MultiEdit':
      case 'NotebookEdit':
        return `${v.edit} ${baseName(e.file_path ?? e.notebook_path)}`
      case 'Write':
        return `${v.write} ${baseName(e.file_path)}`
      case 'Grep':
      case 'WebSearch':
        return `${v.search} ${str('pattern') || str('query')}`
      case 'Glob':
        return `${v.find} ${str('pattern')}`
      case 'Bash':
      case 'PowerShell':
        return str('description') || `${v.run} ${str('command').split(/\s+/)[0] ?? ''}`
      case 'WebFetch':
        return `${v.fetch} ${/^https?:\/\/([^/]+)/.exec(str('url'))?.[1] ?? str('url')}`
      case 'Agent':
        return `${v.delegate} ${str('description')}`
      case 'Skill':
        return `${v.use} ${str('skill')}`
      default:
        return tool.startsWith('mcp__') ? `${v.use} ${tool.split('__').pop() ?? tool}` : tool
    }
  })()
  return clip(text.trim(), 48)
}

// Opens the Crab Office pane, or brings it forward from behind another tab.
async function openPane($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, now, () => at)
  await $.ui.open({ id: PANE, title: tr().pane })
}

// Opens the pane, or closes it when it is up; true when it ends up open.
async function togglePane($: EngineInterface): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return false
  }
  await openPane($)
  return true
}

// `/crab-office` and `/agents-info`: no argument toggles the pane; `open` opens it without toggling.
async function paneCommand($: EngineInterface, args: string | undefined): Promise<{ text: string }> {
  if ((args ?? '').trim() === 'open') {
    await openPane($)
    return { text: tr().opened }
  }
  const isOpen = await togglePane($)
  return { text: isOpen ? tr().opened : tr().closed }
}

// "open crab office", typed at the prompt: optionally after a name ("Claude, ..."), with "please", "the" or "my".
const OPEN_PHRASE = /^(?:[\p{L}]+[,!]?\s+)?(?:please\s+)?(?:open|show)\s+(?:up\s+)?(?:the\s+|my\s+)?crab[\s-]?office(?:\s+please)?[\s.!]*$/iu
// Prompts no person typed: these pass through whatever they say.
const NOT_TYPED = new Set(['peer', 'task-notification', 'scheduled-trigger'])

async function autoOpen($: EngineInterface, key: string): Promise<void> {
  const p = await read($, panel)
  if (p.autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key }))
  void $.ui.open({ id: PANE, title: tr().pane })
}

// ---------------------------------------------------------------------------
// Autumn's fork: the crab roster file, ~/.claude/crab-office/roster/crabs.json (outside
// any plugin cache, so updates never touch it). Reads and writes go one at a time.

let memo: Roster | null = null
let lock: Promise<unknown> = Promise.resolve()

async function rosterPath($: EngineInterface): Promise<string | null> {
  // $.env.get takes literal names, so the variables the mod reads can be listed.
  const quiet = (p: Promise<string | undefined>) => p.then(v => v || '').catch(() => '')
  const home = (await quiet($.env.get('USERPROFILE'))) || (await quiet($.env.get('HOME')))
  const dir = (await quiet($.env.get('CLAUDE_CONFIG_DIR'))) || (home ? `${home}/.claude` : '')
  return dir ? `${dir.replace(/\\/g, '/').replace(/\/$/, '')}/crab-office/roster/crabs.json` : null
}

// Runs `work` after every earlier roster change and spawn has settled.
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = lock.then(work)
  lock = run.catch(() => undefined)
  return run
}

// Runs `fn` on the roster as the file holds it, writing back what it returns.
// A file that does not parse, that parsing had to tidy, or of an older version
// (moved over to the role groups) is copied aside first. Call it inside `serial`.
async function rosterTxn<T>($: EngineInterface, fn: (r: Roster) => { roster: Roster; out: T }): Promise<T> {
  {
    const path = await rosterPath($)
    let text: string | null = null
    if (path) {
      try {
        text = String(await $.fs.read(path))
      } catch {
        text = null
      }
    }
    const parsed = text === null ? null : parseRoster(text)
    const roster = parsed ?? memo ?? seedRoster()
    const { roster: next, out } = fn(roster)
    memo = next
    const body = serializeRoster(next)
    if (path && body !== text) {
      try {
        if (text !== null && serializeRoster(roster) !== text) await $.fs.write(`${path}.bak-${await $.clock.now()}`, text)
        await $.fs.write(path, body)
      } catch {
        // No file system (a test, a sandbox): the roster lives in memory for this load.
      }
    }
    await update($, crabs, () => members(next))
    return out
  }
}

const withRoster = <T,>($: EngineInterface, fn: (r: Roster) => { roster: Roster; out: T }): Promise<T> => serial(() => rosterTxn($, fn))

export const register: Register = (on, options) => {
  leadName = typeof options.leadName === 'string' && options.leadName.trim() ? options.leadName.trim().slice(0, 24) : 'Claude'
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    lang = await detectLang($, options.language)
    await withRoster($, r => ({ roster: r, out: null })).catch(() => null)
    await $.tool.register({
      name: 'progress',
      description:
        'Report /savvy-flow progress to the progress bar above the prompt and the agents panel. ' +
        'Call it after presenting the plan (title, total, tasks, phase "delegate"), each time a task is accepted (done), ' +
        'when switching phase or re-planning (tasks), and once at the end with finished: true. Fields left out keep their previous value. ' +
        'For the main session only: a call from a subagent is ignored (workers report with `step`).',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name of the overall task, a few words.' },
          total: { type: 'integer', minimum: 0, description: 'Number of planned worker tasks.' },
          done: { type: 'integer', minimum: 0, description: 'Number of tasks accepted after review.' },
          phase: { type: 'string', enum: [...PHASES] },
          finished: { type: 'boolean', description: 'True once the flow is closed.' },
          tasks: {
            type: 'array',
            description:
              'The planned worker tasks in order, numbered from 1. Each title must equal the Agent tool `description` the task will be delegated with, so the panel can match runs to tasks.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'A few words; reused verbatim as the Agent description.' },
                tier: { type: 'string', enum: [...TIERS] },
                after: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the tasks this one waits for.' },
              },
              required: ['title', 'tier'],
            },
          },
        },
      },
    })
    await $.tool.register({
      name: 'step',
      description:
        'For savvy-flow workers: report progress on your own task to the agents panel. ' +
        'Right after reading the brief, call it with `total` (your plan in 3-8 steps) and `done: 0`; ' +
        'call it again as each step finishes. Cheap and silent: it only draws a bar.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, description: 'Steps planned; may change if the plan changes.' },
          note: { type: 'string', description: 'The step in progress, a few words.' },
        },
        required: ['done'],
      },
      // In every agent's tool list, not behind ToolSearch: workers do not go looking for it.
      isDeferred: false,
    })
    await $.command.register({
      name: 'crab-office',
      description: 'Show or hide the Crab Office: the subagents, running, finished and planned, and the pixel office where they work',
    })
    await $.command.register({
      name: 'agents-info',
      description: 'Show or hide the panel of subagents: running, finished and planned, with model, context, cost and time',
    })

    // A new chat opens the Crab Office once; a reload of the mod in the same chat does not open it again.
    if (options.openAtStart !== 'no') {
      const p = await read($, panel)
      if (!p.isStartOpened) {
        await update($, panel, prev => ({ ...prev, isStartOpened: true }))
        const at = await $.clock.now()
        await update($, now, () => at)
        // Not awaited: with no surface attached yet, the pane waits for one.
        void $.ui.open({ id: PANE, title: tr().pane })
      }
    }

    // Ticks the running agents' clocks; quiet when nothing runs.
    $.clock.every(1000, () => {
      void (async () => {
        const list = await read($, agents)
        if (!list.some(a => a.status === 'running')) return
        const at = await $.clock.now()
        await update($, now, () => at)
      })()
    })
    return started
  })

  on('command.run', { command: 'crab-office' }, ($, e) => paneCommand($, e.args))
  on('command.run', { command: 'agents-info' }, ($, e) => paneCommand($, e.args))

  // "open crab office" at the prompt opens the pane and goes no further: the model never gets it.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || NOT_TYPED.has(e.origin?.kind ?? '') || !OPEN_PHRASE.test(e.text.trim())) return next(e)
    await openPane($)
    return { drop: tr().opened }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    // The flow is the main session's: a call from a worker's loop carries its agentId
    // and changes nothing, or any subagent could rename, finish or reset the flow.
    if (e.agentId) return { result: 'ignored: only the main session reports the flow' }
    const input = e as unknown as ProgressInput
    const prev = await read($, flow)
    if (isNewFlow(prev, input) && input.title !== undefined) {
      // A new flow starts with a clean list; agents still running stay.
      await update($, agents, list => list.filter(a => a.status === 'running'))
    }
    const next = await update($, flow, p => merge(p, input))
    if (next && input.tasks?.length) await autoOpen($, next.title)
    return { result: `ok: ${label(next ?? blank())}` }
  })

  // A worker's own progress: the call runs in the worker's loop, so agentId names it.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    const agentId = e.agentId
    if (!agentId) return { result: 'ignored: only subagents report steps' }
    let matched = false
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        matched = true
        const total = Math.max(0, Math.round(input.total ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(input.done ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined }
      }),
    )
    return { result: matched ? 'ok' : `ignored: no panel row for agent ${agentId}` }
  })

  // Safety net: worker launches move the faint layer even if the orchestrator forgets to report.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const type = String(e.subagent_type ?? '')
    if (!type.startsWith('savvy-')) return next(e)

    await update($, flow, prev => {
      const base = prev && !prev.isFinished ? { ...blank(), ...prev } : blank()
      return { ...base, running: base.running + 1, phase: base.phase === 'plan' ? 'delegate' : base.phase }
    })
    try {
      return await next(e)
    } finally {
      await update($, flow, prev => (prev ? { ...prev, running: Math.max(0, prev.running - 1) } : prev))
    }
  })

  // A tool call's few words: a subagent's for its desk bubble, the main session's for the lead.
  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    const activity = QUIET_TOOLS.has(e.tool) ? '' : activityOf(e as unknown as Record<string, unknown>)
    if (activity && agentId) {
      await update($, agents, list =>
        list.some(a => a.agentId === agentId && a.activity !== activity) ? list.map(a => (a.agentId === agentId ? { ...a, activity } : a)) : list,
      )
    } else if (activity) {
      await update($, leadAtom, (prev): Lead => (prev.activity === activity ? prev : { ...prev, activity }))
    }
    return next(e)
  })

  // The lead works while the main session's turn runs, and waits for you between turns.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, leadAtom, (): Lead => ({ isWorking: true, activity: '' }))
    return next(e)
  })
  on('agent.spawn', async ($, e, next) => {
    const isUnbriefed = e.subagentType.startsWith('savvy-') && !e.prompt.includes(STEP_TOOL)
    const started = await next(isUnbriefed ? { ...e, prompt: e.prompt + STEP_BRIEF } : e)
    if (started.deny !== undefined) return started

    const at = await $.clock.now()
    const role = normaliseRole(e.description, e.subagentType)
    const id = started.agentId ?? e.tool_use_id
    // One queue turn: pick the role's free slot, fetch (or create) that slot's crab,
    // and add the row, so two agents starting together never take the same slot.
    await serial(async () => {
    const current = await read($, agents)
    const known = current.find(a => a.id === id)
    const slot =
      known?.ordinal !== undefined
        ? known.ordinal
        : freeSlot(current.filter(a => a.id !== id && a.status === 'running' && a.role && roleKey(a.role) === roleKey(role)).map(a => a.ordinal ?? 0))
    // Slot 0 is the role's own crab, 1.. its siblings: the same crab per slot every time.
    const crab: Crab | null = await rosterTxn($, r => {
      const { roster, crab: c } = assign(r, role, baseCostume(role, e.description, e.subagentType), slot)
      return { roster, out: c }
    }).catch(() => null)
    await update($, agents, list => {
      const round = 1 + list.filter(a => norm(a.description) === norm(e.description) && e.description).length
      const others = list.filter(a => a.id !== id)
      // Never a running agent's name; while names remain, none shown this session either.
      const name =
        list.find(a => a.id === id)?.name ??
        pickName(id, others.filter(a => a.status === 'running').map(nameOf), others.map(nameOf))
      const prev = list.find(a => a.id === id)
      // Without the roster (it failed): never a running agent's exact look.
      const look = prev?.costume
        ? lookOf(prev)
        : (crab ?? pickLook(id, e.description, e.subagentType, others.filter(a => a.status === 'running').map(lookOf)))
      const run: AgentRun = {
        id,
        name: prev?.name ?? crab?.name ?? name,
        role,
        ordinal: slot,
        costume: look.costume,
        variant: look.variant,
        prop: prev?.prop ?? crab?.prop ?? 0,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-200)
    })
    })
    await update($, now, () => at)
    if (e.subagentType.startsWith('savvy-')) {
      const f = await read($, flow)
      await autoOpen($, f && !f.isFinished ? f.title : 'savvy-flow')
    } else if (options.autoOpen === 'any') {
      await autoOpen($, 'any-agent')
    }
    return started
  })

  // Each model request of a subagent: live context, tokens and cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (!agentId || !usage) return result

    const model = usage.model || e.model
    await update($, agents, list =>
      list.map((a): AgentRun =>
        a.agentId !== agentId
          ? a
          : {
              ...a,
              model,
              effort: typeof e.effort === 'string' ? e.effort : a.effort,
              status: 'running',
              endedAt: undefined,
              contextTokens:
                (usage.input_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0) +
                (usage.output_tokens || 0),
              contextMax: windowOf(model),
              tokens:
                a.tokens +
                (usage.input_tokens || 0) +
                (usage.output_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0),
              costUsd: a.costUsd + costOf(model, usage, true),
              steps: a.steps + 1,
            },
      ),
    )
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    // The main session's turn is over: the lead waits for you.
    if (agentId === undefined) await update($, leadAtom, (prev): Lead => ({ ...prev, isWorking: false }))
    if (agentId) {
      const at = await $.clock.now()
      await update($, agents, list =>
        list.map((a): AgentRun => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && e.usage
          return {
            ...a,
            status: e.reason === 'answer' ? 'done' : 'failed',
            endedAt: at,
            ...(fallback && e.usage
              ? {
                  model: e.usage.model || a.model,
                  tokens:
                    e.usage.input_tokens +
                    e.usage.output_tokens +
                    e.usage.cache_read_input_tokens +
                    e.usage.cache_creation_input_tokens,
                  costUsd: costOf(e.usage.model || a.model, e.usage, false),
                }
              : {}),
          }
        }),
      )
      await update($, now, () => at)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const f = await read($, flow)
    const p: Panel = await read($, panel)
    const roster: RosterCrab[] = await read($, crabs)
    const lead: Lead = await read($, leadAtom)
    // The desktop app and VS Code draw pictures: the crab rows and the office.
    const isDrawn = e.surface === 'desktop' || e.surface === 'vscode'
    // The office redraws as agents change, not on the clock's tick: its scene is big, and its crabs move on their own.
    const isOfficeDrawn = p.view === 'office' && isDrawn
    const at = Math.max(isOfficeDrawn ? await $.clock.now() : await read($, now), ...list.map(a => a.startedAt), 0)

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const planned = plannedOf(f, list)
    const t = totals(list, at)
    // The pane's title says "Agents"; inside, only the flow's own name.
    const title = f && !f.isFinished ? f.title : ''

    const toggleCompact = (
      <Button
        key="compact"
        label={p.isCompact ? s.expand : s.collapse}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))}
      />
    )
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? (isRtl() ? '◂' : '▸') : '▾'} ${s.finished} · ${finished.length}`}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )
    const isEmpty = list.length === 0 && planned.length === 0
    const summary = `≈${fmtCost(t.cost)}, ${fmtTokens(t.tokens)} ${s.tokensWord}, ${fmtTime(t.time)}`

    if (isDrawn && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const section = (key: string, text: string) => (
        <Text key={key} dimColor>
          {text}
        </Text>
      )

      // In Hebrew the column hugs the right edge: section heads and buttons right-aligned.
      const align = isRtl() ? 'flex-end' : undefined
      const isOffice = p.view === 'office'
      const viewToggle = (
        <Button
          key="view"
          label={isOffice ? `☰ ${s.agentsView}` : `▦ ${s.office}`}
          plain
          onPress={() => update($, panel, (prev): Panel => ({ ...prev, view: prev.view === 'office' ? 'list' : 'office' }))}
        />
      )

      if (isOffice) {
        // The office: everyone as a crab in a pixel floor plan. Running ones work and run errands,
        // finished ones take a break, planned and failed ones wait in reception.
        const crabFor = (a: AgentRun): OfficeCrab => ({
          id: a.id,
          name: nameOf(a),
          color: agentColor(a),
          status: a.status,
          costume: agentCostume(a),
          activity: a.activity ?? (a.stepNote ? `${a.stepDone ?? 0}/${a.stepTotal ?? 0} ${a.stepNote}` : ''),
          progress: progressOf(a),
          draw: isWalking => crab(0, 0, agentCostume(a), false, isWalking, CRAB_S, false, agentColor(a), lookOf(a).prop),
        })
        const people: OfficeCrab[] = [
          {
            id: 'lead',
            name: leadName,
            color: CLAY,
            status: lead.isWorking ? 'running' : 'done',
            costume: 'other',
            activity: leadText(lead),
            progress: null,
            draw: isWalking => crab(0, 0, 'other', false, isWalking, CRAB_S, false, CLAY),
            isLead: true,
          },
          ...list.filter(a => a.status === 'running').map(crabFor),
          ...finished.map(crabFor),
          ...planned.map(pl => {
            const look = plannedLook(pl, roster)
            return {
              id: `plan-${pl.n}`,
              name: `${pl.n}. ${pl.title}`,
              color: colorOf(pl.tier),
              status: 'planned' as const,
              costume: look.costume,
              activity: '',
              progress: null,
              draw: () => crab(0, 0, look.costume, true, false, CRAB_S, false, look.accent, look.prop),
            }
          }),
        ]
        const resting = finished.filter(a => a.status === 'done').length
        const waiting = finished.length - resting + planned.length
        const caption = isEmpty ? s.empty : `${running.length} ${s.atWork} · ${resting} ${s.onBreak} · ${waiting} ${s.waiting}`
        // The scene comes as stacked Svgs (each under the engine's size cap): the first
        // sizes the box, the rest are laid over it in paint order.
        const [base = '', ...layers] = officeSvg({ W, crabs: people, labels: s.rooms, now: at, crabCss: CRAB_CSS, working: s.deskBusy })
        const OH = officeHeight(W, people)
        return (
          <Box flexDirection="column" gap={1} alignItems={align}>
            {viewToggle}
            <Svg source={headerSvg(W, title, t)} alt={title ? `${title}: ${summary}` : summary} width={W} height={headerHeight(title)} />
            <Box flexDirection="column">
              <Svg source={base} alt={`${s.office}: ${caption}`} width={W} height={OH} />
              {layers.map((source, i) => (
                <Box key={`office-${i}`} position="absolute" top={0} left={0}>
                  <Svg source={source} alt={`${s.office} ${i + 2}`} width={W} height={OH} />
                </Box>
              ))}
            </Box>
            <Text dimColor>{caption}</Text>
          </Box>
        )
      }

      if (p.isCompact) {
        return (
          <Box flexDirection="column" gap={1} alignItems={align}>
            {viewToggle}
            <Svg source={compactSvg(W, list, planned, t, roster, lead)} alt={`${leadName} + ${list.length} ${s.agentsCount}, ${summary}`} width={W} height={32} />
            {toggleCompact}
          </Box>
        )
      }
      const shownDone = p.isDoneCollapsed ? 0 : finished.length
      const lines = 2 + (isEmpty ? 1 : 0) + (running.length > 0 ? 1 : 0) + (finished.length > 0 ? 1 : 0) + (planned.length > 0 ? 1 : 0)
      const gridH = headerHeight(title) + lines * LINE_H + (running.length + shownDone) * 66 + (planned.length + 1) * 46
      return (
        <Box flexDirection="column">
          {/* The grid sizes the pane; the content is placed over it, as an
              absolute Box paints over the siblings before it. */}
          {gridTiles(gridH).map((tileH, i) => (
            <Svg key={`grid-${i}`} source={gridSvg(W, tileH)} alt="dotted grid" width={W} height={tileH} />
          ))}
          <Box flexDirection="column" position="absolute" top={0} left={0} right={0} alignItems={align}>
            {viewToggle}
            <Svg source={headerSvg(W, title, t)} alt={title ? `${title}: ${summary}` : summary} width={W} height={headerHeight(title)} />
            {toggleCompact}
            <Svg key="lead" source={leadSvg(W, lead)} alt={`${leadName} · ${s.lead}: ${leadText(lead)}`} width={W} height={46} />
            {isEmpty && <Text dimColor>{s.empty}</Text>}
            {running.length > 0 && section('h-run', `${s.running} · ${running.length}`)}
            {running.map(a => (
              <Svg key={a.id} source={agentSvg(W, a, at)} alt={`${nameLine(a)}, ${a.description}: ${modelName(a.model)}, ${s.isRunning}`} width={W} height={66} />
            ))}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed &&
              finished.map(a => (
                <Svg key={a.id} source={agentSvg(W, a, at)} alt={`${nameLine(a)}, ${a.description}: ${modelName(a.model)}, ${s.isFinished}`} width={W} height={66} />
              ))}
            {planned.length > 0 && section('h-plan', `${s.planned} · ${planned.length}`)}
            {planned.map(pl => (
              <Svg key={`plan-${pl.n}`} source={plannedSvg(W, pl, roster)} alt={`${pl.n}. ${pl.title}: ${s.isPlanned}`} width={W} height={46} />
            ))}
          </Box>
        </Box>
      )
    }

    // Terminal: the same content in text rows.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const row = (a: AgentRun) => {
      const tier = tierOf(a.type)
      const color = agentColor(a)
      const ctx = ctxOf(a)
      const progress = progressOf(a)
      const hasRole = roleOf(a.description) !== null
      const model = runModel(a)
      const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={color}>▣</Text>
            <Text bold wrap="truncate-end">
              {a.description || a.type}
            </Text>
            <Text color={a.status === 'failed' ? 'red' : a.status === 'done' ? 'green' : color}>{STATUS_GLYPH[a.status]}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {'  '}
            <Text color={color}>{nameLine(a)}</Text>
            {hasRole && tier !== 'other' ? ` · ${tierWord(tier)}` : ''} · {model}
            {a.round > 1 ? ` · ${s.round} ${a.round}` : ''}
          </Text>
          <Text wrap="truncate-end">
            {'  '}
            {progress === null ? <Text dimColor>{ctxBar(ctx, barW)}</Text> : <Text color={color}>{ctxBar(progress * 100, barW)}</Text>}
            <Text dimColor>
              {' '}
              {steps}{s.ctx} {ctx}% · {fmtTokens(a.contextTokens)} ≈{fmtCost(a.costUsd)} {fmtTime(elapsed(a, at))}
            </Text>
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold wrap="truncate-end">
            {title}
          </Text>
          {toggleCompact}
        </Box>
        <Text dimColor>
          ≈{fmtCost(t.cost)} · {fmtTokens(t.tokens)} {s.tokensWord} · {fmtTime(t.time)}
        </Text>
        {p.isCompact ? (
          <Text wrap="truncate-end">
            <Text color={CLAY}>{lead.isWorking ? STATUS_GLYPH.running : STATUS_GLYPH.done} </Text>
            {[...running, ...finished].map(a => (
              <Text key={a.id} color={agentColor(a)}>
                {STATUS_GLYPH[a.status]}{' '}
              </Text>
            ))}
            {planned.map(pl => (
              <Text key={`plan-${pl.n}`} dimColor>
                ◷{' '}
              </Text>
            ))}
          </Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            <Box flexDirection="column" marginBottom={1}>
              <Text wrap="truncate-end">
                <Text color={CLAY}>▣</Text> <Text bold color={CLAY}>{leadName}</Text>
                <Text dimColor> · {s.lead}</Text> <Text color={lead.isWorking ? CLAY : 'green'}>{lead.isWorking ? STATUS_GLYPH.running : STATUS_GLYPH.done}</Text>
              </Text>
              <Text dimColor wrap="truncate-end">
                {'  '}
                {leadText(lead)}
              </Text>
            </Box>
            {isEmpty && <Text dimColor>{s.empty}</Text>}
            {running.length > 0 && <Text dimColor>{s.running} · {running.length}</Text>}
            {running.map(row)}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed && finished.map(row)}
            {planned.length > 0 && <Text dimColor>{s.planned} · {planned.length}</Text>}
            {planned.map(pl => {
              const tier = pl.tier in TIER_COLOR ? pl.tier : 'other'
              return (
                <Box key={`plan-${pl.n}`} flexDirection="column" marginBottom={1}>
                  <Text dimColor wrap="truncate-end">
                    <Text color={colorOf(tier)}>▢</Text> {pl.n}. {pl.title} ◷
                  </Text>
                  <Text dimColor wrap="truncate-end">
                    {'  '}
                    {tierWord(tier)} · {tierModel(tier)}
                    {pl.after.length ? ` · ${s.after} ${pl.after.join(', ')}` : ''}
                  </Text>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const list = await read($, agents)
    // No flow reporting: the bar still shows with the Crab Office, counting the session's agents.
    const reported = await read($, flow)
    let f: Flow
    if (reported !== null) f = reported
    else {
      const p = await read($, panel)
      if (options.barAtStart === 'no' || p.isBarHidden) return next(e)
      const running = list.filter(a => a.status === 'running').length
      f = { title: tr().pane, total: list.length, done: list.length - running, running, phase: 'delegate', isFinished: false, tasks: [], isIdle: true }
    }
    // Draw this row with the other mods' bands beneath it. Claude Code's own placeholder ({ type: 'engine' }) is
    // never nested: the desktop drops a band that nests it.
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const below = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const crew = list.length + plannedOf(f, list).length
    const isWorking = list.some(a => a.status === 'running')
    const crewButton = (
      <Button key="savvy-agents" label={`×${crew}`} plain onPress={() => void togglePane($)} />
    )
    const percent = `${Math.round(ratio(f) * 100)}%`
    const dismiss = (
      <Button
        key="savvy-dismiss"
        label="✕"
        plain
        role="dismiss"
        onPress={() => (f.isIdle ? update($, panel, prev => ({ ...prev, isBarHidden: true })) : update($, flow, () => null))}
      />
    )

    // The terminal's element table is completed with an `Svg` that draws nothing: test the surface too.
    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      // About 8 CSS px per reported column; the rest is the count, the dismiss
      // and their gaps. No floor above the slot: a row wider than it would wrap.
      const width = Math.max(180, Math.min(1600, (e.props.bodyColumns || 100) * 8 - 96))
      return (
        <Box flexDirection="column">
          <Box flexDirection={isRtl() ? 'row-reverse' : 'row'} alignItems="center" gap={1}>
            <Svg source={rowSvg(f, width, isWorking)} alt={`${f.title}: ${label(f)}, ${percent}`} width={width} height={H} />
            {crewButton}
            {dismiss}
          </Box>
          {below}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    const titleW = Math.max(8, Math.min(30, f.title.length + 2, Math.floor(cols / 3)))
    const width = Math.max(6, Math.min(40, cols - titleW - 32))
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Box width={titleW} flexShrink={0}>
            <Text color={f.isFinished ? DONE : ACCENT}>● </Text>
            <Text wrap="truncate-end">{f.title}</Text>
          </Box>
          <Text color={f.isFinished ? DONE : ACCENT}>{barText(f, width)}</Text>
          <Text bold>{label(f)}</Text>
          <Text dimColor>{percent}</Text>
          <Text color={CLAY}>▣</Text>
          {crewButton}
          {dismiss}
        </Box>
        {below}
      </Box>
    )
  })
}
