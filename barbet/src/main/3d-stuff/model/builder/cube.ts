import { Model } from "./model"

export const newCubeModel = (partId: number, color: number): Model<Uint8Array> => {
    return newCubeModel2(partId, [color, color, color, color, color, color])
}

export const newCubeModel2 = (partId: number, colors: [number, number, number, number, number, number]): Model<Uint8Array> => {
    const vertexCoordinates: Array<number> = [
        -0.5, -0.5, -0.5,
        0.5, -0.5, -0.5,
        0.5, -0.5, 0.5,
        -0.5, -0.5, 0.5,
        -0.5, 0.5, -0.5,
        0.5, 0.5, -0.5,
        0.5, 0.5, 0.5,
        -0.5, 0.5, 0.5,
    ]

    partId = (partId & 0b1111) << 4
    const vertexData = [
        [partId | 0b0000, colors[0]],
        [partId | 0b0000, colors[1]],
        [partId | 0b0000, colors[2]],
        [partId | 0b0000, colors[3]],
        [partId | 0b0001, 0],
        [partId | 0b0001, colors[4]],
        [partId | 0b0001, 0],
        [partId | 0b0001, colors[5]],
    ].flatMap(([top, color], i) => [((color ?? 0) >> 16) & 0xFF, ((color ?? 0) >> 8) & 0xFF, ((color ?? 0) >> 0) & 0xFF, top])

    const indices: number[] = [
        // bottom
        1, 2, 0,
        2, 3, 0,
        // front
        0, 4, 1,
        4, 5, 1,
        // right side
        1, 5, 2,
        5, 6, 2,
        // left side
        0, 3, 7,
        4, 0, 7,
        // back
        2, 6, 3,
        6, 7, 3,
        // top
        4, 7, 5,
        7, 6, 5,
    ]
    return {
        vertexPoints: new Float32Array(vertexCoordinates),
        indices: new Uint16Array(indices),
        vertexDataArray: new Uint8Array(vertexData),
    }
}
