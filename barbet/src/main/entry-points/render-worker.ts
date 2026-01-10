import { createRenderingSession } from '@3d/new-render-context'
import { GameMutex, gameMutexFrom } from '@utils/game-mutex'
import { bind } from '@utils/new-worker/specs/render'
import CONFIG from '@utils/persistence/observable-settings'

let mutex: GameMutex
let session: Awaited<ReturnType<typeof createRenderingSession>> | null = null

const functions = bind({
  setGameMutex(data) {
    mutex = gameMutexFrom(data)
  },
  setNewSettings(settings) {
    CONFIG.update(settings)
  },
  terminateGame(args) {
    session?.terminate()
    if (args.terminateEverything) close()
  },
  setUpdateTimesBuffer({ buffer }) {
    return // TODO find out what is going on
    // session.stats.updateTimesBuffer = buffer
  },
  async startRenderingSession(args) {
    session = await createRenderingSession(args)
  },
})

//   const  = SendActionsQueue.create(action => functions.scheduleAction(action))

//   let timeoutId: ReturnType<typeof setTimeout>
//   CONFIG.observe('debug/show-info', show => {
//     if (show) {
//       session.stats.receiveUpdates(data => {
//         clearTimeout(timeoutId)
//         timeoutId = setTimeout(() => void functions.updateDebugStats(data), 0)
//       })
//     } else session.stats.stopUpdates()
//   })
