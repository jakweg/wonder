import { CreateGameArguments, FeedbackEvent } from '../entry-points/feature-environments/loader'
import { SaveGameArguments } from '../game-state/world/world-saver'
import { createLocalSession } from './local'
import { createRemoteSession } from './remote'

export type Action =
	{ type: 'create-game', args: CreateGameArguments }
	| { type: 'save-game', args: SaveGameArguments }
	| { type: 'pause-game' }
	| { type: 'resume-game' }


export interface GameSession {
	isPaused(): boolean

	resetRendering(): void

	dispatchAction(action: Action): void

	terminate(): void
}


export interface GenericSessionProps {
	feedbackCallback: (event: FeedbackEvent) => void

	canvasProvider: () => HTMLCanvasElement
}

export {
	createLocalSession,
	createRemoteSession,
}
