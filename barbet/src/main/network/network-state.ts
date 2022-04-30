export const defaultNetworkState = {
	'error': null as string | null,
	'connecting': false,
	'connected': false,
	'myID': -1,
	'leaderID': -2,
	'joinedPlayerIds': [] as number[],
	'isRequestingWorld': false,
}

export type NetworkStateType = typeof defaultNetworkState


