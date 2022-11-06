import { frontedVariables, FrontendVariable, PressedKey } from '../util/frontend-variables'
import { Camera } from './camera'

export const moveCameraByKeys = (camera: Camera, dt: number) => {
  const keys = Atomics.load(frontedVariables, FrontendVariable.PressedKeys) as PressedKey
  if (keys === PressedKey.None) return
  const speed = dt * 1.2 * camera.eye[1]

  if ((keys & PressedKey.Forward) === PressedKey.Forward) {
    camera.moveCamera(0, 0, speed)
  }
  if ((keys & PressedKey.Backward) === PressedKey.Backward) {
    camera.moveCamera(0, 0, -speed)
  }
  if ((keys & PressedKey.Left) === PressedKey.Left) {
    camera.moveCamera(speed, 0, 0)
  }
  if ((keys & PressedKey.Right) === PressedKey.Right) {
    camera.moveCamera(-speed, 0, 0)
  }
  if ((keys & PressedKey.Down) === PressedKey.Down) {
    camera.moveCamera(0, -speed, 0)
  }
  if ((keys & PressedKey.Up) === PressedKey.Up) {
    camera.moveCamera(0, speed, 0)
  }

  camera.lastEyeChangeId++
}
