import { createChannel, subscribe, customBroadcast } from './Broker'

function handleUpdates(initState={ counter: 0 }, payload: { type: string, payload: any } | undefined) {
    if (!payload) {
        return initState
    }

    switch (payload.type) {
        case "INCR":
            let { counter } = initState
            counter += payload.payload
            const message = `UPDATED: ${counter} number of times`
            return { ...initState, counter, [counter]: message}
        default:
            return initState
    }
}

function listen() {
    const subs = subscribe(("POINTLESS_COUNTER"))
    if (typeof subs !== 'boolean') {
        subs.register((message) => {
            if (message.type === "BROADCAST") {
                console.log("POINTLESS COUNTER GOT A BROADCAST: ", message)
                return
            }
            console.log(message)
        })
    }
}

function slowUpdates() {
    const subscription = createChannel("POINTLESS_COUNTER", handleUpdates)
    setInterval(() => {
        subscription.publish({
            type: "INCR",
            payload: 1
        })
    }, 5000)
}

function sillyBroadcasts() {
    setInterval(() => {
        customBroadcast({
            type: "BROADCAST",
            channelState: "OPEN",
            currentState: undefined,
            latestUpdate: "HEY! MAYBE SAY THE USER IS LOGGED IN ? AND LET THE CHANNELS REACT :?"
        })
    }, 8000)
}



sillyBroadcasts()
slowUpdates()
listen()
