import { StateUpdater } from '../game-state/state-updater'
import { globalMutex } from '../worker/global-mutex'
import { setMessageHandler } from '../worker/message-handler'
import { WorkerController } from '../worker/worker-controller'

export interface GameSessionSynchronizer {
	amILeader(): boolean

	setControlledUpdater(updater: StateUpdater): void

	terminate(): void
}

interface NetworkEnvironmentConfiguration {
	connectToUrl: string
}

export const createRemote = async (config: NetworkEnvironmentConfiguration): Promise<GameSessionSynchronizer> => {
	const worker = await WorkerController.spawnNew('network-worker', 'network', globalMutex)
	worker.replier.send('connect-to', {url: config.connectToUrl, forceEncryption: false})

	let iAmLeader = false
	setMessageHandler('players-update', data => {
		iAmLeader = data.nowIAmLeader
	})

	await new Promise<void>((resolve, reject) => {
		setMessageHandler('server-connection-update', data => {
			if (data.connected)
				resolve()
			else
				reject('connection to server failed')
		})
	})
	return {
		amILeader(): boolean {
			return iAmLeader
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
		setControlledUpdater(updater: StateUpdater): void {

		},
		terminate() {
		},
	}
}
