import { curry } from 'lodash'
import { Publisher, Handler, Payload } from './interfaces'

/**
 * Implementation of the Publisher interface
 * Maintains state for a particular channel and calculates the nextState
 */
class PublisherImpl implements Publisher {
    
    private channelName: string
    private latestUpdate: any
    private state: any

    constructor(
        channelName: string,
        initState: any
    ) {
        this.channelName = channelName
        this.state = initState
        this.latestUpdate = initState
    }
    
    /**
     * Return the updated state along with the last action that made such a state possible
     */
    private publish() {
        return [this.latestUpdate, this.state]
    }
  
    /**
     * Get current state 
     */
    currentState() {
        return this.state
    }

    /**
     * Get the name of the channel the publisher is maintaining state of
     */
    getChennelName(): string {
        return this.channelName
    }

    /**
     * Set the state and call publish
     * @param nextState next calculated state
     * @param payload payload that caused nextstate
     */
    setState(nextState: any, payload: any) {
        this.latestUpdate = payload
        this.state = nextState
        return this.publish()
    }
}

/**
 * Expose a very simple API for the Publisher
 * 1. Specify the channelName and the handler for the channel
 * 2. Resturn a publisher function that takes one parameter, i.e, the payload and 
 * encapsulates the calculating and the setting of state
 */
function exposePublisher() {

    return curry((chan: string, handler: Handler) => {
        // const curriedHandler = curry(handler)
        let initState = handler()
        const publisher = new PublisherImpl(chan, initState)
        
        return (payload?: Payload) => {
            if (!payload) {
                return initState
            }
            initState = handler(initState, payload)
            return publisher.setState(initState, payload)
        }
    })

}

export default exposePublisher()