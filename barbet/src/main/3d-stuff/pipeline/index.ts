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

    let allocator: GpuAllocator | null = null
    return {
        async useContext(gl: WebGL2RenderingContext): Promise<void> {
            if (allocator !== null)
                throw new Error()

            allocator = newGpuAllocator(gl)

            const pendingShaders = Promise['all'](elements.map((e, i) => e.createShader(allocator!, shaderStorage[i])))

            allocator.endProgramCompilationPhase()

            const doneShaders = await pendingShaders
            for (let i = 0; i < elementsCount; i++)
                shaderStorage[i] = doneShaders[i]
        },
        useGame(game: GameState) {
            for (let i = 0; i < elementsCount; i++)
                worldStorage[i] = elements[i]!.createWorld(game, worldStorage[i])
        },
        bindGpuWithGame() {
            if (allocator === null)
                throw new Error()

            for (let i = 0; i < elementsCount; i++)
                boundStorage[i] = elements[i]!.bindWorldData(allocator, shaderStorage[i], worldStorage[i])
        },
        updateWorld() {
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
    }
}