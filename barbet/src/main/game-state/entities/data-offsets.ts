
export const enum DataOffsetIds {
    ID,
    Traits,
    SIZE
}

export const enum DataOffsetPositions {
    PositionX,
    PositionY,
    PositionZ,
    SIZE
}


export const enum DataOffsetDrawables {
    SIZE = 10,
    ModelId = SIZE - 1,
    PoseId = SIZE - 2,
}

export const enum DataOffsetWithActivity {
    CurrentId,
    StartTick,
    MemoryPointer,
    SIZE
}

export const enum DataOffsetItemHoldable {
    ItemId,
    SIZE
}

export const enum DataOffsetInterruptible {
    InterruptType,
    ValueA,
    ValueB,
    ValueC,
    SIZE
}

export const enum DataOffsetBuildingData {
    TypeId,
    ProgressPointsToFull,
    SIZE
}
