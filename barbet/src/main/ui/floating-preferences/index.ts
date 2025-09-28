import { STANDARD_GAME_TICK_RATE } from '@game/state-updater'
import CONFIG from '@utils/persistence/observable-settings'
import { observeField, Subject } from '@utils/state/subject'
import { RestartIcon, SettingsIcon, TpsIcon } from '../icons'
import { Callback, createElement } from '../utils'
import './style.css'

export default (
  parent: HTMLElement,
  openSettingsClicked: Callback,
  pauseRequested: Callback,
  resumeRequested: Callback,
) => {
  const root = createElement('div', parent, '_css_floating-preferences')

  const icon = TpsIcon(root)
  icon['addEventListener']('click', () => CONFIG.set('other/tps', STANDARD_GAME_TICK_RATE))

  RangeInput(root, observeField(CONFIG, 'other/tps'), v => CONFIG.set('other/tps', v))

  ButtonsBar(root, openSettingsClicked, pauseRequested, resumeRequested)
}

const RangeInput = (parent: HTMLElement, value: Subject<number>, valueChanged: (value: number) => void) => {
  const input = createElement('input', parent, '_css_tps-selector') as HTMLInputElement
  input['type'] = 'range'
  input['min'] = '1'
  input['max'] = '200'
  input['step'] = '1'
  input['title'] = 'Speed of the simulation'

  value.on(value => (input['value'] = `${value}`))

  input.addEventListener('input', event => {
    const value = +(event['target'] as HTMLInputElement)['value']
    valueChanged(value)
  })
}

const ButtonWithIcon = (parent: HTMLElement, title: string, icon: typeof RestartIcon, onClick: Callback) => {
  const btn = createElement('button', parent) as HTMLButtonElement
  btn['type'] = 'button'
  btn['title'] = title

  icon(btn)

  btn.addEventListener('click', onClick)
}

const ButtonsBar = (
  parent: HTMLElement,
  openSettingsClicked: Callback,
  pauseRequested: Callback,
  resumeRequested: Callback,
) => {
  const bar = createElement('div', parent, '_css_buttons')

  ButtonWithIcon(bar, 'Restart', RestartIcon, pauseRequested)
  ButtonWithIcon(bar, 'Restart', RestartIcon, resumeRequested)
  ButtonWithIcon(bar, 'Settings', SettingsIcon, openSettingsClicked)
}
