export enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

export const initialState = {
    'endpoint': null as (null | string),
    'connection-status': ConnectionStatus.Disconnected
};
