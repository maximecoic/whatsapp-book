import { describe, expect, it } from 'vitest'
import {
  createSettingsHistory,
  settingsHistoryReducer,
} from './settings-history'

describe('settings history', () => {
  it('undoes and redoes committed values', () => {
    let history = createSettingsHistory({ title: 'Avant' })
    history = settingsHistoryReducer(history, {
      type: 'commit',
      update: { title: 'Après' },
    })
    history = settingsHistoryReducer(history, { type: 'undo' })
    expect(history.present.title).toBe('Avant')
    history = settingsHistoryReducer(history, { type: 'redo' })
    expect(history.present.title).toBe('Après')
  })

  it('coalesces rapid edits sharing a history key', () => {
    let history = createSettingsHistory({ title: '' })
    history = settingsHistoryReducer(history, {
      type: 'commit',
      update: { title: 'C' },
      historyKey: 'title',
      at: 100,
    })
    history = settingsHistoryReducer(history, {
      type: 'commit',
      update: { title: 'Chatbound' },
      historyKey: 'title',
      at: 500,
    })

    expect(history.past).toHaveLength(1)
    history = settingsHistoryReducer(history, { type: 'undo' })
    expect(history.present.title).toBe('')
  })

  it('clears history when replacing a restored project', () => {
    let history = createSettingsHistory({ title: 'Initial' })
    history = settingsHistoryReducer(history, {
      type: 'commit',
      update: { title: 'Modifié' },
    })
    history = settingsHistoryReducer(history, {
      type: 'replace',
      value: { title: 'Restauré' },
    })

    expect(history).toMatchObject({
      present: { title: 'Restauré' },
      past: [],
      future: [],
    })
  })
})