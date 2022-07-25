interface CreateGameArguments {
    canvasProvider: () => HTMLCanvasElement
}


export interface GameSession {
    isMultiplayer(): boolean

    createNewGame(args: CreateGameArguments): Promise<void>

    resume(tps: number): void

    pause(): boolean

    isPaused(): boolean

    terminate(): void
}