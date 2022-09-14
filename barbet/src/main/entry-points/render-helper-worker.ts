import { dispatch, Environment } from "../3d-stuff/pipeline/scheduler-tasks";
import { World } from "../game-state/world/world";
import { gameMutexFrom } from "../util/game-mutex";
import { bind, FromWorker, ToWorker } from "../util/worker/message-types/render-helper";

const { sender, receiver } = await bind()

const handleInitials = async () => {
    const initials = await receiver.await(ToWorker.SetInitials)
    return {
        mutex: gameMutexFrom(initials.mutex),
        id: initials.id,
    }
}

const { mutex, id } = await handleInitials()

let env: Environment | null = null

receiver.on(ToWorker.SetWorld, received => {
    env = {
        world: World.fromReceived(received),
        mutexEnter: () => mutex.enterForRenderHelper(id),
        mutexExit: () => mutex.exitRenderHelper(id),
    }
})

receiver.on(ToWorker.ExecuteTask, async ({ id, task }) => {
    if (env == undefined)
        throw new Error()

    sender.send(FromWorker.TaskDone, {
        id, task: await dispatch(env, task)
    })
})