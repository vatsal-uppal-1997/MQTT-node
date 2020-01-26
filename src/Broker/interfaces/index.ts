import { Payload, Handler } from "../../PublisherAPI/interfaces";


export interface PublishMessage extends Payload { }

export interface ReceiveMessage {
    type: "CHANNEL_CREATION_MESSAGE" | "CHANNEL_MESSAGE" | "BROADCAST" | "BROKER_UPDATE"
    latestUpdate: any,
    currentState: any,
    channelState: "OPEN" | "CLOSED"
}

export type ReceiverFunc = (message: ReceiveMessage, selfRef: ReceiverFunc) => any

export interface Subscription {
    channel: string,
    publish: (message: PublishMessage) => any
    close: () => any
    register: (func: ReceiverFunc) => any
    unRegister: (func: ReceiverFunc) => any
}

export interface Broker {
    
    subscribe: (channel: string) => Subscription | boolean
    createChannel: (channel: string, stateHandler: Handler) => Subscription
    customBroadcast: (message: ReceiveMessage) => any
    subscribeToBrokerUpdates: (func: ReceiverFunc) => any

}

export interface ChannelMeta {
    publisher: (payload?: Payload) => any[]
    subscription: Subscription
    lastBroadcast: any[]
    listeners: ReceiverFunc[]
    isPrivate: boolean
}