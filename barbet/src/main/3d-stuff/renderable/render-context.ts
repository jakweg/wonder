import { Camera } from '../../camera'

export interface RenderContext {
	readonly gl: WebGL2RenderingContext
	readonly camera: Camera
	readonly sunCamera: Camera
	readonly secondsSinceFirstRender: number
	/**
	 * @deprecated use sumCamera.eye instead
	 */
	readonly sunPosition: vec3
}

export interface Renderable {
	render(ctx: RenderContext): void
}
