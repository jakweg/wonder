import { freezeAndValidateOptionsList } from '../../../util/common'

export type Color = [number, number, number]


export const enum UnitColorPaletteId {
	GreenOrange,
	DarkBlue,
	LightOrange
}

export interface UnitColorPalette {
	/** must be between 0 and 255 */
	numericId: UnitColorPaletteId

	primary: Color
	secondary: Color
	face: Color
}

export const allColorPalettes: UnitColorPalette[] = [
	{
		numericId: UnitColorPaletteId.GreenOrange,
		primary: [1, 0.6171875, 0.00390625],
		secondary: [0.62890625, 0.99609375, 0.40625],
		face: [0.1171875, 0.4375, 0],
	},
	{
		numericId: UnitColorPaletteId.DarkBlue,
		primary: [0, 0.37890625, 0.53515625],
		secondary: [0, 0.58984375, 0.63671875],
		face: [0.83203125, 0.984375, 0.99609375],
	},
	{
		numericId: UnitColorPaletteId.LightOrange,
		primary: [0.984375, 0.703125, 0.140625],
		secondary: [0.9921875, 0.99609375, 0.78125],
		face: [0.3984375, 0.234375, 0.0546875],
	},
]
freezeAndValidateOptionsList(allColorPalettes)

export const requireUnitColorPalette = (id: UnitColorPaletteId): UnitColorPalette => {
	const color = allColorPalettes[id]
	if (color == null)
		throw new Error(`Invalid activity id ${id}`)
	return color
}

export const buildShaderColorArray = (variableName: string) => {
	const fractionDigits = 8
	const parts: string[] = []
	const numberOfFloatsAsString = (allColorPalettes.length * 9).toString(10)
	parts.push(`const float `, variableName, `[`, numberOfFloatsAsString, `] = float[`, numberOfFloatsAsString, `](`)
	for (const color of allColorPalettes) {
		parts.push(
			color.primary[0].toFixed(fractionDigits), ',',
			color.primary[1].toFixed(fractionDigits), ',',
			color.primary[2].toFixed(fractionDigits), ',',
			color.secondary[0].toFixed(fractionDigits), ',',
			color.secondary[1].toFixed(fractionDigits), ',',
			color.secondary[2].toFixed(fractionDigits), ',',
			color.face[0].toFixed(fractionDigits), ',',
			color.face[1].toFixed(fractionDigits), ',',
			color.face[2].toFixed(fractionDigits), ',',
		)
	}
	parts.pop() // remove last comma
	parts.push(');')
	return parts.join('')
}
