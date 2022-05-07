import { CreateGameArguments, FeedbackEvent, SaveGameArguments } from '../entry-points/feature-environments/loader'
import { createLocalSession } from './local'
import { createRemoteSession } from './remote'

export type Action =
	{ type: 'create-game', args: CreateGameArguments }
	| { type: 'save-game', args: SaveGameArguments }
	| { type: 'pause-game' }


export interface GameSession {
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
