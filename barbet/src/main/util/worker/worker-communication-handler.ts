import {
	CreateGameArguments,
	FeedbackEvent,
	SaveGameArguments,
	TerminateGameArguments,
} from '../../entry-points/feature-environments/loader'
import { ScheduledAction } from '../../game-state/scheduled-actions'
import { ReceivedGameLayerMessage } from '../../network/message'
import { NetworkStateType } from '../../network/network-state'
import { TickQueueAction } from '../../network/tick-queue-action'
import { NetworkWorkerDispatchAction } from './network-worker-dispatch-action'

export interface Message {
	['error']: { message: string }
	['connection-established']: { now: number }
	['set-global-mutex']: { mutex: unknown }
	['create-game']: CreateGameArguments
	['set-worker-load-delays']: { update: number, render: number }
	['game-snapshot-for-renderer']: { game: unknown, updater: unknown }
	['transfer-canvas']: { canvas: unknown }
	['frontend-variables']: { buffer: SharedArrayBuffer }
	['update-entity-container']: { buffers: SharedArrayBuffer[] }
	['camera-buffer']: { buffer: SharedArrayBuffer }
	['new-settings']: any
	['save-game']: SaveGameArguments
	['terminate-game']: TerminateGameArguments
	['feedback']: FeedbackEvent
	['scheduled-action']: ScheduledAction
	['append-to-tick-queue']: { actions: TickQueueAction[], playerId: number, forTick: number }
	['network-worker-dispatch-action']: NetworkWorkerDispatchAction
	['network-message-received']: ReceivedGameLayerMessage<any>
	['network-state']: NetworkStateType
}

export type MessageType = keyof Message

export interface CombinedMessage<T extends MessageType> {
	type: T
	extra: Message[T]
}

export interface MessageSender {
	send<T extends MessageType>(type: T, extra: Message[T], transferable?: Transferable[]): void
}

export interface MessageReceiver {
	listen<T extends MessageType>(type: T, callback: (data: Message[T]) => void): void
}

export const createMessageHandler = (connection: MessageSender): [(e: MessageEvent) => void, MessageReceiver] => {
	const messageHandlers: { [key in MessageType]?: any } = {}

	return [
		(e: MessageEvent) => {
			const data = e['data'] as CombinedMessage<MessageType>
			const type = data.type
			const extra = data.extra

			const callback = messageHandlers[type]
			if (callback === undefined) {
				if (type !== 'error') {
					const msg = `Unknown message type ${type}`
					console.error(msg, data)
					connection.send('error', {'message': msg})
				}
			} else {
				callback(extra)
			}
		}, {
			listen<T extends MessageType>(type: T, callback: (data: Message[T], connection: MessageSender) => void) {
				if (messageHandlers[type as MessageType] !== undefined)
					throw new Error(`Reassign handler ${type}`)
				messageHandlers[type as MessageType] = callback
			},
		}]
}
