import { AsyncEntityIdReader } from '@3d/pipeline/async-entity-id-reader'
import { createNewMouseInterpreter } from '@3d/pipeline/mouse-interpreter'
import { TextureSlot } from '@3d/texture-slot-counter'
import { TerrainHeightReader } from '@3d/world-terrain-snapshot'
import { DEBUG } from '@build'
import { sleep } from '@seampan/util'
import { AdditionalFrontedFlags, FrontendVariable } from '@utils/frontend-variables'
import CONFIG, { AntialiasMode, observeSetting } from '@utils/persistence/observable-settings'
import { UICanvas } from 'src/main/ui/canvas-background'
import { Camera } from '../camera'

const obtainWebGl2ContextFromCanvas = (canvas: HTMLCanvasElement | OffscreenCanvas): WebGL2RenderingContext => {
  const context = canvas.getContext('webgl2', {
    'alpha': false,
    'antialias': false,
    'depth': true,
    'stencil': false,
    'failIfMajorPerformanceCaveat': true,
    'powerPreference': CONFIG.get('rendering/power-preference'),
  }) as WebGL2RenderingContext
  if (context == null) throw new Error('Unable to obtain context')
  return context
}

const obtainRendererNameFromContext = (gl: WebGL2RenderingContext | undefined): string | null => {
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info') as any
    if (ext) {
      const value = gl.getParameter(ext['UNMASKED_RENDERER_WEBGL'])
      if (value) return `${value}`
    }
  }
  return null
}

interface RenderingState {
  resolveFbo: WebGLFramebuffer
  colorTexture: WebGLTexture
  entityIdTexture: WebGLTexture
  depthBuffer: WebGLRenderbuffer

  supportedMsaaSamples: readonly number[]
  msaaFbo: WebGLFramebuffer | null
  msaaColorBuffer: WebGLRenderbuffer | null
  msaaDepthBuffer: WebGLRenderbuffer | null

  fullscreenProgram: WebGLProgram
  screenTextureUniform: WebGLUniformLocation

  fxaaProgram: WebGLProgram
  fxaaScreenTextureUniform: WebGLUniformLocation
  fxaaInverseScreenSizeUniform: WebGLUniformLocation
}

const FULLSCREEN_VS = `#version 300 es
out vec2 v_uv;
void main() {
  float u = float((gl_VertexID << 1) & 2);
  float v = float(gl_VertexID & 2);
  v_uv = vec2(u, v);
  gl_Position = vec4(u * 2.0 - 1.0, v * 2.0 - 1.0, 0.0, 1.0);
}`

const PASSTHROUGH_FS = `#version 300 es
precision mediump float;
uniform sampler2D u_screenTexture;
in vec2 v_uv;
out vec4 outColor;
void main() {
  outColor = texture(u_screenTexture, v_uv);
}`

