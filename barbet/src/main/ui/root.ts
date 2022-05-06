import { observableState } from '../util/state/observable'
import CanvasBackground from './canvas-background'
import FloatingPreferences from './floating-preferences'
import PreferencesRoot from './preferences'
import { createElement } from './utils'

export const createUi = (parent: HTMLElement) => {
	const root = createElement('div', parent, 'root')

	const [settingsOpened, setSettingsOpened] = observableState(false)

	const canvas = CanvasBackground(root)

	FloatingPreferences(root, () => setSettingsOpened(() => true))

	PreferencesRoot(root, settingsOpened)

	return {
		canvas,
	}
}

