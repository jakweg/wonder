import { bind } from "../util/worker/message-types/render-helper";

const { sender, receiver } = await bind()

console.log('I am ALIVE!');
