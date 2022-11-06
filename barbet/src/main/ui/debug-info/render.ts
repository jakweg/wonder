import { map, observeField } from '@utils/state/subject'
import { DrawPhase } from '@utils/worker/debug-stats/draw-phase'
import { newStatsObject, StatField } from '@utils/worker/debug-stats/render'
import { REQUESTED_MEASUREMENTS } from '@utils/worker/debug-stats/requsted-measurements'
import { KeyValueText, TimesTable } from '.'

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
