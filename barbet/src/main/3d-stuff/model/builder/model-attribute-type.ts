import { AttrType } from "@3d/gpu-resources/program"

export enum ModelAttributeType {
    Uint,
    Vec3_N,
    UVec3_2,
}

export const getGlslNameByType = (type: ModelAttributeType) => {
    switch (type) {
        case ModelAttributeType.Uint:
            return 'uint'
        case ModelAttributeType.UVec3_2:
            return 'uvec3'
        case ModelAttributeType.Vec3_N:
            return 'vec3'
        default:
            throw new Error()
    }
}

export const getCountByType = (type: ModelAttributeType) => {
    switch (type) {
        case ModelAttributeType.Uint:
            return 1
        case ModelAttributeType.UVec3_2:
        case ModelAttributeType.Vec3_N:
            return 3
        default:
            throw new Error()
    }
}

export const shouldNormalize = (type: ModelAttributeType) => {
    switch (type) {
        case ModelAttributeType.UVec3_2:
        case ModelAttributeType.Uint:
            return false
        case ModelAttributeType.Vec3_N:
            return true
        default:
            throw new Error()
    }
}

export const getAttrTypeByType = (type: ModelAttributeType): AttrType => {
    switch (type) {
        case ModelAttributeType.Vec3_N:
        case ModelAttributeType.Uint:
            return AttrType.UByte
        case ModelAttributeType.UVec3_2:
            return AttrType.UShort
        default:
            throw new Error()
    }
}