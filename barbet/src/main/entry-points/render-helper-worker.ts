import { Task, TaskResult, TaskType } from "../3d-stuff/pipeline/work-scheduler";
import { World, WORLD_CHUNK_SIZE } from "../game-state/world/world";
import { buildChunkMesh } from "../game-state/world/world-to-mesh-converter";
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

let gotWorld: World | null = null

receiver.on(ToWorker.SetWorld, received => {
    gotWorld = World.fromReceived(received)
})

receiver.on(ToWorker.ExecuteTask, ({ id, task }) => {
    const world = gotWorld
    if (world == undefined)
        throw new Error()

    let result
    switch (task.type) {
        case TaskType.CreateChunkMesh:
            result = executeCreateChunkMesh(world, task)
            break
        default:
            throw new Error()
    }

    sender.send(FromWorker.TaskDone, {
        id, task: result
    })
})

const executeCreateChunkMesh = (world: World, task: Task): TaskResult => {
    if (task.type !== TaskType.CreateChunkMesh) throw new Error()

    const i = (task.chunkIndex / world.size.chunksSizeX) | 0
    const j = (task.chunkIndex % world.size.chunksSizeX) | 0

    mutex.enterForRenderHelper(id)
    const mesh = buildChunkMesh(world, i, j, WORLD_CHUNK_SIZE)
    mutex.exitRenderHelper(id)

    return {
        type: TaskType.CreateChunkMesh,
        chunkIndex: task.chunkIndex,
        indicesBuffer: mesh.indices.buffer as SharedArrayBuffer,
        vertexBuffer: mesh.vertexes.buffer as SharedArrayBuffer,
    }
}