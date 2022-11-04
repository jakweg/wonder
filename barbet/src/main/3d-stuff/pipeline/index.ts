import { GameState } from "../../game-state/game-state"
import ChunkVisibilityIndex from "../drawable/chunk-visibility"
import { RenderContext } from "../render-context"
import { GpuAllocator, newGpuAllocator } from "./allocator"
import { Drawable } from "./drawable"
import RenderHelperWorkScheduler from "./work-scheduler"

export const newPipeline = <ShaderGlobals>(
    newShaderGlobals: (allocator: GpuAllocator) => ShaderGlobals,
    elements: Drawable<ShaderGlobals, any, any, any>[]
) => {

    const mappedElements = elements.map(e => ({
        element: e,
        shader: null,
        world: null,
        bound: null,
    }))

    let isDoneWithShaders = false
    let allocator: GpuAllocator | null = null
    let shaderGlobals: ShaderGlobals | null = null
    let lastGame: GameState | null = null
    let lastRebuildTick: number = -1
    return {
        getGlobals(): ShaderGlobals {
            return shaderGlobals!
        },
        async useContext(gl: WebGL2RenderingContext): Promise<void> {
            isDoneWithShaders = false
            allocator?.cleanUp()

            allocator = newGpuAllocator(gl)
            shaderGlobals = newShaderGlobals(allocator)

            const pendingShaders = Promise['all'](elements.map((e, i) => e.createShader(allocator!, shaderGlobals!, null)))

            allocator.endProgramCompilationPhase()

            const doneShaders = await pendingShaders
            let i = 0
            for (const e of mappedElements)
                e.shader = doneShaders[i++]
            isDoneWithShaders = true
        },
        useGame(game: GameState, scheduler: RenderHelperWorkScheduler, visibility: ChunkVisibilityIndex) {
            if (lastGame === game) return
            lastGame = game
            lastRebuildTick = -1
            for (const e of mappedElements)
                e.world = e.element.createWorld({ game, scheduler, visibility }, e.world)
        },
        bindGpuWithGameIfCan() {
            if (allocator === null || lastGame === null || !isDoneWithShaders)
                return

            for (const e of mappedElements)
                e.bound = e.element.bindWorldData(allocator, e.shader, e.world, e.bound)
        },
        updateWorldIfNeeded() {
            const thisTick = lastGame?.currentTick ?? -1
            if (lastRebuildTick === thisTick)
                return
            lastRebuildTick = thisTick

            for (const e of mappedElements)
                e.element.updateWorld(e.shader, e.world, e.bound)
        },
        prepareRender() {
            for (const e of mappedElements)
                e.element.prepareRender(e.shader, e.world, e.bound)
        },
        doGpuUploads() {
            for (const e of mappedElements)
                e.element.uploadToGpu(e.shader, e.world, e.bound)
        },
        draw(ctx: RenderContext) {
            for (const e of mappedElements)
                e.element.draw(ctx, e.shader, e.world, e.bound)
        },
        drawForMousePicker(ctx: RenderContext) {
            for (const e of mappedElements)
                e.element.drawForMousePicker(ctx, e.shader, e.world, e.bound)
        },
        async notifyConfigChanged() {
            if (!allocator) return
            for (const e of mappedElements) {
                if (e.element.onConfigModified(e.shader)) {
                    e.shader = await e.element.createShader(allocator, shaderGlobals!, e.shader)
                    e.bound = e.element.bindWorldData(allocator, e.shader, e.world, e.bound)
                }
            }
        },
        cleanUp() {
            lastGame = null
            allocator?.cleanUp()
            allocator = null

            for (const e of mappedElements)
                e.bound = e.world = e.shader = null
        }
    }
}