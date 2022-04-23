import { GameState } from '../game-state'
import { execute, ScheduledAction } from './'

export interface ActionsQueue {
	append(action: ScheduledAction): void
}

export class SendActionsQueue implements ActionsQueue {
	private constructor(private readonly transporter: (a: ScheduledAction) => void) {
	}

	public static create(transporter: (a: ScheduledAction) => void): SendActionsQueue {
		return new SendActionsQueue(transporter)
	}

	public append(action: ScheduledAction): void {
		this.transporter(action)
	}
}


export class ReceiveActionsQueue implements ActionsQueue {
	private constructor(
		private readonly actionsToExecute: ScheduledAction[],
	) {
	}

	public static create(): ReceiveActionsQueue {
		return new ReceiveActionsQueue([])
	}

	public append(action: ScheduledAction): void {
		this.actionsToExecute.push(action)
	}

	public executeAll(game: GameState): void {
		const list = this.actionsToExecute
		const length = list.length

		for (let i = 0; i < length; i++)
			execute(list[i]!, game)

		list.splice(0, length)
	}
}
