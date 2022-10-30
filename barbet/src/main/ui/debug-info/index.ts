import { COMMIT_HASH } from "../../util/build-info"
import CONFIG from "../../util/persistance/observable-settings"
import { constant, observeField, Subject } from "../../util/state/subject"
import animatedVisibility from "../preferences/animated-visibility"
import { createElement } from "../utils"
import Render from "./render"
import Update from "./update"

import { REQUESTED_MEASUREMENTS } from "../../util/worker/debug-stats/draw-phase"
import { HeaderFields } from "../../util/worker/debug-stats/time-meter"
import './style.css'

export default (parent: HTMLElement) => {
    const visible = observeField(CONFIG, 'debug/show-info')
    const [root] = animatedVisibility(createElement('div', parent, '_css_debug-info _css_debug-info-gone'), visible, [])
    setTimeout(() => {
        root['classList']['remove']('_css_debug-info-gone')
    }, 500);

    KeyValueText(root, `Next wonder`, constant(`#${COMMIT_HASH}`))

    const renderStats = Render(root)
    const updateStats = Update(root)

    return {
        updateRenderValues(values: any) {
            renderStats.replaceFromArray(values)
        },
        updateUpdateValues(values: any) {
            updateStats.replaceFromArray(values)
        },
    }
}

export const KeyValueText = (div: HTMLElement, keyText: string, value: Subject<string>) => {
    const p = createElement('p', div, '_css_key_value_p')
    const keySpan = createElement('span', p,)
    const valueSpan = createElement('span', p,)
    keySpan['textContent'] = keyText
    value.on(value => valueSpan['textContent'] = value)
}

export interface MeasurementType {
    intervalMilliseconds: number
    isSum: boolean
}

export const TimesTable = <T>(root: HTMLElement,
    tableTitle: string,
    totalSessionsTitle: string,
    measurements: MeasurementType[],
    valueTitles: string[],
    statsCount: number,
    stats: () => Float32Array) => {
    const table = createElement('table', root,)

    const theadTr = createElement('tr', createElement('thead', table,),)
    createElement('td', theadTr,)['textContent'] = tableTitle

    const tbody = createElement('tbody', table,)
    const MEASUREMENTS = measurements.map(m => ({
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
    for (const title of valueTitles) {
        StatRow(title)
    }
    StatRow(totalSessionsTitle)

    const sessionIndexes: number[] = REQUESTED_MEASUREMENTS.map(() => -1)
    let frameId: ReturnType<typeof requestAnimationFrame>
    const update = () => {
        const array = stats()
        if (array['length'] !== 0) {
            const MEASUREMENTS_BLOCK_SIZE = (statsCount * 2 + HeaderFields.SIZE);
            for (let measurementIndex = 0; measurementIndex < MEASUREMENTS_COUNT; ++measurementIndex) {
                const isSum = !!MEASUREMENTS[measurementIndex]!.isSum;
                const sessionIndex = array[measurementIndex * MEASUREMENTS_BLOCK_SIZE + HeaderFields.SESSION_INDEX]!;
                if (sessionIndexes[measurementIndex]! === sessionIndex) continue
                sessionIndexes[measurementIndex] = sessionIndex

                const useShifted = sessionIndex & 0b1
                const samples = array[measurementIndex * MEASUREMENTS_BLOCK_SIZE + HeaderFields.SAMPLES_PER_SESSION]!
                const offset = measurementIndex * MEASUREMENTS_BLOCK_SIZE + (useShifted ? statsCount : 0) + HeaderFields.SIZE

                for (let drawValueIndex = 0; drawValueIndex < statsCount; ++drawValueIndex) {
                    const valueIndex = drawValueIndex + offset

                    const value = isSum ? array[valueIndex]! / samples : array[valueIndex]!

                    const cell = allCells[drawValueIndex * MEASUREMENTS_COUNT + measurementIndex]!
                    cell['textContent'] = formatNumber(value)
                }

                allCells[(statsCount) * MEASUREMENTS_COUNT + measurementIndex]!['textContent'] = Math.round(samples * MEASUREMENTS[measurementIndex]!.interval).toString()
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