// FXAA 3.11 Quality (variable-step edge search + 3x3 subpixel filter)
const FXAA_FS = `#version 300 es
precision highp float;

uniform sampler2D u_screenTexture;
uniform vec2 u_inverseScreenSize;
in vec2 v_uv;
out vec4 outColor;

const float EDGE_THRESHOLD_MIN = 0.0312;
const float EDGE_THRESHOLD_MAX = 0.125;
const float SUBPIXEL_QUALITY = 0.75;
const float STEP_SIZES[11] = float[11](1.0, 1.0, 1.0, 1.5, 2.0, 2.0, 2.0, 2.0, 2.0, 4.0, 8.0);

float rgb2luma(vec3 rgb) {
  return dot(rgb, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec3 rgbM = texture(u_screenTexture, v_uv).rgb;
  float lumaM = rgb2luma(rgbM);

  float lumaN = rgb2luma(textureOffset(u_screenTexture, v_uv, ivec2(0, 1)).rgb);
  float lumaS = rgb2luma(textureOffset(u_screenTexture, v_uv, ivec2(0, -1)).rgb);
  float lumaE = rgb2luma(textureOffset(u_screenTexture, v_uv, ivec2(1, 0)).rgb);
  float lumaW = rgb2luma(textureOffset(u_screenTexture, v_uv, ivec2(-1, 0)).rgb);

  float lumaMin = min(lumaM, min(min(lumaN, lumaS), min(lumaE, lumaW)));
  float lumaMax = max(lumaM, max(max(lumaN, lumaS), max(lumaE, lumaW)));
  float lumaRange = lumaMax - lumaMin;

  if (lumaRange < max(EDGE_THRESHOLD_MIN, lumaMax * EDGE_THRESHOLD_MAX)) {
    outColor = vec4(rgbM, 1.0);
    return;
  }

  float lumaNW = rgb2luma(textureOffset(u_screenTexture, v_uv, ivec2(-1, 1)).rgb);
  float lumaNE = rgb2luma(textureOffset(u_screenTexture, v_uv, ivec2(1, 1)).rgb);
  float lumaSW = rgb2luma(textureOffset(u_screenTexture, v_uv, ivec2(-1, -1)).rgb);
  float lumaSE = rgb2luma(textureOffset(u_screenTexture, v_uv, ivec2(1, -1)).rgb);

  float lumaNS = lumaN + lumaS;
  float lumaWE = lumaW + lumaE;
  float lumaNWSW = lumaNW + lumaSW;
  float lumaNESE = lumaNE + lumaSE;

  float edgeHorizontal =
    abs(-2.0 * lumaW + lumaNWSW) + abs(-2.0 * lumaM + lumaNS) * 2.0 + abs(-2.0 * lumaE + lumaNESE);
  float edgeVertical =
    abs(-2.0 * lumaN + lumaNW + lumaNE) + abs(-2.0 * lumaM + lumaWE) * 2.0 + abs(-2.0 * lumaS + lumaSW + lumaSE);
  bool isHorizontal = edgeHorizontal >= edgeVertical;

  float luma1 = isHorizontal ? lumaS : lumaW;
  float luma2 = isHorizontal ? lumaN : lumaE;
  float gradient1 = abs(luma1 - lumaM);
  float gradient2 = abs(luma2 - lumaM);
  bool is1Steepest = gradient1 >= gradient2;

  float gradientScaled = 0.25 * max(gradient1, gradient2);
  float stepLength = (isHorizontal ? u_inverseScreenSize.y : u_inverseScreenSize.x) * (is1Steepest ? -1.0 : 1.0);
  float lumaLocalAverage = 0.5 * ((is1Steepest ? luma1 : luma2) + lumaM);

  vec2 stepNormal = isHorizontal ? vec2(0.0, stepLength) : vec2(stepLength, 0.0);
  vec2 currentUv = v_uv + stepNormal * 0.5;
  vec2 edgeOffset = isHorizontal ? vec2(u_inverseScreenSize.x, 0.0) : vec2(0.0, u_inverseScreenSize.y);

  vec2 uv1 = currentUv - edgeOffset;
  vec2 uv2 = currentUv + edgeOffset;
  float lumaEnd1 = 0.0;
  float lumaEnd2 = 0.0;
  bool reached1 = false;
  bool reached2 = false;

  for (int i = 0; i < 11; ++i) {
    if (!reached1) {
      lumaEnd1 = rgb2luma(texture(u_screenTexture, uv1).rgb) - lumaLocalAverage;
      reached1 = abs(lumaEnd1) >= gradientScaled;
    }
    if (!reached2) {
      lumaEnd2 = rgb2luma(texture(u_screenTexture, uv2).rgb) - lumaLocalAverage;
      reached2 = abs(lumaEnd2) >= gradientScaled;
    }
    if (reached1 && reached2) break;
    if (!reached1) uv1 -= edgeOffset * STEP_SIZES[i];
    if (!reached2) uv2 += edgeOffset * STEP_SIZES[i];
  }

  float distance1 = isHorizontal ? (v_uv.x - uv1.x) : (v_uv.y - uv1.y);
  float distance2 = isHorizontal ? (uv2.x - v_uv.x) : (uv2.y - v_uv.y);
  float pixelOffset = 0.5 - min(distance1, distance2) / (distance1 + distance2);

  bool correctVariation = (((distance1 < distance2) ? lumaEnd1 : lumaEnd2) < 0.0) != (lumaM < lumaLocalAverage);
  float finalOffset = correctVariation ? pixelOffset : 0.0;

  float lumaAverage = (1.0 / 12.0) * (2.0 * (lumaNS + lumaWE) + lumaNWSW + lumaNESE);
  float subPixelOffset1 = clamp(abs(lumaAverage - lumaM) / lumaRange, 0.0, 1.0);
  float subPixelOffset2 = (-2.0 * subPixelOffset1 + 3.0) * subPixelOffset1 * subPixelOffset1;
  finalOffset = max(finalOffset, subPixelOffset2 * subPixelOffset2 * SUBPIXEL_QUALITY);

  outColor = vec4(texture(u_screenTexture, v_uv + stepNormal * finalOffset).rgb, 1.0);
}`

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
  gl.shaderSource(vertexShader, vsSource)
  gl.compileShader(vertexShader)

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(fragmentShader, fsSource)
  gl.compileShader(fragmentShader)

  const program = gl.createProgram()!
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (DEBUG && !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Fullscreen shader link error: ${gl.getProgramInfoLog(program)}\nVS: ${gl.getShaderInfoLog(vertexShader)}\nFS: ${gl.getShaderInfoLog(fragmentShader)}`,
    )
  }

  return program
}

function querySupportedMsaaSamples(gl: WebGL2RenderingContext): number[] {
  const colorSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA8, gl.SAMPLES) as Int32Array | null
  const depthSamples = gl.getInternalformatParameter(
    gl.RENDERBUFFER,
    gl.DEPTH_COMPONENT24,
    gl.SAMPLES,
  ) as Int32Array | null
  if (!colorSamples || !depthSamples) return []

  const depthSet = new Set<number>(depthSamples)
  const common: number[] = []
  for (let i = 0; i < colorSamples.length; ++i) {
    const s = colorSamples[i]!
    if (s > 1 && depthSet.has(s)) {
      common.push(s)
    }
  }
  return common
}

function pickSupportedSampleCount(supportedDescending: readonly number[], requested: number): number {
  for (let i = 0; i < supportedDescending.length; ++i) {
    const s = supportedDescending[i]!
    if (s <= requested) return s
  }
  return supportedDescending[supportedDescending.length - 1] ?? 0
}

function initializeRendering(gl: WebGL2RenderingContext): RenderingState {
  const resolveFbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo)

  const colorTexture = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.DisplayFinalization)
  gl.bindTexture(gl.TEXTURE_2D, colorTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0)

  const entityIdTexture = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.EntityId)
  gl.bindTexture(gl.TEXTURE_2D, entityIdTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, 1, 1, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, entityIdTexture, 0)

  const depthBuffer = gl.createRenderbuffer()!
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, 1, 1)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer)

  // Integer attachments (R32UI) cannot be multisampled in WebGL2 / OpenGL ES 3.0.
  // Intersect format-specific sample counts for RGBA8 and DEPTH_COMPONENT24 (e.g. Apple Silicon Metal
  // or macOS ANGLE where MAX_SAMPLES or RGBA8 may differ from DEPTH_COMPONENT24) so both attachments match.
  const supportedMsaaSamples = querySupportedMsaaSamples(gl)
  let msaaFbo: WebGLFramebuffer | null = null
  let msaaColorBuffer: WebGLRenderbuffer | null = null
  let msaaDepthBuffer: WebGLRenderbuffer | null = null

  if (supportedMsaaSamples.length > 0) {
    const initialSamples = pickSupportedSampleCount(supportedMsaaSamples, AntialiasMode.Msaa4x)
    msaaFbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, msaaFbo)

    msaaColorBuffer = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, msaaColorBuffer)
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, initialSamples, gl.RGBA8, 1, 1)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msaaColorBuffer)

    msaaDepthBuffer = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, msaaDepthBuffer)
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, initialSamples, gl.DEPTH_COMPONENT24, 1, 1)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msaaDepthBuffer)

    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE])
    gl.readBuffer(gl.COLOR_ATTACHMENT0)
  }

  gl.bindRenderbuffer(gl.RENDERBUFFER, null)

  const fullscreenProgram = createProgram(gl, FULLSCREEN_VS, PASSTHROUGH_FS)
  const fxaaProgram = createProgram(gl, FULLSCREEN_VS, FXAA_FS)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  const screenTextureUniform = gl.getUniformLocation(fullscreenProgram, 'u_screenTexture')!
  const fxaaScreenTextureUniform = gl.getUniformLocation(fxaaProgram, 'u_screenTexture')!
  const fxaaInverseScreenSizeUniform = gl.getUniformLocation(fxaaProgram, 'u_inverseScreenSize')!

  return {
    resolveFbo,
    colorTexture,
    entityIdTexture,
    depthBuffer,
    supportedMsaaSamples,
    msaaFbo,
    msaaColorBuffer,
    msaaDepthBuffer,
    fullscreenProgram,
    screenTextureUniform,
    fxaaProgram,
    fxaaScreenTextureUniform,
    fxaaInverseScreenSizeUniform,
  }
}

function handleResize(gl: WebGL2RenderingContext, state: RenderingState, newWidth: number, newHeight: number) {
  const safeWidth = Math.max(1, newWidth)
  const safeHeight = Math.max(1, newHeight)
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.DisplayFinalization)
  gl.bindTexture(gl.TEXTURE_2D, state.colorTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, safeWidth, safeHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.EntityId)
  gl.bindTexture(gl.TEXTURE_2D, state.entityIdTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, safeWidth, safeHeight, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, null)
  gl.bindRenderbuffer(gl.RENDERBUFFER, state.depthBuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, safeWidth, safeHeight)

  gl.activeTexture(gl.TEXTURE0 + TextureSlot.UNUSED)
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindRenderbuffer(gl.RENDERBUFFER, null)
}

function handleMsaaResize(
  gl: WebGL2RenderingContext,
  state: RenderingState,
  samples: number,
  newWidth: number,
  newHeight: number,
) {
  if (!state.msaaColorBuffer || !state.msaaDepthBuffer) return
  const safeWidth = Math.max(1, newWidth)
  const safeHeight = Math.max(1, newHeight)
  gl.bindRenderbuffer(gl.RENDERBUFFER, state.msaaColorBuffer)
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, safeWidth, safeHeight)
  gl.bindRenderbuffer(gl.RENDERBUFFER, state.msaaDepthBuffer)
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, safeWidth, safeHeight)
  gl.bindRenderbuffer(gl.RENDERBUFFER, null)
}

function prepareForDraw(gl: WebGL2RenderingContext, state: RenderingState, useMsaa: boolean) {
  if (useMsaa && state.msaaFbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.msaaFbo)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE])
    gl.viewport(0, 0, gl['canvas']['width'], gl['canvas']['height'])
    gl.clearBufferfv(gl.COLOR, 0, [0.1, 0.2, 0.3, 1.0]) // Clear color to dark blue
    gl.clear(gl.DEPTH_BUFFER_BIT)
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.resolveFbo)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
    gl.viewport(0, 0, gl['canvas']['width'], gl['canvas']['height'])
    gl.clearBufferfv(gl.COLOR, 0, [0.1, 0.2, 0.3, 1.0]) // Clear color to dark blue
    gl.clearBufferuiv(gl.COLOR, 1, [0, 0, 0, 0]) // Clear ID to 0
    gl.clear(gl.DEPTH_BUFFER_BIT)
  }

  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)
  gl.cullFace(gl.BACK)
}

function resolveMsaaColor(gl: WebGL2RenderingContext, state: RenderingState, width: number, height: number) {
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.msaaFbo)
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, state.resolveFbo)
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE])
  gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST)
}

function renderScissoredEntityIdPixel(
  gl: WebGL2RenderingContext,
  state: RenderingState,
  pixelX: number,
  glPixelY: number,
  drawScene: () => void,
) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.resolveFbo)
  gl.drawBuffers([gl.NONE, gl.COLOR_ATTACHMENT1])
  gl.enable(gl.SCISSOR_TEST)
  gl.scissor(pixelX, glPixelY, 1, 1)
  gl.clearBufferuiv(gl.COLOR, 1, [0, 0, 0, 0])
  gl.clear(gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)
  gl.cullFace(gl.BACK)
  drawScene()
  gl.disable(gl.SCISSOR_TEST)
}

function finalizeDisplay(
  gl: WebGL2RenderingContext,
  state: RenderingState,
  useFxaa: boolean,
  width: number,
  height: number,
) {
  // Draw the final color texture to the screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.disable(gl.DEPTH_TEST)
  gl.activeTexture(gl.TEXTURE0 + TextureSlot.DisplayFinalization)
  gl.bindTexture(gl.TEXTURE_2D, state.colorTexture)

  if (useFxaa) {
    gl.useProgram(state.fxaaProgram)
    gl.uniform1i(state.fxaaScreenTextureUniform, TextureSlot.DisplayFinalization)
    gl.uniform2f(state.fxaaInverseScreenSizeUniform, 1 / width, 1 / height)
  } else {
    gl.useProgram(state.fullscreenProgram)
    gl.uniform1i(state.screenTextureUniform, TextureSlot.DisplayFinalization)
  }

  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

export const newContextWrapper = async ({ element: canvas, frontendVariables }: UICanvas, camera: Camera) => {
  const gl = obtainWebGl2ContextFromCanvas(canvas)
  const state = initializeRendering(gl)
  const entityIdReader = new AsyncEntityIdReader(gl)
  const mouse = createNewMouseInterpreter()

  let lastWidth = -1
  let lastHeight = -1
  let lastMsaaWidth = 1
  let lastMsaaHeight = 1
  let lastMsaaSamples = pickSupportedSampleCount(state.supportedMsaaSamples, AntialiasMode.Msaa4x)
  let activeFrameMode: AntialiasMode = AntialiasMode.Off
  let activeFrameUsesMsaa = false

  return {
    rawContext: gl,
    getRendererName() {
      return obtainRendererNameFromContext(gl) ?? '<unknown renderer>'
    },
    prepareForDraw() {
      const width = Atomics.load(frontendVariables, FrontendVariable.CanvasDrawingWidth)
      const height = Atomics.load(frontendVariables, FrontendVariable.CanvasDrawingHeight)

      const pixelMultiplier = 1.0

      const TEXTURE_PIXEL_MULTIPLIER = 1 / pixelMultiplier
      const targetWidth = (width * TEXTURE_PIXEL_MULTIPLIER) | 0
      const targetHeight = (height * TEXTURE_PIXEL_MULTIPLIER) | 0

      if (lastWidth !== width || lastHeight !== height) {
        if (height > 0) {
          camera.setAspectRatio(width / height)
        }
        lastWidth = width
        lastHeight = height

        canvas['width'] = targetWidth
        canvas['height'] = targetHeight

        handleResize(gl, state, targetWidth, targetHeight)
      }

      activeFrameMode = CONFIG.get('rendering/antialias-mode')
      const effectiveSamples =
        state.msaaFbo !== null && activeFrameMode >= AntialiasMode.Msaa2x
          ? pickSupportedSampleCount(state.supportedMsaaSamples, activeFrameMode | 0)
          : 0
      activeFrameUsesMsaa = effectiveSamples > 1

      if (activeFrameUsesMsaa) {
        const safeWidth = Math.max(1, targetWidth)
        const safeHeight = Math.max(1, targetHeight)
        if (lastMsaaWidth !== safeWidth || lastMsaaHeight !== safeHeight || lastMsaaSamples !== effectiveSamples) {
          lastMsaaWidth = safeWidth
          lastMsaaHeight = safeHeight
          lastMsaaSamples = effectiveSamples
          handleMsaaResize(gl, state, effectiveSamples, safeWidth, safeHeight)
        }
      } else if (state.msaaFbo !== null && (lastMsaaWidth > 1 || lastMsaaHeight > 1)) {
        // Release full-screen multisample renderbuffer memory when using OFF or FXAA
        lastMsaaWidth = 1
        lastMsaaHeight = 1
        handleMsaaResize(gl, state, lastMsaaSamples, 1, 1)
      }

      prepareForDraw(gl, state, activeFrameUsesMsaa)
    },
    updateCamera(dt: number, terrain: TerrainHeightReader, terrainHeight: number) {
      mouse.updateCameraBasedOnInputs(camera, frontendVariables, terrain, terrainHeight, dt)
    },
    finalizeDisplay(drawScene: () => void) {
      const canvasWidth = gl['canvas']['width']
      const canvasHeight = gl['canvas']['height']
      if (canvasWidth <= 0 || canvasHeight <= 0) return

      if (activeFrameUsesMsaa) {
        resolveMsaaColor(gl, state, canvasWidth, canvasHeight)
      }

      if (entityIdReader.canRead()) {
        const x = Atomics.load(frontendVariables, FrontendVariable.MouseCursorPositionX)
        const y = Atomics.load(frontendVariables, FrontendVariable.MouseCursorPositionY)
        if (x >= 0 && y >= 0 && x < canvasWidth && y < canvasHeight) {
          if (activeFrameUsesMsaa) {
            renderScissoredEntityIdPixel(gl, state, x, canvasHeight - 1 - y, drawScene)
          } else {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.resolveFbo)
          }
          entityIdReader.readEntityId(x, y)?.then(entityId => {
            let blockX = -1
            let blockZ = -1
            if (entityId !== 0) {
              const isBlock = entityId >>> 31 === 1
              if (!isBlock) {
                // console.log('not a block', { entityId })
                return
              }
              const posMask = 0xffff >> 2
              blockZ = entityId & posMask
              blockX = (entityId >> 14) & posMask
            }
            // console.log({ x, y, entityId, blockX, blockZ })
          })
        }
      }
      finalizeDisplay(gl, state, activeFrameMode === AntialiasMode.Fxaa, canvasWidth, canvasHeight)
    },
  }
}

export const newFramesLimiter = (frontendVariables: UICanvas['frontendVariables']) => {
  let minSecondsBetweenFramesFocus = 0
  let minSecondsBetweenFramesBlur = 0

  const unsub1 = observeSetting('rendering/fps-cap', value => {
    minSecondsBetweenFramesFocus = value <= 0 ? 0 : 1 / (+value <= 0 ? 0.00001 : +value)
  })
  const unsub2 = observeSetting('rendering/fps-cap-on-blur', value => {
    minSecondsBetweenFramesBlur = value <= 0 ? 9999999 : 1 / +value
  })

  return {
    shouldRender: (dt: number): boolean => {
      const variables = Atomics.load(frontendVariables, FrontendVariable.AdditionalFlags)
      const hasFocus = (variables & AdditionalFrontedFlags.WindowHasFocus) === AdditionalFrontedFlags.WindowHasFocus
      return dt >= (hasFocus ? minSecondsBetweenFramesFocus : minSecondsBetweenFramesBlur) * 0.97
    },
    cleanUp() {
      unsub1()
      unsub2()
    },
  }
}

export const waitForAllGPUOperationsToFinish = async (gl: WebGL2RenderingContext) => {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!
  gl['flush']()

  try {
    while (true) {
      await sleep(4)
      const waitResult = gl.clientWaitSync(sync, 0, 0)

      if (waitResult === gl.WAIT_FAILED) return

      if (waitResult === gl.TIMEOUT_EXPIRED) continue // still processing

      break // status is other - processing finished
    }
  } finally {
    gl.deleteSync(sync)
  }
}

export const newAnimationFrameCaller = (
  shouldRender: (elapsedSeconds: number) => boolean,
  actualRender: (elapsedSeconds: number, secondsSinceFirstRender: number) => Promise<void>,
) => {
  let nextFrameRequest = 0
  let firstFrameTime = 0
  let lastFrameTime = 0

  const internalRenderFunction = async () => {
    const now = performance.now()
    const elapsedSeconds = (now - lastFrameTime) / 1000

    if (shouldRender(elapsedSeconds) === true) {
      await actualRender(elapsedSeconds, (now - firstFrameTime) / 1000)
      lastFrameTime = now
    }

    // someone could cancel rendering in render callback
    if (nextFrameRequest !== 0) nextFrameRequest = requestAnimationFrame(internalRenderFunction)
  }

  return {
    start() {
      if (nextFrameRequest !== 0) return

      firstFrameTime = lastFrameTime = performance.now()

      nextFrameRequest = requestAnimationFrame(internalRenderFunction)
    },
    stop() {
      // safari doesn't support - check before call
      if (!!globalThis.cancelAnimationFrame) cancelAnimationFrame(nextFrameRequest)
      nextFrameRequest = 0
    },
  }
}
