import { KeyValueText, TimesTable } from '.'
import { map, observeField } from '../../util/state/subject'
import { DrawPhase } from '../../util/worker/debug-stats/draw-phase'
import { newStatsObject, StatField } from '../../util/worker/debug-stats/render'
import { REQUESTED_MEASUREMENTS } from '../../util/worker/debug-stats/requsted-measurements'

export default (root: HTMLElement) => {
  const stats = newStatsObject()

  KeyValueText(root, `Renderer`, observeField(stats, StatField.RendererName))
  KeyValueText(
    root,
    `Visible chunks`,
    map(observeField(stats, StatField.VisibleChunksCount), e => `${e}`),
  )
  KeyValueText(
    root,
    `Draw calls`,
    map(observeField(stats, StatField.DrawCallsCount), e => `${e}`),
  )

  const names = [`HandleInputs`, `LockMutex`, `UpdateWorld`, `PrepareRender`, `GPUUpload`, `Draw`, `DrawForMousePicker`]

  TimesTable(
    root,
    'Render phase',
    'FPS',
    REQUESTED_MEASUREMENTS,
    names,
    DrawPhase.SIZE,
    () => new Float32Array(stats.get(StatField.DrawTimesBuffer)),
  )

  return stats
}
