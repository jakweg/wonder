import imported_0 from './entity/slime'
/*
 * THIS FILE WAS AUTOGENERATED, DO NOT CHANGE IT
 * Any change you make here will be overwritten by a compiler
 * edit appropriate .2bc.json file instead
 */
export const enum ModelId {
  Slime,
  SIZE,
}
export default ModelId
export const getModelPrototype = (value: ModelId) => {
  /* This file was autogenerated, don't change */
  switch (value) {
    case ModelId.Slime:
      return imported_0
    default:
      throw new Error()
  }
}
