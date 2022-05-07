import { observableState } from '../util/state/observable'
import CanvasBackground from './canvas-background'
import FloatingPreferences from './floating-preferences'
import PreferencesRoot from './preferences'
import { createElement } from './utils'

interface Props {
	root: HTMLElement
	onPauseRequested(): void
}

export const createUi = (props: Props) => {
	const root = createElement('div', props.root, 'root')

	const [settingsOpened, setSettingsOpened] = observableState(false)

	const canvas = CanvasBackground(root)

	FloatingPreferences(root, () => setSettingsOpened(() => true), props.onPauseRequested)

	PreferencesRoot(root, settingsOpened, () => setSettingsOpened(() => false))

	return {
		canvas,
	}
}

