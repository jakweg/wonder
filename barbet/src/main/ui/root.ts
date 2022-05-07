import { observableState, observeProducer } from '../util/state/observable'
import CanvasBackground from './canvas-background'
import FloatingPreferences from './floating-preferences'
import Overlay from './overlay'
import PauseIndicator from './pause-indicator'
import PreferencesRoot from './preferences'
import { createElement } from './utils'

interface Props {
	root: HTMLElement

	isPaused(): boolean

	onPauseRequested(): void

	onResumeRequested(): void
}

export const createUi = (props: Props) => {
	const root = createElement('div', props.root, 'root')

	const isPaused = observeProducer(props.isPaused, 250)
	const [settingsOpened, setSettingsOpened] = observableState(false)

	const canvas = CanvasBackground(root)

	Overlay(root, [isPaused, settingsOpened], () => setSettingsOpened(() => false))

	FloatingPreferences(root,
		() => setSettingsOpened(v => !v),
		props.onPauseRequested,
		props.onResumeRequested)

	PauseIndicator(root, isPaused)

	PreferencesRoot(root, settingsOpened, () => setSettingsOpened(() => false))

	return {
		canvas,
	}
}

