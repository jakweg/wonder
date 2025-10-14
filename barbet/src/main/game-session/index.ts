import { CreateGameArguments, CreateGameResult } from '@entry/feature-environments/loader'

export type Operation = { type: 'start'; tps: number } | { type: 'pause' }

export interface GameSession {
  isMultiplayer(): boolean

  createNewGame(args: CreateGameArguments): Promise<void>

  resume(tps: number): void

  pause(): boolean

  isPaused(): boolean

  terminate(): void

  getCurrentGame(): CreateGameResult | null
}
