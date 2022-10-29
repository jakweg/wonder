import { KeyValueText } from "."
import { DrawPhase, REQUESTED_MEASUREMENTS } from "../../3d-stuff/renderable/draw-phase"
import { HeaderFields } from "../../3d-stuff/renderable/time-meter"
import { map, observeField } from "../../util/state/subject"
import { newStatsObject, StatField } from "../../util/worker/debug-stats/render"
import { createElement } from "../utils"

export default (root: HTMLElement) => {

    const stats = newStatsObject()

    KeyValueText(root, `Renderer`, observeField(stats, StatField.RendererName))
    KeyValueText(root, `Visible chunks`, map(observeField(stats, StatField.VisibleChunksCount), e => `${e}`))
    KeyValueText(root, `Draw calls`, map(observeField(stats, StatField.DrawCallsCount), e => `${e}`))

    TimesTable(root, stats)

    return stats
}

const TimesTable = (root: HTMLElement, stats: ReturnType<typeof newStatsObject>) => {
    const table = createElement('table', root,)

    const theadTr = createElement('tr', createElement('thead', table,),)
    createElement('td', theadTr,)['textContent'] = 'Phase'


    const tbody = createElement('tbody', table,)
    const MEASUREMENTS = REQUESTED_MEASUREMENTS.map(m => `${m.intervalMilliseconds / 1000}s`)
    const MEASUREMENTS_COUNT = MEASUREMENTS['length']

    for (const title of MEASUREMENTS) {
        createElement('td', theadTr,)['textContent'] = title
    }

    const formatNumber = (value: number) => value.toFixed(2)

    const allCells: HTMLElement[] = []
    const StatRow = (title: string) => {
        const row = createElement('tr', tbody,)
        createElement('td', row,)['textContent'] = title

        for (let i = 0; i < MEASUREMENTS_COUNT; ++i) {
            const element = createElement('td', row,)
            allCells.push(element)
            element['textContent'] = formatNumber(0)
        }
    }
    StatRow(`HandleInputs`)
    StatRow(`LockMutex`)
    StatRow(`UpdateWorld`)
    StatRow(`PrepareRender`)
    StatRow(`GPUUpload`)
    StatRow(`Draw`)
    StatRow(`DrawForMousePicker`)
    StatRow(`Executed frames`)
    StatRow(`FPS`)

    setInterval(() => {
        const array = new Float32Array(stats.get(StatField.DrawTimesBuffer))
        if (array['length'] === 0) return


        const MEASUREMENTS_BLOCK_SIZE = (DrawPhase.SIZE * 2 + HeaderFields.SIZE);
        for (let measurementTypeIndex = 0; measurementTypeIndex < MEASUREMENTS_COUNT; ++measurementTypeIndex) {
            const useShifted = !!array[measurementTypeIndex * MEASUREMENTS_BLOCK_SIZE + HeaderFields.USING_SHIFTED]!
            const samples = array[measurementTypeIndex * MEASUREMENTS_BLOCK_SIZE + HeaderFields.SAMPLES_PER_SESSION]!
            const offset = measurementTypeIndex * MEASUREMENTS_BLOCK_SIZE + (useShifted ? DrawPhase.SIZE : 0) + HeaderFields.SIZE

            for (let drawValueIndex = 0; drawValueIndex < DrawPhase.SIZE; ++drawValueIndex) {
                const valueIndex = drawValueIndex + offset

                const value = array[valueIndex]! / samples

                const cell = allCells[drawValueIndex * MEASUREMENTS_COUNT + measurementTypeIndex]!
                cell['textContent'] = formatNumber(value)
            }

            allCells[(DrawPhase.SIZE) * MEASUREMENTS_COUNT + measurementTypeIndex]!['textContent'] = samples.toFixed()
            allCells[(DrawPhase.SIZE + 1) * MEASUREMENTS_COUNT + measurementTypeIndex]!['textContent'] = Math.round(samples * 1000 / REQUESTED_MEASUREMENTS[measurementTypeIndex]!.intervalMilliseconds).toString()
        }
    }, 100)
}