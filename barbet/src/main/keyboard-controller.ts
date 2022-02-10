class KeyboardController {
	private pressedKeys: { [key: string]: boolean } = {}
	private pressedCount: number = 0

	private constructor() {
	}

	public static createNewAndRegisterToWindow(): KeyboardController {
		const controller = new KeyboardController()

		document.addEventListener('keydown', ({code}) => controller.setKeyPressed(code, true))
		document.addEventListener('keyup', ({code}) => controller.setKeyPressed(code, false))
		window.addEventListener('blur', () => controller.cancelAllPressed())

		return controller
	}

	public cancelAllPressed(): void {
		const keys = this.pressedKeys
		for (const code in keys)
			keys[code] = false
		this.pressedCount = 0
	}

	public isAnyPressed(): boolean {
		return this.pressedCount !== 0
	}

	public isPressed(code: string): boolean {
		if (this.pressedCount === 0) return false
		return this.pressedKeys[code] ?? false
	}

	private setKeyPressed(code: string, pressed: boolean): void {
		if (this.pressedKeys[code] === pressed) return
		this.pressedKeys[code] = pressed
		this.pressedCount += pressed ? 1 : -1
	}
}

const KEYBOARD = KeyboardController.createNewAndRegisterToWindow()
export default KEYBOARD
