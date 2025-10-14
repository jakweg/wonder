import { AdditionalFrontedFlags, FrontendVariable, PressedKey } from './frontend-variables'

const defaultKeyMapping: { [key: string]: PressedKey } = {
  'KeyW': PressedKey.Forward,
  'ArrowUp': PressedKey.Forward,

  'KeyS': PressedKey.Backward,
  'ArrowDown': PressedKey.Backward,

  'KeyA': PressedKey.Left,
  'ArrowLeft': PressedKey.Left,

  'KeyD': PressedKey.Right,
  'ArrowRight': PressedKey.Right,

  'ShiftLeft': PressedKey.Down,
  'Space': PressedKey.Up,
}

class KeyboardController {
  public static INSTANCE: KeyboardController | undefined = undefined
  private pressedKeys: Set<string> = new Set()
  private keyReleasedListeners: Map<string, (code: string) => void> = new Map()
  private maskEnabled: boolean = false

  private readonly frontedVariableListeners: Set<Int16Array> = new Set()

  private constructor() {}

  public static registerToWindow(): KeyboardController {
    if (KeyboardController.INSTANCE) return KeyboardController.INSTANCE
    const controller = (KeyboardController.INSTANCE = new KeyboardController())

    document.addEventListener('keydown', event => controller.setKeyPressed(event['code'], true))
    document.addEventListener('keyup', event => controller.setKeyPressed(event['code'], false))
    window.addEventListener('blur', () => controller.cancelAllPressed())
    window.addEventListener('blur', () => controller.updateWindowFocus())
    window.addEventListener('focus', () => controller.updateWindowFocus())

    return controller
  }

  public setMaskEnabled(enabled: boolean) {
    if (this.maskEnabled === enabled) return
    if (enabled) this.cancelAllPressed()
    this.maskEnabled = enabled
  }

  public cancelAllPressed(): void {
    this.pressedKeys['clear']()
    for (const frontendVariables of this.frontedVariableListeners)
      Atomics.store(frontendVariables, FrontendVariable.PressedKeys, PressedKey.None)
  }

  private updateWindowFocus() {
    const hasFocus = document.hasFocus()
    for (const frontendVariables of this.frontedVariableListeners) {
      if (hasFocus)
        Atomics.or(frontendVariables, FrontendVariable.AdditionalFlags, AdditionalFrontedFlags.WindowHasFocus)
      else Atomics.and(frontendVariables, FrontendVariable.AdditionalFlags, ~AdditionalFrontedFlags.WindowHasFocus)
    }
  }

  public isAnyPressed(): boolean {
    return this.pressedKeys['size'] !== 0
  }

  public isPressed(code: string): boolean {
    return this.pressedKeys['has'](code)
  }

  private setKeyPressed(code: string, pressed: boolean): void {
    if (this.maskEnabled) return
    if (pressed) this.pressedKeys['add'](code)
    else this.pressedKeys['delete'](code)

    const mapped = defaultKeyMapping[code] ?? PressedKey.None

    if (mapped === PressedKey.None) {
      if (!pressed) this.keyReleasedListeners['get'](code)?.(code)
      return
    }

    for (const frontendVariables of this.frontedVariableListeners) {
      if (pressed) Atomics.or(frontendVariables, FrontendVariable.PressedKeys, mapped)
      else Atomics.and(frontendVariables, FrontendVariable.PressedKeys, ~mapped)
    }
  }

  public setKeyReleasedListener<T extends string>(code: T, callback: (key: T) => void) {
    if (this.keyReleasedListeners['has'](code)) throw new Error()
    this.keyReleasedListeners['set'](code, callback)
  }

  public addFrontendVariableListener(frontendVariables: Int16Array): () => void {
    this.frontedVariableListeners.add(frontendVariables)
    this.updateWindowFocus()
    return () => this.frontedVariableListeners.delete(frontendVariables)
  }
}

export default KeyboardController
