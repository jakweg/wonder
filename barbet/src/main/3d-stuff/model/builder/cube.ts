import { Model } from "./model"

export const newCubeModel = (color: number): Model<Uint8Array> => {
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

    const vertexData = [
        0, 0, 0, 0,
        1, 1, 1, 1,
    ].flatMap(e => [(color >> 16) & 0xFF, (color >> 8) & 0xFF, (color >> 0) & 0xFF, e])

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
