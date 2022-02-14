import { toGl } from '../../util/matrix/common'
import * as  mat4 from '../../util/matrix/mat4'
import { MainRenderer } from '../main-renderer'
import { createProgramFromNewShaders } from '../shader/common'
import { World } from '../world/world'
import { convertWorldToMesh } from '../world/world-to-mesh-converter'
import { RenderContext } from './render-context'
import {
	Attributes,
	fragmentShaderSource,
	fragmentShaderSource2,
	Uniforms,
	vertexShaderSource,
	vertexShaderSource2,
} from './terrain-shaders'

export const createNewTerrainRenderable = (renderer: MainRenderer,
                                           world: World) => {
	const gl = renderer.rawContext
	const program = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource, fragmentShaderSource)
	const vao = renderer.createVAO()
	vao.bind()

	const mesh = convertWorldToMesh(world)

	const vertexBuffer = renderer.createBuffer(true, false)
	vertexBuffer.setContent(mesh.vertexes)

	const floatSize = Float32Array.BYTES_PER_ELEMENT
	const stride = 7 * floatSize

	program.enableAttribute(program.attributes.position, 3, true, stride, 0, 0)
	program.enableAttribute(program.attributes.color, 3, true, stride, 3 * floatSize, 0)
	program.enableAttribute(program.attributes.flags, 1, true, stride, 6 * floatSize, 0)


	const indicesBuffer = renderer.createBuffer(false, false)
	indicesBuffer.setContent(mesh.indices)

	const trianglesToRender = (mesh.indices.byteLength / mesh.indices.BYTES_PER_ELEMENT) | 0


	gl.bindVertexArray(null)
	const vao2 = renderer.createVAO()
	vao2.bind()

	const program2 = createProgramFromNewShaders<Attributes, Uniforms>(renderer, vertexShaderSource2, fragmentShaderSource2)
	vertexBuffer.bind()
	indicesBuffer.bind()
	program2.enableAttribute(program.attributes.position, 3, true, stride, 0, 0)
	program2.enableAttribute(program.attributes.color, 3, true, stride, 3 * floatSize, 0)

	const targetTextureWidth = 8192
	const targetTextureHeight = targetTextureWidth

	const depthTexture = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, depthTexture)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F,
		targetTextureWidth, targetTextureHeight, 0,
		gl.DEPTH_COMPONENT, gl.FLOAT, null)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

	const fb = gl.createFramebuffer()
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb)

	// gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0)
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0)
	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		console.error('invalid framebuffer status')
	}
	gl.bindTexture(gl.TEXTURE_2D, null)

	gl.bindVertexArray(null)

	return {
		renderDepth(ctx: RenderContext) {
			const {gl, sunCamera} = ctx
			vao2.bind()
			program2.use()
			gl.cullFace(gl.FRONT)
			gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
			gl.enable(gl.DEPTH_TEST)
			gl.viewport(0, 0, targetTextureWidth, targetTextureHeight)
			gl.clear(gl.DEPTH_BUFFER_BIT)

			gl.uniformMatrix4fv(program2.uniforms.projection, false, toGl(sunCamera.perspectiveMatrix))
			gl.uniformMatrix4fv(program2.uniforms.view, false, toGl(sunCamera.viewMatrix))
			gl.uniform1f(program2.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program2.uniforms.lightPosition, toGl(ctx.sunCamera.eye))

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
			gl.bindFramebuffer(gl.FRAMEBUFFER, null)
			// gl.bindTexture(gl.TEXTURE_2D, null)
			gl.bindVertexArray(null)
		},
		render(ctx: RenderContext) {
			// return
			const {gl, camera} = ctx
			gl.bindFramebuffer(gl.FRAMEBUFFER, null)
			gl.viewport(0, 0, 1280, 720)
			vao.bind()
			gl.cullFace(gl.BACK)
			program.use()

			const lightSpaceMatrix = mat4.multiply(mat4.create(), ctx.sunCamera.perspectiveMatrix, ctx.sunCamera.viewMatrix)

			gl.activeTexture(gl.TEXTURE0)
			gl.bindTexture(gl.TEXTURE_2D, depthTexture)
			gl.uniform1i(program.uniforms.shadowMap, 0)

			gl.uniformMatrix4fv(program.uniforms.lightSpaceMatrix, false, toGl(lightSpaceMatrix))
			gl.uniformMatrix4fv(program.uniforms.projection, false, toGl(camera.perspectiveMatrix))
			gl.uniformMatrix4fv(program.uniforms.view, false, toGl(camera.viewMatrix))
			gl.uniform1f(program.uniforms.time, ctx.secondsSinceFirstRender)
			gl.uniform3fv(program.uniforms.lightPosition, toGl(ctx.sunCamera.eye))

			gl.drawElements(gl.TRIANGLES, trianglesToRender, gl.UNSIGNED_INT, 0)
			gl.bindVertexArray(null)
		},
	}
}
