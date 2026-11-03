export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** Friendly name picked at spawn (Autumn's fork): stable per run, unique among running agents. */
  name?: string
  /** Costume and accent variant picked at spawn (Autumn's fork): no two running agents look identical. */
  costume?: string
  variant?: number
  /** The role the description names, as the roster keys it ("Contrarian"). */
  role?: string
  /** The roster slot: 0 the role's own crab, 1.. the siblings that run alongside it. */
  ordinal?: number
  /** The crab's prop: the held tool (artist) or charm that sets siblings apart. */
  prop?: number
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
  /** The worker's latest tool call in a few words ("Editing app.json"), for the office. */
  activity?: string
}

/** One crab of the persistent roster: a role's fixed name and look. */
export type RosterCrab = {
  role: string
  slot: number
  name: string
  costume: string
  variant: number
  prop: number
}

/** The lead, the main session: working through a turn, or waiting for you. */
export type Lead = {
  isWorking: boolean
  /** The main session's latest tool call in a few words ("Editing app.json"). */
  activity: string
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  autoOpenedFor: string
  /** The pane's view: the list of rows, or the pixel office. Absent in state saved before the office. */
  view?: 'list' | 'office'
}

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      now: number
      crabs: RosterCrab[]
      lead: Lead
    }
  }
}
