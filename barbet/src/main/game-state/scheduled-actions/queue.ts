import { GameState } from '@game'
import { execute, ScheduledAction } from './'

export interface ActionsQueue {
  append(action: ScheduledAction): void
}

export class SendActionsQueue implements ActionsQueue {
  private constructor(private readonly transporter: (a: ScheduledAction) => void) {}

  public static create(transporter: (a: ScheduledAction) => void): SendActionsQueue {
    return new SendActionsQueue(transporter)
  }

  public append(action: ScheduledAction): void {
    this.transporter(action)
  }
}

export class ReceiveActionsQueue implements ActionsQueue {
  private constructor(private readonly actionsToExecute: ScheduledAction[]) {}

  public static create(): ReceiveActionsQueue {
    return new ReceiveActionsQueue([])
  }

  public append(action: ScheduledAction): void {
    this.actionsToExecute.push(action)
  }

  public executeAllUntilEmpty(game: GameState): void {
    const list = this.actionsToExecute

    // list.length may change during execution of this loop, do not cache it
    for (let i = 0; i < list.length; i++) execute(list[i]!, game)

    list.splice(0)
  }
}

export class ForwardActionsQueue implements ActionsQueue {
  private constructor(private readonly destination: ActionsQueue) {}
  public static create(destination: ActionsQueue): ForwardActionsQueue {
    return new ForwardActionsQueue(destination)
  }

  append(action: ScheduledAction) {
    this.destination.append(action)
  }
}
