export interface Publisher {

    currentState(): any
    getChennelName(): string
    setState(nextState: any, payload: any): any[]

}

export interface Payload {
    type: string,
    payload: any
}

export type Handler = (initialState?: any, payload?: Payload) => any