import { Camera, CAMERA_FOV } from '@3d/camera'
import { TerrainHeightReader } from '@3d/world-terrain-snapshot'
import * as vec3 from '@matrix/vec3'
import { FrontendVariable, PressedKey } from '@utils/frontend-variables'

interface CameraDelta {
  distance: number
  pitch: number
  yaw: number
  panX: number
  panY: number
  forward: number
  sideways: number
}

const DISTANCE_MIN = 2
const PITCH_MIN = (-Math.PI / 2) * 0.8
const PITCH_MAX = (-Math.PI / 2) * 0.2
const CAMERA_MOVE_SPEED = 15
const CAMERA_MOVE_DAMPING = 10
const ORBIT_SENSITIVITY = 0.6 // TODO make that a setting in CONFIG?
const ORBIT_DAMPING = 10
const PAN_SENSITIVITY = 1 // 1 = 1:1 ground-plane tracking under the cursor
const PAN_DAMPING = 14
const ZOOM_SENSITIVITY = 0.0014 // TODO make that a setting in CONFIG?
const ZOOM_DAMPING = 10
const TAN_HALF_FOV = Math.tan(CAMERA_FOV / 2)

const updateDeltaByKeys = (delta: CameraDelta, frontendVariables: Int16Array) => {
  const keys = Atomics.load(frontendVariables, FrontendVariable.PressedKeys) as PressedKey

  let dx = 0,
    dz = 0
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

  if (dz !== 0) delta.forward = dz
  if (dx !== 0) delta.sideways = dx
}

const calculateSolidBlockLookingAt = (
  target: readonly [number, number, number],
  eye: readonly [number, number, number],
  terrain: TerrainHeightReader,
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

    const heightAtThisLocation = terrain.getHighestBlockHeight_orElse(x, z, -1)
    if (heightAtThisLocation * terrainHeight >= y) {
      // means we hit the block
      break
    }
  }

  return temporaryVectorForBlockTest
}

export const createNewMouseInterpreter = () => {
  const delta: CameraDelta = {
    distance: 0,
    forward: 0,
    sideways: 0,
    panX: 0,
    panY: 0,
    pitch: 0,
    yaw: 0,
  }

  let distance = 10
  let pitch = -0.5
  let yaw = 0.5

  return {
    updateCameraBasedOnInputs(
      camera: Camera,
      variables: Int16Array,
      terrain: TerrainHeightReader,
      terrainHeight: number,
      dt: number,
    ) {
      // check if camera is in block for some reason
      const terrainHeightAtCameraPosition =
        (terrain.getHighestBlockHeight_orElse(camera.eye[0] | 0, camera.eye[2] | 0, -1) + 2) * terrainHeight
      if (camera.eye[1] <= terrainHeightAtCameraPosition) {
        const willBumpCameraBy = terrainHeightAtCameraPosition + terrainHeight * 5 - camera.eye[1]
        camera.eye[1] += willBumpCameraBy
        camera.target[1] += willBumpCameraBy
      }

      const orbitDeltaX = Atomics.exchange(variables, FrontendVariable.CameraOrbitDeltaX8, 0) / 8
      const orbitDeltaY = Atomics.exchange(variables, FrontendVariable.CameraOrbitDeltaY8, 0) / 8
      const panDeltaX = Atomics.exchange(variables, FrontendVariable.CameraPanDeltaX8, 0) / 8
      const panDeltaY = Atomics.exchange(variables, FrontendVariable.CameraPanDeltaY8, 0) / 8
      const zoomDelta = Atomics.exchange(variables, FrontendVariable.MouseWheelDelta, 0)

      const lookingAtPosition = calculateSolidBlockLookingAt(camera.target, camera.eye, terrain, terrainHeight)
      vec3.copy(camera.target, lookingAtPosition)
      distance = vec3.distance(camera.eye, camera.target)

      const width = Atomics.load(variables, FrontendVariable.CanvasDrawingWidth)
      const height = Atomics.load(variables, FrontendVariable.CanvasDrawingHeight)

      delta.pitch += orbitDeltaY
      delta.yaw += orbitDeltaX
      delta.panX += panDeltaX
      delta.panY += panDeltaY
      delta.distance += zoomDelta
      updateDeltaByKeys(delta, variables)

      const sinYaw = Math.sin(yaw)
      const cosYaw = Math.cos(yaw)

      const forwardX = -sinYaw
      const forwardZ = -cosYaw

      const rightX = cosYaw
      const rightZ = -sinYaw

      const clampedDt = Math.min(dt, 0.1)
      const cameraSpeed = Math.log(distance) * clampedDt * CAMERA_MOVE_SPEED
      camera.target[0] += (rightX * delta.sideways + forwardX * delta.forward) * cameraSpeed
      camera.target[2] += (rightZ * delta.sideways + forwardZ * delta.forward) * cameraSpeed

      const panDecay = 1 - Math.exp(-PAN_DAMPING * clampedDt)
      const stepPanX = delta.panX * panDecay
      const stepPanY = delta.panY * panDecay
      delta.panX -= stepPanX
      delta.panY -= stepPanY

      if (height > 0) {
        const worldPerPixel = (2 * distance * TAN_HALF_FOV) / height
        const panRight = -stepPanX * worldPerPixel * PAN_SENSITIVITY
        const panForward = (stepPanY * worldPerPixel * PAN_SENSITIVITY) / -Math.sin(pitch)
        camera.target[0] += rightX * panRight + forwardX * panForward
        camera.target[2] += rightZ * panRight + forwardZ * panForward
      }

      const orbitDecay = 1 - Math.exp(-ORBIT_DAMPING * clampedDt)
      const stepPitch = delta.pitch * orbitDecay
      const stepYaw = delta.yaw * orbitDecay
      delta.pitch -= stepPitch
      delta.yaw -= stepYaw

      if (height > 0) {
        const unclampedPitch = pitch + ((2 * Math.PI * stepPitch) / height) * ORBIT_SENSITIVITY
        pitch = Math.min(PITCH_MAX, Math.max(unclampedPitch, PITCH_MIN))
        if (pitch !== unclampedPitch) delta.pitch = 0
      }

      if (width > 0) {
        yaw += ((2 * Math.PI * stepYaw) / width) * ORBIT_SENSITIVITY
      }

      const zoomDecay = 1 - Math.exp(-ZOOM_DAMPING * clampedDt)
      const stepZoom = delta.distance * zoomDecay
      delta.distance -= stepZoom

      const unclampedDistance = distance * Math.exp(stepZoom * ZOOM_SENSITIVITY)
      distance = Math.max(unclampedDistance, DISTANCE_MIN)
      if (distance !== unclampedDistance) delta.distance = 0

      const moveDecay = Math.exp(-CAMERA_MOVE_DAMPING * clampedDt)
      delta.forward *= moveDecay
      delta.sideways *= moveDecay

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
