import KeyboardController from './keyboard-controller'
import CONFIG, { AntialiasMode } from './persistence/observable-settings'

const toggleSetting = (key: Parameters<(typeof CONFIG)['set']>[0]) => CONFIG.set(key, !CONFIG.get(key))

export const initKeyboardMappings = () => {
  let lastEnabledAntialiasMode: AntialiasMode = AntialiasMode.Fxaa
  KeyboardController.INSTANCE?.setKeyReleasedListener('F2', () => {
    const current = CONFIG.get('rendering/antialias-mode')
    if (current !== AntialiasMode.Off) {
      lastEnabledAntialiasMode = current
      CONFIG.set('rendering/antialias-mode', AntialiasMode.Off)
    } else {
      CONFIG.set('rendering/antialias-mode', lastEnabledAntialiasMode)
    }
  })
  KeyboardController.INSTANCE?.setKeyReleasedListener('F3', () => {
    toggleSetting('debug/show-info')
  })
  KeyboardController.INSTANCE?.setKeyReleasedListener('F4', () => {
    toggleSetting('debug/show-graphs')
  })
  KeyboardController.INSTANCE?.setKeyReleasedListener('F5', () => {
    toggleSetting('debug/disable-culling')
  })
}
