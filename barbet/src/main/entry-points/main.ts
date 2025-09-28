import { can, MemberPermissions } from '@seampan/room-snapshot'
import { sleep } from '@seampan/util'
import { initFrontendVariableAndRegisterToWindow } from '@utils/frontend-variables-updaters'
import { initKeyboardMappings } from '@utils/keyboard-mappings'
import CONFIG, {
  initSettingsFromLocalStorage,
  observeSetting,
  saveSettingsToLocalStorage,
} from '@utils/persistence/observable-settings'
import { addSaveCallback, registerSaveSettingsCallback } from '@utils/persistence/serializable-settings'
import IndexedState from '@utils/state/indexed-state'
import { GameSession } from '../game-session'
import { createLocalSession } from '../game-session/local'
import { createRemoteSession } from '../game-session/remote'
import { defaults, NetworkStateField } from '../network/state'
import { createUi } from '../ui/root'

initSettingsFromLocalStorage()
addSaveCallback(() => saveSettingsToLocalStorage())
registerSaveSettingsCallback()
initFrontendVariableAndRegisterToWindow()
initKeyboardMappings()

document['body'].classList['remove']('not-loaded-body')

let session: GameSession | null = null
const uiHandlers = createUi({
  root: document['body'],
  isPaused(): boolean {
    return session?.isPaused() === true
  },
  onPauseRequested() {
    session?.pause()
  },
  onResumeRequested() {
    session?.resume(CONFIG.get('other/tps'))
  },
})

const setupAutopause = () => {
  let shouldPauseOnBlur = false
  observeSetting('other/pause-on-blur', v => (shouldPauseOnBlur = v))
  let shouldResumeOnFocus = false
  window.addEventListener('blur', () => {
    shouldResumeOnFocus = shouldPauseOnBlur && session?.isMultiplayer() === false && session?.pause() === true
  })
  window.addEventListener('focus', () => {
    if (shouldResumeOnFocus && shouldPauseOnBlur && session?.isMultiplayer() === false)
      session?.resume(CONFIG.get('other/tps'))
  })
}
setupAutopause()

observeSetting('other/tps', tps => {
  if (session?.isPaused() === false) session.resume(tps)
})

observeSetting('rendering/antialias', () => setTimeout(() => session?.resetRendering(), 10))
observeSetting('rendering/power-preference', () => setTimeout(() => session?.resetRendering(), 10))

const waitForOtherPlayers = async (state: IndexedState<typeof defaults>, minCount: number) => {
  while (Object.keys(state.get(NetworkStateField.PlayersInRoom) ?? {}).length < minCount) await sleep(50)
}

const startRemote = async () => {
  const remote = (session = await createRemoteSession({
    canvasProvider: uiHandlers.canvas.recreate,
  }))

  await remote.connect('localhost:3719')

  await remote.joinRoom('default')

  CONFIG.observe('multiplayer/latency', v => remote.setRoomLatencyMilliseconds(v))

  await waitForOtherPlayers(remote.getState(), 1)

  const myRole = (remote.getState().get(NetworkStateField.PlayersInRoom) ?? {})[
    remote.getState().get(NetworkStateField.MyId) ?? ''
  ]?.['role']
  if (can(myRole, MemberPermissions.SendGameState)) {
    console['info']("I'm the owner, waiting for other players")

    await remote.createNewGame({})

    await waitForOtherPlayers(remote.getState(), 2)
    await remote.lockRoom(true)

    await sleep(100)

    remote.broadcastGameToOthers()
    console['info']('Game broadcasted')

    await sleep(1000)
    remote.listenForOperations()
    remote.resume(CONFIG.get('other/tps'))
  } else {
    console['info']("I'm not the owner, wait for map to be sent")

    await remote.waitForGameFromNetwork()
    remote.listenForOperations()
  }
}

const startLocal = async () => {
  const local = (session = await createLocalSession({
    canvasProvider: uiHandlers.canvas.recreate,
  }))

  await local.createNewGame({})
  local.getCurrentGame()?.renderDebugStats.observeEverything(uiHandlers.debug.updateRenderValues)
  local.getCurrentGame()?.updateDebugStats.observeEverything(uiHandlers.debug.updateUpdateValues)

  local.resume(CONFIG.get('other/tps'))
}

const initPageState = async () => {
  // startRemote()
  startLocal()
}

initPageState().then(() => void 0)
