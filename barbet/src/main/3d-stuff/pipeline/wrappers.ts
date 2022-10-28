import { ScheduledActionId } from "../../game-state/scheduled-actions"
import { ActionsQueue } from "../../game-state/scheduled-actions/queue"
import { AdditionalFrontedFlags, frontedVariables, FrontendVariable } from "../../util/frontend-variables"
import CONFIG, { observeSetting } from "../../util/persistance/observable-settings"
import { Camera } from "../camera"
import { moveCameraByKeys } from "../renderable/camera-keyboard-updater"
import { MousePickerResultAny } from "./mouse-picker"

const obtainWebGl2ContextFromCanvas = (canvas: HTMLCanvasElement): WebGL2RenderingContext => {
    const context = canvas.getContext('webgl2', {
        'alpha': false,
        'antialias': CONFIG.get('rendering/antialias'),
        'depth': true,
        'stencil': false,
        'failIfMajorPerformanceCaveat': true,
    }) as WebGL2RenderingContext
    if (context == null)
        throw new Error('Unable to obtain context')
    return context
}

const obtainRendererNameFromContext = (gl: WebGL2RenderingContext | undefined): string | null => {
    if (gl) {
        const ext = gl['getExtension']('WEBGL_debug_renderer_info') as any
        if (ext) {
            const value = gl['getParameter'](ext['UNMASKED_RENDERER_WEBGL'])
            if (value)
                return `${value}`
        }
    }
    return null
}

export const newBeforeDrawWrapper = (canvas: HTMLCanvasElement, camera: Camera) => {
    const gl = obtainWebGl2ContextFromCanvas(canvas)

    const TEXTURE_PIXEL_MULTIPLIER = 1

    let lastWidth = -1
    let lastHeight = -1

    return {
        rawContext: gl,
        getRendererName() {
            return obtainRendererNameFromContext(gl) ?? ''
        },
        handleResize() {
            const width = frontedVariables[FrontendVariable.CanvasDrawingWidth]!
            const height = frontedVariables[FrontendVariable.CanvasDrawingHeight]!
            if (lastWidth !== width || lastHeight !== height) {
                camera.setAspectRatio(width / height)
                lastWidth = width
                lastHeight = height

                canvas['width'] = width * TEXTURE_PIXEL_MULTIPLIER | 0
                canvas['height'] = height * TEXTURE_PIXEL_MULTIPLIER | 0
            }
            gl.viewport(0, 0, width * TEXTURE_PIXEL_MULTIPLIER | 0, height * TEXTURE_PIXEL_MULTIPLIER | 0)
        },
        clearBeforeDraw() {
            gl.clearColor(0.15, 0.15, 0.15, 1)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

            gl.enable(gl.DEPTH_TEST)
            gl.depthFunc(gl.LEQUAL)

            gl.cullFace(gl.BACK)
            gl.enable(gl.CULL_FACE)
        }
    }
}

export const newFramesLimiter = () => {
    let minSecondsBetweenFramesFocus = 0
    let minSecondsBetweenFramesBlur = 0

    const unsub1 = observeSetting('rendering/fps-cap', value => {
        minSecondsBetweenFramesFocus = (value <= 0) ? 0 : (1 / (+value <= 0 ? 0.00001 : +value))
    })
    const unsub2 = observeSetting('rendering/fps-cap-on-blur', value => {
        minSecondsBetweenFramesBlur = (value <= 0) ? 9999999 : (1 / +value)
    })

    return {
        shouldRender: (dt: number): boolean => {
            const variables = Atomics.load(frontedVariables, FrontendVariable.AdditionalFlags)
            const hasFocus = (variables & AdditionalFrontedFlags.WindowHasFocus) === AdditionalFrontedFlags.WindowHasFocus
            return dt >= (hasFocus ? minSecondsBetweenFramesFocus : minSecondsBetweenFramesBlur)
        },
        cleanUp() {
            unsub1()
            unsub2()
        }
    }
}

export const newAnimationFrameCaller = (
    shouldRender: (elapsedSeconds: number) => boolean,
    actualRender: (elapsedSeconds: number, secondsSinceFirstRender: number) => Promise<void>,
) => {
    let nextFrameRequest = 0;
    let firstFrameTime = 0
    let lastFrameTime = 0

    const internalRenderFunction = async () => {
        const now = performance.now()
        const elapsedSeconds = (now - lastFrameTime) / 1000

        if ((shouldRender(elapsedSeconds)) === true) {
            await actualRender(elapsedSeconds, (now - firstFrameTime) / 1000)
            lastFrameTime = performance.now()
        }

        // someone could cancel rendering in render callback
        if (nextFrameRequest !== 0)
            nextFrameRequest = requestAnimationFrame(internalRenderFunction)
    }

    return {
        start() {
            if (nextFrameRequest !== 0) return

            firstFrameTime = lastFrameTime = performance.now()

            nextFrameRequest = requestAnimationFrame(internalRenderFunction)
        },
        stop() {
            cancelAnimationFrame(nextFrameRequest)
            nextFrameRequest = 0
        },
    }
}


const enum EventHappened {
    None,
    LeftClick,
    RightClick,
}

interface InputHandlerRequestForRender {
    mouseX: number
    mouseY: number
    event: EventHappened
}

export const newInputHandler = (actionsQueue: ActionsQueue) => {
    let lastClickId: number = 0
    let mousePositionX: number = 0
    let mousePositionY: number = 0

    return {
        handleInputsBeforeDraw(camera: Camera, dt: number) {
            moveCameraByKeys(camera, dt)
        },
        shouldRenderForInputs(): InputHandlerRequestForRender | null {
            let eventHappened: EventHappened = EventHappened.None

            if (lastClickId !== frontedVariables[FrontendVariable.LastMouseClickId]) {
                lastClickId = frontedVariables[FrontendVariable.LastMouseClickId]!
                mousePositionX = frontedVariables[FrontendVariable.MouseCursorPositionX]!
                mousePositionY = frontedVariables[FrontendVariable.CanvasDrawingHeight]! - frontedVariables[FrontendVariable.MouseCursorPositionY]!
                const right = (frontedVariables[FrontendVariable.AdditionalFlags]! & AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight) === AdditionalFrontedFlags.LastMouseButtonUnpressedWasRight
                eventHappened = right ? EventHappened.RightClick : EventHappened.LeftClick
            }

            if (eventHappened === EventHappened.None)
                return null

            return {
                mouseX: mousePositionX,
                mouseY: mousePositionY,
                event: eventHappened,
            }
        },
        interpretPick(computed: MousePickerResultAny, event: InputHandlerRequestForRender) {
            actionsQueue.append({
                type: ScheduledActionId.MouseClick,
                pick: computed,
                wasLeftClick: event.event === EventHappened.LeftClick,
            })
        },
    }
}