import { Camera } from '../../camera'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
	readonly gameTickEstimation: number
	readonly secondsSinceFirstRender: number
	readonly sunPosition: vec3
}

export interface Renderable {
	render(ctx: RenderContext): void
}
