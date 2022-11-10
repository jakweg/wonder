
export enum ModelAttributeType {
    Uint,
    Vec3,
    UVec3,
}

export const getGlslNameByType = (type: ModelAttributeType) => {
    switch (type) {
        case ModelAttributeType.Uint:
            return 'uint'
        case ModelAttributeType.UVec3:
            return 'uvec3'
        case ModelAttributeType.Vec3:
            return 'vec3'
        default:
            throw new Error()
    }
}

export const getBytesCountByType = (type: ModelAttributeType) => {
    switch (type) {
        case ModelAttributeType.Uint:
            return 1
        case ModelAttributeType.UVec3:
        case ModelAttributeType.Vec3:
            return 3
        default:
            throw new Error()
    }
}