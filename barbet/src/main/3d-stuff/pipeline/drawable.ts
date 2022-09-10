import { GameState } from "../../game-state/game-state";
import { RenderContext } from "../renderable/render-context";
import { GpuAllocator } from "./allocator";


export interface Drawable<ShaderCache, WorldData, BoundData> {
    /** Called once when gpu is available */
    createShader(allocator: GpuAllocator, previous: ShaderCache | null): Promise<ShaderCache>;

    /** Called once when game is available, 
     * has world lock */
    createWorld(game: GameState, previous: WorldData | null): WorldData;

    /** Called once after both gpu and game are available,
     *  has world lock */
    bindWorldData(allocator: GpuAllocator, shader: ShaderCache, world: WorldData): BoundData;

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
