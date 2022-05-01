export const defaultNetworkState = {
	'error': null as string | null,
	'status': 'none' as ('none' | 'connecting' | 'connected' | 'joined'),
	'myId': -1,
	'leaderId': -2,
	'joinedPlayerIds': [] as number[],
	'isRequestingWorld': false,
}

export type NetworkStateType = typeof defaultNetworkState


