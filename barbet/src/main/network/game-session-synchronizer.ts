export interface GameSessionSynchronizer {
	amILeader(): boolean

	terminate(): void
}

interface NetworkEnvironmentConfiguration {
}

export const createRemote = async (url: string): Promise<GameSessionSynchronizer> => {
	throw new Error('not implemented')
	return {
		amILeader(): boolean {
			return false
		},
		terminate() {
		}
	}
}

export const createLocal = async (config: NetworkEnvironmentConfiguration)
	: Promise<GameSessionSynchronizer> => {
	return {
		amILeader(): boolean {
			return true
		},
		terminate() {
		}
	}
}
