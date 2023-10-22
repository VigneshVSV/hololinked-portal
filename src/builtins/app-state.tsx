import { Logger } from "../utils/logger";
import { ApplicationState } from "../mobx/state-container"

export const globalAppState = new ApplicationState({})
  
export const RootLogger = new Logger('root', "DEBUG")

export type AppState = {
    globalState : ApplicationState
}


