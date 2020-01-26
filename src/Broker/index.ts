import Publisher from '../PublisherAPI'
import { Broker, Subscription, PublishMessage, ReceiveMessage, ReceiverFunc, ChannelMeta } from './interfaces'
import { Handler } from '../PublisherAPI/interfaces';

// TS does not support symbols as keys yet
interface Channels {
    [name: string]: ChannelMeta
}

interface BrokerAction {
    action: "ADDED" | "REMOVED",
    channel: string
}

/**
 * Implementation of the broker interface 
 */
class BrokerImpl implements Broker {

    private channels: Channels
    private lastBrokerAction?: BrokerAction
    private brokerSubs: ReceiverFunc[]

    constructor() {
        this.channels = {}
        this.brokerSubs = []
    }

    /**
     * Generate a subscription object - containse necessary methods to perform actions on a channel
     * 1. publish -> Publish a message over a channel
     * 2. close -> Close a channel
     * 3. register -> Listen on a channel
     * 4. unRegister -> Stop listening
     * @param channel The channel to generate subscription for
     */
    private genSubscription(channel: string): Subscription {
        const context = this;
        return {
            channel,
            publish: (message: PublishMessage) => context.publisherHandler(channel, message),
            close: () => context.closeChannel(channel),
            register: (receiver) => {
                context.subscriptionHandler(channel, receiver)
            },
            unRegister: (receiver) => {
                context.channels[channel].listeners.filter(val => val !== receiver)
            }
        }
    }

    /**
     * Close a channel, does the following :
     * 1. Broadcast all the subscribers that the channel is closed
     * 2. Check if the channel is private
     *      2.1 If the channel is private do nothing and exit
     *      2.2 If the channel is not private publish a broker update that the broker deleted a channel
     * @param channel The channel to be closed
     */
    private closeChannel(channel: string) {
        
        this.broadcast({
            type: "CHANNEL_MESSAGE",
            channelState: this.channels[channel].lastBroadcast[1],
            latestUpdate: this.channels[channel].lastBroadcast[0],
            currentState: "CLOSED"
        }, channel)

        const { isPrivate } = this.channels[channel]

        delete this.channels[channel]

        if (!isPrivate) {
            this.lastBrokerAction = {
                channel,
                action: "REMOVED",
            }

            this.broadcast({
                type: "BROKER_UPDATE",
                channelState: "OPEN",
                currentState: Object.keys(this.channels).filter(key => this.channels[key].isPrivate === false),
                latestUpdate: this.lastBrokerAction
            }, "self")
        }
    }

    /**
     * Get the next state from the publisher and broadcast it over the channel
     * @param channel Channel to broadcast over
     * @param message Message for getting next state
     */
    private async publisherHandler(channel: string, message: PublishMessage) {
        const { publisher } = this.channels[channel]
        const out = publisher(message)

        this.broadcast({
            type: "CHANNEL_MESSAGE",
            channelState: "OPEN",
            latestUpdate: out[0],
            currentState: out[1]
        }, channel)
    }

    /**
     * Handle a subscriptions event for a channel
     * 
     * When a subscriber subscribes to a channel
     * it gets the channels last broadcast so that it can keep up with other subscribers
     * 
     * @param channel channel to subscribe to
     * @param receiverFunc function to call on channel update
     */
    private subscriptionHandler(channel: string, receiverFunc: ReceiverFunc) {
        this.channels[channel].listeners.push(receiverFunc)
        receiverFunc({
            channelState: "OPEN",
            currentState: this.channels[channel].lastBroadcast[1] || this.channels[channel].publisher(),
            latestUpdate: this.channels[channel].lastBroadcast[0] || this.channels[channel].publisher(),
            type: "CHANNEL_MESSAGE"
        }, receiverFunc)
    }

    /**
     * A function used to broadcast a message either over a channel or over all channels
     * 
     * @param message message to broadcast 
     * @param channel [Optional] if specified - its the channel to broadcast over if not broadcasts over all channels
     */
    private async broadcast(message: ReceiveMessage, channel?: string) {
        if (!channel) {
            Object.keys(this.channels).forEach(key => {
                this.broadcast(message, key)
            })
            return
        } 
            
        switch(message.type) {
            case "CHANNEL_MESSAGE":
            case "BROADCAST":
                const {listeners} = this.channels[channel]
                listeners.forEach(val => val(message, val))
                this.channels[channel].lastBroadcast = [ message.latestUpdate, message.currentState ]
                break
            case "BROKER_UPDATE":
                this.brokerSubs.forEach(val => {
                    val(message, val)
                })
                break
        }
    }

    /**
     * Returns a subscription object if channel exists
     * @param channel Channel to subscribe to
     */
    subscribe(channel: string): Subscription | boolean {
        if (!this.channels[channel]) {
            return false
        }
        return this.channels[channel].subscription
    }   
    
    /**
     * Broadcast a message to all channels
     * @param message 
     */
    customBroadcast(message: ReceiveMessage) {
        this.broadcast(message)
    }

    /**
     * Subscribe to updates from broker
     * All broker updates have message type "BROKER_UPDATE"
     * @param func 
     */
    subscribeToBrokerUpdates(func: ReceiverFunc) {
        this.brokerSubs.push(func)
        this.broadcast({
            type: "BROKER_UPDATE",
            channelState: "OPEN",
            currentState: Object.keys(this.channels).filter(key => this.channels[key].isPrivate === false),
            latestUpdate: this.lastBrokerAction
        }, "self")
    }

    /**
     * Create a new channel and returns its subscription object
     * Returns existing channel if a channel with same name already exists
     * 
     * @param channel Name of the channel 
     * @param stateHandler A reducer function that decides how the state is mutated
     * @param broadcastCreation Specify whether to broadcast the channel creation
     * @param isPrivate Specify if a channel is private - A private channel won't broadcast its creation or appear in any broker updates
     */
    createChannel(channel: string, stateHandler: Handler, broadcastCreation = true, isPrivate = false): Subscription {

        if (this.channels[channel]) {
            return this.channels[channel].subscription
        }
        
        // 1. Create a subscription
        const subscription = this.genSubscription(channel)

        // 2. Create a publisher
        const publisher = Publisher(channel)(stateHandler)

        // 3. Register the new Channel
        this.channels[channel] = { publisher, isPrivate, subscription: subscription, listeners: [], lastBroadcast: [] }

        
        if (broadcastCreation && !isPrivate) {
            this.broadcast({
                type: "CHANNEL_CREATION_MESSAGE",
                channelState: "OPEN",
                latestUpdate: channel,
                currentState: Object.keys(this.channels)
            })
        }

        if (!isPrivate) {
            this.lastBrokerAction = {
                action: "ADDED",
                channel: channel
            }
        }
    
        return subscription
    }

    
}

/**
 * Break down class into functional constructs for simplicity and maintaining a singleton for Broker
 */
function functional() {
    const broker = new BrokerImpl()
    const sub = (channel: string) => {
        return broker.subscribe(channel)
    }
    const createChan = (channel: string, stateHandler: Handler): Subscription => {
        const subscription = broker.createChannel(channel, stateHandler)
        return subscription
    }
    const broadcast = (message: ReceiveMessage) => {
        return broker.customBroadcast(message)
    }
    const subscribeBroker = (func: ReceiverFunc) => {
        return broker.subscribeToBrokerUpdates(func)
    }

    return {sub, createChan, broadcast, subscribeBroker}
}

const toExport = functional()

export const subscribe = toExport.sub
export const createChannel = toExport.createChan
export const customBroadcast = toExport.broadcast
export const subscribeToBrokerUpdates = toExport.subscribeBroker