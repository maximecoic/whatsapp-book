const HISTORY_LIMIT = 100
const COALESCE_WINDOW_MS = 800

export interface SettingsHistory<State> {
  past: State[]
  present: State
  future: State[]
  lastHistoryKey: string | null
  lastCommitAt: number
}

export type SettingsHistoryAction<State> =
  | {
    type: 'commit'
    update: State | ((current: State) => State)
    historyKey?: string
    at?: number
  }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; value: State }

export function createSettingsHistory<State>(
  initialState: State,
): SettingsHistory<State> {
  return {
    past: [],
    present: initialState,
    future: [],
    lastHistoryKey: null,
    lastCommitAt: 0,
  }
}

export function settingsHistoryReducer<State>(
  state: SettingsHistory<State>,
  action: SettingsHistoryAction<State>,
): SettingsHistory<State> {
  if (action.type === 'replace') return createSettingsHistory(action.value)

  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    if (previous === undefined) return state
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
      lastHistoryKey: null,
      lastCommitAt: 0,
    }
  }

  if (action.type === 'redo') {
    const next = state.future[0]
    if (next === undefined) return state
    return {
      past: [...state.past, state.present].slice(-HISTORY_LIMIT),
      present: next,
      future: state.future.slice(1),
      lastHistoryKey: null,
      lastCommitAt: 0,
    }
  }

  const next = typeof action.update === 'function'
    ? (action.update as (current: State) => State)(state.present)
    : action.update
  if (Object.is(next, state.present)) return state

  const committedAt = action.at ?? Date.now()
  const coalesces = Boolean(
    action.historyKey &&
    action.historyKey === state.lastHistoryKey &&
    committedAt - state.lastCommitAt <= COALESCE_WINDOW_MS &&
    state.future.length === 0,
  )

  return {
    past: coalesces
      ? state.past
      : [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastHistoryKey: action.historyKey ?? null,
    lastCommitAt: committedAt,
  }
}