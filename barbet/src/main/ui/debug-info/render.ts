import { KeyValueText } from "."
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
    createElement('td', theadTr,)['textContent'] = 'ms'

    const tbody = createElement('tbody', table,)

    const formatNumber = (value: number) => `${value | 0}`.padStart(2, '0') + '.' + (((value * 100) % 100) | 0).toString().padEnd(2, '0')
    const observeTimeField = (field: StatField) => map(observeField(stats, field), formatNumber)
    const StatRow = (title: string, field: StatField) => {
        const row = createElement('tr', tbody,)
        createElement('td', row,)['textContent'] = title
        const element = createElement('td', row,)
        observeTimeField(field).on(value => element['textContent'] = value)
    }

    StatRow(`HandleInputs`, StatField.DrawTime_HandleInputs)
    StatRow(`LockMutex`, StatField.DrawTime_LockMutex)
    StatRow(`UpdateWorld`, StatField.DrawTime_UpdateWorld)
    StatRow(`PrepareRender`, StatField.DrawTime_PrepareRender)
    StatRow(`GPUUpload`, StatField.DrawTime_GPUUpload)
    StatRow(`Draw`, StatField.DrawTime_Draw)
    StatRow(`DrawForMousePicker`, StatField.DrawTime_DrawForMousePicker)
}