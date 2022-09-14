import { intervalProducer, newSubject } from '../util/state/subject'
import CanvasBackground from './canvas-background'
import DebugInfo from './debug-info'
import FloatingPreferences from './floating-preferences'
import Overlay from './overlay'
import PauseIndicator from './pause-indicator'
import PreferencesRoot from './preferences'
import { createElement } from './utils'
import './main-styles.css'

interface Props {
	root: HTMLElement

	isPaused(): boolean

	onPauseRequested(): void

	onResumeRequested(): void
}

export const createUi = (props: Props) => {
	const root = createElement('div', props.root, 'root')

	const isPaused = intervalProducer(props.isPaused, 300)
	const [settingsOpened, setSettingsOpened] = newSubject(false)

	const canvas = CanvasBackground(root)

	Overlay(root, [isPaused, settingsOpened], () => setSettingsOpened(() => false))

	FloatingPreferences(root,
		() => setSettingsOpened(v => !v),
		props.onPauseRequested,
		props.onResumeRequested)

	DebugInfo(root)

	PauseIndicator(root, isPaused)

	PreferencesRoot(root, settingsOpened, () => setSettingsOpened(() => false))

	return {
		canvas,
	}
}

