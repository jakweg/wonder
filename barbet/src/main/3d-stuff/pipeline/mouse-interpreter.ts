import { Camera } from '@3d/camera'
import { GameState } from '@game'
import { World } from '@game/world/world'
import * as vec3 from '@matrix/vec3'
import { AdditionalFrontedFlags, FrontendVariable, PressedKey } from '@utils/frontend-variables'
import { UICanvas } from 'src/main/ui/canvas-background'

interface CameraDelta {
  distance: number
  pitch: number
  yaw: number
  forward: number
  sideways: number
}

const DISTANCE_MIN = 2
const PITCH_MIN = (-Math.PI / 2) * 0.8
const PITCH_MAX = (-Math.PI / 2) * 0.2
const CAMERA_MOVE_SPEED = 15

const updateDeltaByKeys = (delta: CameraDelta, frontendVariables: UICanvas['frontendVariables']) => {
  const keys = Atomics.load(frontendVariables as any as Int16Array, FrontendVariable.PressedKeys) as PressedKey
  const zoomDelta = Atomics.exchange(frontendVariables as any, FrontendVariable.MouseWheelDelta, 0)

  let dx = 0,
    dz = 0,
    dy = 0
  if ((keys & PressedKey.Forward) === PressedKey.Forward) {
    dz += 1
  }
  if ((keys & PressedKey.Backward) === PressedKey.Backward) {
    dz -= 1
  }
  if ((keys & PressedKey.Left) === PressedKey.Left) {
    dx -= 1
  }
  if ((keys & PressedKey.Right) === PressedKey.Right) {
    dx += 1
  }

  dy += Math['sign'](zoomDelta) * Math['pow'](Math['abs'](zoomDelta), 0.1)

  if (dz !== 0) delta.forward = dz
  if (dx !== 0) delta.sideways = dx
  if (dy !== 0) delta.distance = dy
}

const calculateSolidBlockLookingAt = (
  target: readonly [number, number, number],
  eye: readonly [number, number, number],
  world: World,
  terrainHeight: number,
) => {
  const temporaryVectorForBlockTest = vec3.create()

  const stepVector = vec3.create()
  vec3.sub(stepVector, target, eye)
  vec3.normalize(stepVector, stepVector)
  vec3.scale(stepVector, stepVector, 0.2)

  // fail after 10000 failed tests - to avoid infinite loop when looking at the sky or void
  for (let i = 1; i < 10000; ++i) {
    vec3.scale(temporaryVectorForBlockTest, stepVector, i)
    vec3.add(temporaryVectorForBlockTest, temporaryVectorForBlockTest, eye)

    const x = temporaryVectorForBlockTest[0] | 0
    const y = temporaryVectorForBlockTest[1] | 0
    const z = temporaryVectorForBlockTest[2] | 0

    const heightAtThisLocation = world.getHighestBlockHeight_orElse(x, z, -1)
    if (heightAtThisLocation * terrainHeight >= y) {
      // means we hit the block
      break
    }
  }

  return temporaryVectorForBlockTest
}

export const createNewMouseInterpreter = () => {
  let isDragging = false

  let rotateStartX = 0
  let rotateStartY = 0

  let rotateEndX = 0
  let rotateEndY = 0

  const delta: CameraDelta = {
    distance: 0,
    forward: 0,
    sideways: 0,
    pitch: 0,
    yaw: 0,
  }

  let distance = 10
  let pitch = -0.5
  let yaw = 0.5

  return {
    updateCameraBasedOnInputsWithMutexHeld(
      camera: Camera,
      frontendVariables: UICanvas['frontendVariables'],
      game: GameState,
      terrainHeight: number,
      dt: number,
    ) {
      // check if camera is in block for some reason
      const terrainHeightAtCameraPosition =
        (game.world.getHighestBlockHeight_orElse(camera.eye[0] | 0, camera.eye[2] | 0, -1) + 2) * terrainHeight
      if (camera.eye[1] <= terrainHeightAtCameraPosition) {
        const willBumpCameraBy = terrainHeightAtCameraPosition + terrainHeight * 5 - camera.eye[1]
        camera.eye[1] += willBumpCameraBy
        camera.target[1] += willBumpCameraBy
      }

      const lookingAtPosition = calculateSolidBlockLookingAt(camera.target, camera.eye, game.world, terrainHeight)
      vec3.copy(camera.target, lookingAtPosition)
      distance = vec3.distance(camera.eye, camera.target)

      const width = frontendVariables[FrontendVariable.CanvasDrawingWidth]
      const height = frontendVariables[FrontendVariable.CanvasDrawingHeight]
      const currentX = frontendVariables[FrontendVariable.MouseCursorPositionX]
      const currentY = frontendVariables[FrontendVariable.MouseCursorPositionY]

      const flags = frontendVariables[FrontendVariable.AdditionalFlags]
      const isMouseDown =
        (flags & AdditionalFrontedFlags.LeftMouseButtonPressed) === AdditionalFrontedFlags.LeftMouseButtonPressed

      if (isMouseDown) {
        if (!isDragging) {
          isDragging = true
          rotateStartX = currentX
          rotateStartY = currentY
        }

        rotateEndX = currentX
        rotateEndY = currentY

        delta.pitch = rotateEndY - rotateStartY
        delta.yaw = rotateEndX - rotateStartX

        rotateStartX = rotateEndX
        rotateStartY = rotateEndY
      } else {
        isDragging = false
      }
      updateDeltaByKeys(delta, frontendVariables)

      const sinYaw = Math.sin(yaw)
      const cosYaw = Math.cos(yaw)

      const forwardX = -sinYaw
      const forwardZ = -cosYaw

      const rightX = cosYaw
      const rightZ = -sinYaw

      const cameraSpeed = Math.log(distance) * dt * CAMERA_MOVE_SPEED
      camera.target[0] += (rightX * delta.sideways + forwardX * delta.forward) * cameraSpeed
      camera.target[2] += (rightZ * delta.sideways + forwardZ * delta.forward) * cameraSpeed

      pitch += ((2 * Math.PI * delta.pitch) / height) * 0.4
      pitch = Math.min(PITCH_MAX, Math.max(pitch, PITCH_MIN))

      yaw += ((2 * Math.PI * delta.yaw) / width) * 0.4
      const zoomSensitivity = 2 * dt
      distance += distance * delta.distance * zoomSensitivity
      distance = Math.max(distance, DISTANCE_MIN)

      delta.pitch *= Math.max(0, 1 - dt * 10)
      delta.yaw *= Math.max(0, 1 - dt * 10)
      delta.distance *= Math.max(0, 1 - dt * 10)
      delta.forward *= Math.max(0, 1 - dt * 10)
      delta.sideways *= Math.max(0, 1 - dt * 10)

      const target = camera.target
      const eye = camera.eye

      const position = vec3.fromValues(0, 0, distance)

      // Apply pitch (rotation around X-axis)
      vec3.rotateX(position, position, vec3.create(), pitch)

      // Apply yaw (rotation around Y-axis)
      vec3.rotateY(position, position, vec3.create(), yaw)

      // Add the target position to offset the camera
      vec3.add(eye, position, target)
    },
  }
}
