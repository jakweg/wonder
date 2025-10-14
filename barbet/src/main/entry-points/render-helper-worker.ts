import { dispatch, Environment } from '@3d/pipeline/scheduler-tasks'
import { World } from '@game/world/world'
import { GameMutex, gameMutexFrom } from '@utils/game-mutex'
import { bind } from '@utils/new-worker/specs/render-helper'

let env: Environment | null = null
let mutex: GameMutex
let id: any

bind({
  setInitials({ mutex, id: gotId }) {
    mutex = gameMutexFrom(mutex)
    id = gotId
  },
  setWorld(received) {
    env = {
      world: World.fromReceived(received),
      mutexEnter: () => mutex!.enterForRenderHelper(id),
      mutexExit: () => mutex!.exitRenderHelper(id),
    }
  },
  executeTask(task) {
    if (!env) throw new Error()

    return dispatch(env, task)
  },
})
