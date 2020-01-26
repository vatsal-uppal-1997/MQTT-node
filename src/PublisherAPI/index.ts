import { curry } from 'lodash'
import { Publisher, Handler, Payload } from './interfaces'

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
    
    private publish() {
        return [this.latestUpdate, this.state]
    }
  
    currentState() {
        return this.state
    }
    getChennelName(): string {
        return this.channelName
    }
    setState(nextState: any, payload: any) {
        this.latestUpdate = payload
        this.state = nextState
        return this.publish()
    }
}

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