import { Model } from "./model"

export const enum CubePart {
    VertexTop = 0b0001,
    VertexBottom = 0b0000,
    MaskVertexPositionVertical = 0b0001,
}

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

    // const calculateNormals = (index: number) => {
    //     return (vertexCoordinates[index * 3 + 0]! < 0 ? 0b000000 : 0b110000)
    //         | (vertexCoordinates[index * 3 + 1]! < 0 ? 0b000000 : 0b001100)
    //         | (vertexCoordinates[index * 3 + 2]! < 0 ? 0b000000 : 0b000011)
    // }

    partId = (partId & 0b1111) << 4
    const vertexData = [
        [partId | CubePart.VertexBottom, 0b00_01_00_01, colors[0]], // bottom
        [partId | CubePart.VertexBottom, 0b00_01_01_00, colors[1]], // front
        [partId | CubePart.VertexBottom, 0b00_11_01_01, colors[2]], // right
        [partId | CubePart.VertexBottom, 0b00_01_01_11, colors[3]], // back
        [partId | CubePart.VertexTop, 0b00_01_01_01, 0],
        [partId | CubePart.VertexTop, 0b00_01_11_01, colors[4]], // top
        [partId | CubePart.VertexTop, 0b00_01_01_01, 0],
        [partId | CubePart.VertexTop, 0b00_00_01_01, colors[5]], // left
    ].flatMap(([top, normal, color,], i) => [((color ?? 0) >> 16) & 0xFF, ((color ?? 0) >> 8) & 0xFF, ((color ?? 0) >> 0) & 0xFF, normal, top,])

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
        vertexDataArray: new Uint8Array(vertexData as number[]),
    }
}
