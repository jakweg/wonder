import KeyboardController from './keyboard-controller'
import CONFIG from './persistence/observable-settings'

const toggleSetting = (key: Parameters<(typeof CONFIG)['set']>[0]) => CONFIG.set(key, !CONFIG.get(key))

export const initKeyboardMappings = () => {
  KeyboardController.INSTANCE?.setKeyReleasedListener('F2', () => {
    CONFIG.set('rendering/msaa-samples', CONFIG.get('rendering/msaa-samples') > 0 ? 0 : 4)
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
