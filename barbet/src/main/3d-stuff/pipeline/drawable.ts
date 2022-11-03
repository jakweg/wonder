import { GameState } from "../../game-state/game-state";
import { RenderContext } from "../render-context";
import { GpuAllocator } from "./allocator";
import RenderHelperWorkScheduler from "./work-scheduler";

export interface LoadParams {
    game: GameState
    scheduler: RenderHelperWorkScheduler
}

export interface Drawable<ShaderCache, WorldData, BoundData> {
    /** Called once when gpu is available */
    createShader(allocator: GpuAllocator, previous: ShaderCache | null): Promise<ShaderCache>;

    /** Called once whenever any property has changed
     * @returns {true} if shader cache should be invalidated
     */
    onConfigModified(previous: ShaderCache | null): boolean;

    /** Called once when game is available, 
     * has world lock */
    createWorld(params: LoadParams, previous: WorldData | null): WorldData;

    /** Called once after both gpu and game are available,
     *  has world lock */
    bindWorldData(allocator: GpuAllocator, shader: ShaderCache, world: WorldData, previous: BoundData | null): BoundData;

    /** Called before render every game tick, 
     * has world lock */
    updateWorld(shader: ShaderCache, world: WorldData, bound: BoundData): void

    /** Called before render every frame, 
     * has world lock */
    prepareRender(shader: ShaderCache, world: WorldData, bound: BoundData): void

    /** Called before render every frame, 
     * should only upload data to gpu, 
     * does NOT hold world lock */
    uploadToGpu(shader: ShaderCache, world: WorldData, bound: BoundData): void

    /** Called every frame, 
     * should only set uniforms and execute draw calls, 
     * does NOT hold world lock */
    draw(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void;

    /** Called each time when mouse picker action happens, 
     * should only set uniforms and execute draw calls,
     * does NOT hold world lock */
    drawForMousePicker(ctx: RenderContext, shader: ShaderCache, world: WorldData, bound: BoundData): void;
}
