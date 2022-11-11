import ModelAttributeType from "@3d/model/builder/model-attribute-type";

export const modelAttributes = {
//   'Position': ModelAttributeType.Vec3,
  'SideColor':ModelAttributeType.Vec3_N,
  'Normal':ModelAttributeType.Uint,
  'Flags':ModelAttributeType.Uint,
} satisfies {[key: string]: ModelAttributeType}
