import { GameState } from "../../game-state/game-state"
import { RenderContext } from "../renderable/render-context"
import { GpuAllocator, newGpuAllocator } from "./allocator"
import { Drawable } from "./drawable"

export const newPipeline = (
    elements: Drawable<any, any, any>[]
) => {

    const elementsCount = elements.length
    const shaderStorage = new Array(elementsCount)
    shaderStorage.fill(null)

    const worldStorage = new Array(elementsCount)
    worldStorage.fill(null)

    const boundStorage = new Array(elementsCount)
    boundStorage.fill(null)

    let isDoneWithShaders = false
    let allocator: GpuAllocator | null = null
    let lastGame: GameState | null = null
    let lastRebuildTick: number = -1
    return {
        async useContext(gl: WebGL2RenderingContext): Promise<void> {
            isDoneWithShaders = false
            allocator?.cleanUp()

            allocator = newGpuAllocator(gl)

            const pendingShaders = Promise['all'](elements.map((e, i) => e.createShader(allocator!, null)))

            allocator.endProgramCompilationPhase()

            const doneShaders = await pendingShaders
            for (let i = 0; i < elementsCount; i++)
                shaderStorage[i] = doneShaders[i]
            isDoneWithShaders = true
        },
        useGame(game: GameState) {
            if (lastGame === game) return
            lastGame = game
            lastRebuildTick = -1
            for (let i = 0; i < elementsCount; i++)
                worldStorage[i] = elements[i]!.createWorld(game, worldStorage[i])
        },
        bindGpuWithGameIfCan() {
            if (allocator === null || lastGame === null || !isDoneWithShaders)
                return

            for (let i = 0; i < elementsCount; i++)
                boundStorage[i] = elements[i]!.bindWorldData(allocator, shaderStorage[i], worldStorage[i], boundStorage[i])
        },
        updateWorldIfNeeded() {
            const thisTick = lastGame?.currentTick ?? -1
            if (lastRebuildTick === thisTick)
                return
            lastRebuildTick = thisTick
            for (let i = 0; i < elementsCount; i++)
                elements[i]!.updateWorld(shaderStorage[i], worldStorage[i], boundStorage[i])
        },
        prepareRender() {
            for (let i = 0; i < elementsCount; i++)
                elements[i]!.prepareRender(shaderStorage[i], worldStorage[i], boundStorage[i])
        },
        doGpuUploads() {
            for (let i = 0; i < elementsCount; i++)
                elements[i]!.uploadToGpu(shaderStorage[i], worldStorage[i], boundStorage[i])
        },
        draw(ctx: RenderContext) {
            for (let i = 0; i < elementsCount; i++)
                elements[i]!.draw(ctx, shaderStorage[i], worldStorage[i], boundStorage[i])
        },
        drawForMousePicker(ctx: RenderContext) {
            for (let i = 0; i < elementsCount; i++)
                elements[i]!.drawForMousePicker(ctx, shaderStorage[i], worldStorage[i], boundStorage[i])
        },
        async notifyConfigChanged() {
            if (!allocator) return
            for (let i = 0; i < elementsCount; i++) {
                if (elements[i]!.onConfigModified(shaderStorage[i])) {
                    shaderStorage[i] = await elements[i]!.createShader(allocator, shaderStorage[i])
                    boundStorage[i] = elements[i]!.bindWorldData(allocator, shaderStorage[i], worldStorage[i], boundStorage[i])
                }
            }
        },
        cleanUp() {
            lastGame = null
            allocator?.cleanUp()
            allocator = null

            shaderStorage.fill(null)
            worldStorage.fill(null)
            boundStorage.fill(null)
        }
    }
}