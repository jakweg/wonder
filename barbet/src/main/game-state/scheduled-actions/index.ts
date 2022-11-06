import { GameState } from '../game-state'
import * as DebugCreateBuildingPrototype from './executors/debug-commands/create-building-prototype'
import * as MouseClick from './executors/mouse-click'

export const enum ScheduledActionId {
  MouseClick,
  DebugCreateBuildingPrototype,
}

export type ScheduledAction = MouseClick.Action | DebugCreateBuildingPrototype.Action

const executors = [MouseClick.execute, DebugCreateBuildingPrototype.execute]

export const execute = (action: ScheduledAction, game: GameState) => {
  const func = executors[action.type]
  if (func === undefined) throw new Error()
  func(action as any, game)
}
