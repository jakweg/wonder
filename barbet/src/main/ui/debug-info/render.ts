import { KeyValueText } from "."
import CONFIG from "../../util/persistance/observable-settings"
import { map, observeField } from "../../util/state/subject"
import { DrawPhase, REQUESTED_MEASUREMENTS } from "../../util/worker/debug-stats/draw-phase"
import { newStatsObject, StatField } from "../../util/worker/debug-stats/render"
import { HeaderFields } from "../../util/worker/debug-stats/time-meter"
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
    createElement('td', theadTr,)['textContent'] = 'Render phase'

    const tbody = createElement('tbody', table,)
    const MEASUREMENTS = REQUESTED_MEASUREMENTS.map(m => ({
        title: `${m.isSum ? 'AVG' : 'TOP'} ${m.intervalMilliseconds / 1000}s`,
        isSum: m.isSum,
        interval: 1000 / m.intervalMilliseconds,
    }))
    const MEASUREMENTS_COUNT = MEASUREMENTS['length']

    for (const m of MEASUREMENTS) {
        createElement('td', theadTr,)['textContent'] = m.title
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
    StatRow(`FPS`)

    const sessionIndexes: number[] = REQUESTED_MEASUREMENTS.map(() => -1)
    let frameId: ReturnType<typeof requestAnimationFrame>
    const update = () => {
        const array = new Float32Array(stats.get(StatField.DrawTimesBuffer))
        if (array['length'] !== 0) {
            const MEASUREMENTS_BLOCK_SIZE = (DrawPhase.SIZE * 2 + HeaderFields.SIZE);
            for (let measurementIndex = 0; measurementIndex < MEASUREMENTS_COUNT; ++measurementIndex) {
                const isSum = !!MEASUREMENTS[measurementIndex]!.isSum;
                const sessionIndex = array[measurementIndex * MEASUREMENTS_BLOCK_SIZE + HeaderFields.SESSION_INDEX]!;
                if (sessionIndexes[measurementIndex]! === sessionIndex) continue
                sessionIndexes[measurementIndex] = sessionIndex

                const useShifted = sessionIndex & 0b1
                const samples = array[measurementIndex * MEASUREMENTS_BLOCK_SIZE + HeaderFields.SAMPLES_PER_SESSION]!
                const offset = measurementIndex * MEASUREMENTS_BLOCK_SIZE + (useShifted ? DrawPhase.SIZE : 0) + HeaderFields.SIZE

                for (let drawValueIndex = 0; drawValueIndex < DrawPhase.SIZE; ++drawValueIndex) {
                    const valueIndex = drawValueIndex + offset

                    const value = isSum ? array[valueIndex]! / samples : array[valueIndex]!

                    const cell = allCells[drawValueIndex * MEASUREMENTS_COUNT + measurementIndex]!
                    cell['textContent'] = formatNumber(value)
                }

                allCells[(DrawPhase.SIZE) * MEASUREMENTS_COUNT + measurementIndex]!['textContent'] = Math.round(samples * MEASUREMENTS[measurementIndex]!.interval).toString()
            }

        }
        frameId = requestAnimationFrame(update)
    }

    CONFIG.observe('debug/show-info', show => {
        if (show)
            frameId = requestAnimationFrame(update)
        else
            cancelAnimationFrame(frameId)
    })
}