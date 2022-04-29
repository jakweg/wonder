import { StateUpdater } from '../game-state/state-updater'
import { globalMutex } from '../worker/global-mutex'
import { setMessageHandler } from '../worker/message-handler'
import { WorkerController } from '../worker/worker-controller'

export interface GameSessionSynchronizer {
	amILeader(): boolean

	setControlledUpdater(updater: StateUpdater): void

	gameSnapshotCompleted(value: string): void

	terminate(): void
}


type NetworkEvent =
	{ type: 'connection-closed' }
	| { type: 'game-state-request' }
	| { type: 'game-state-received', value: string }

interface NetworkEnvironmentConfiguration {
	connectToUrl: string

	eventCallback: (event: NetworkEvent) => void
}

export const createRemote = async (config: NetworkEnvironmentConfiguration): Promise<GameSessionSynchronizer> => {
	const worker = await WorkerController.spawnNew('network-worker', 'network', globalMutex)
	worker.replier.send('connect-to', {url: config.connectToUrl, forceEncryption: false})

	let iAmLeader = false
	setMessageHandler('players-update', data => {
		iAmLeader = data.nowIAmLeader
	})

	setMessageHandler('game-state-request', () => {
		config.eventCallback({type: 'game-state-request'})
	})

	setMessageHandler('network-message-received', message => {
		switch (message.type) {
			case 'game-snapshot':
				config.eventCallback({type: 'game-state-received', value: message.extra.gameState})
				break
			default:
				console.error('Invalid message', message.type)
		}
	})

	let wasConnected: boolean = false
	await new Promise<void>((resolve, reject) => {
		setMessageHandler('server-connection-update', data => {
			if (!wasConnected) {
				if (data.connected)
					resolve()
				else
					reject('connection to server failed')
			} else config.eventCallback({type: 'connection-closed'})

			wasConnected = true
		})
	})
	return {
		amILeader(): boolean {
			return iAmLeader
		},
		gameSnapshotCompleted(value: string) {
			worker.replier.send('game-state-request', {gameState: value})
		},
		setControlledUpdater(updater: StateUpdater): void {
		},
		terminate() {
			worker.terminate()
		},
	}
}

export const createLocal = async (config: {})
	: Promise<GameSessionSynchronizer> => {
	return {
		amILeader(): boolean {
			return true
		},
		gameSnapshotCompleted(value: string) {
		},
		setControlledUpdater(updater: StateUpdater): void {
		},
		terminate() {
		},
	}
}
