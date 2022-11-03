
export const enum TransformType {
    Scale,
    Translate,
    RotateX,
    RotateY,
    RotateZ,
}

export type StaticTransform = never
    | { type: TransformType.Translate, by: [number, number, number] }
    | { type: TransformType.Scale, by: [number, number, number] | number }
    | { type: TransformType.RotateX, by: number }
    | { type: TransformType.RotateY, by: number }
    | { type: TransformType.RotateZ, by: number }

type DynamicTransformResolvable = null | string | number

export type DynamicTransform =
    (
        { type: TransformType.Translate, by: [DynamicTransformResolvable, DynamicTransformResolvable, DynamicTransformResolvable] }
        | { type: TransformType.Scale, by: [DynamicTransformResolvable, DynamicTransformResolvable, DynamicTransformResolvable] | DynamicTransformResolvable }
        | { type: TransformType.RotateY | TransformType.RotateX | TransformType.RotateZ, by: DynamicTransformResolvable, normalToo?: true }
    )
    & { beforeBlock?: string, afterBlock?: string }
