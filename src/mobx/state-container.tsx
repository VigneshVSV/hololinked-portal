// Internal & 3rd party functional libraries
import { createContext } from 'react';
import { makeObservable, observable, action } from 'mobx';
import axios from 'axios';
// custom functional libraries
import { ScriptImporterData, remoteObjectWizardData } from '../builtins/http-server-wizard/remote-object-wizard-data-container';
import { ComponentState } from '@hololinked/mobx-render-engine/state-container';
import { StateManager } from '@hololinked/mobx-render-engine/state-manager';
import { updateObjectFromString } from '../utils';
// Internal & 3rd party component libraries
// Custom component libraries



export type ApplicationData = {
    loggedIn? : boolean  
    loginFooter? : string
    footerLink?  : string
    hostServer? : string 
}

export type ApplicationSettings = {
    dashboards : {
        deleteWithoutAsking : boolean 
        showRecentlyUsed : boolean 
        use : boolean
    }
    login : {
        footer : string
        footerLink  : string
        displayFooter : boolean
    }
    servers : {
        allowHTTP : boolean
        trusted : string[]
    } 
    remoteObjectViewer : {
        console : {
            stringifyOutput : boolean 
            defaultMaxEntries : number 
            defaultWindowSize : number
            defaultFontSize : number
        }
        logViewer : {
            defaultMaxEntries : number 
            defaultWindowSize : number
            defaultFontSize : number
            defaultInterval : number
        }
    }
    others : {
        WOTTerminology : boolean
    }
}

export const defaultAppSettings : ApplicationSettings = {
    dashboards : {
        deleteWithoutAsking : true,
        showRecentlyUsed : true,
        use : false
    },
    login : {
        footer :  '',
        footerLink  : '',
        displayFooter :  false,
    },
    servers : {
        allowHTTP : true,
        trusted : []
    },
    remoteObjectViewer : {
        console : {
            stringifyOutput : false,
            defaultMaxEntries : 10,
            defaultWindowSize : 500,
            defaultFontSize : 16,
        },
        logViewer : {
            defaultMaxEntries : 10,
            defaultWindowSize : 500,
            defaultFontSize : 16,
            defaultInterval : 2
        }
    },
    others : {
        WOTTerminology : false
    }
}


export class PythonServer {
    hostname : string 
    IPAddress : string 
    port : number     
    type : string 
    qualifiedIP : string
    https : boolean 
    _remoteObjectInfo : Array<{
        instance_name : string
        class_name : string, 
        script : string
    }>
    remoteObjectState : any

    constructor(info : any) {
        this.hostname = info.hostname 
        this.IPAddress = info.IPAddress 
        this.port = info.port 
        this.type = info.type 
        this.https = info.https
        this.qualifiedIP = info.qualifiedIP 
        this._remoteObjectInfo = info.remoteObjectInfo
        this.remoteObjectState = info.remoteObjectState
    }

    get remoteObjects() {
        if(this._remoteObjectInfo)
            return this._remoteObjectInfo.map((info) => {return info.instance_name})
        return []
    }

    get remoteObjectsInfo() {
        // if(this._remoteObjectInfo)
        //     return this._remoteObjectInfo.reduce((totalInfo : any, currentInfo) => {
        //             totalInfo[currentInfo.instance_name] = currentInfo
        //             return totalInfo}, {}) 
        return this._remoteObjectInfo
    }

    get remoteObjectsClasses() {
        if(this._remoteObjectInfo)
            return this._remoteObjectInfo.filter((info) => (info.class_name !== 'EventLoop' && info.class_name !== 'HTTPServerUtilities'))
        return []
    }

    get eventloops() {
        if(this._remoteObjectInfo)
            return this._remoteObjectInfo.filter((info) => info.class_name === 'EventLoop').map((info) => {return info.instance_name})
        return []
    }
}


const PRIMARY_HOST = 'PRIMARY_HOST'

export class ApplicationState {

    appsettings : ApplicationSettings
    primaryHostServer : string | null
    servers  : Array<PythonServer>
    HTTPServerWizardData: { remoteObjectWizardData: remoteObjectWizardData }
    dashboardStateManager : StateManager | null
    dashboardURL : string
    setGlobalLocation : Function | null
    _loggedIn : boolean

    constructor() {
        this.primaryHostServer = null
        this.appsettings = defaultAppSettings
        this.servers = []
        this.HTTPServerWizardData = {
            remoteObjectWizardData : new remoteObjectWizardData({
                id : null, 
                scriptImporterData : new ScriptImporterData({
                    useExistingRemoteObject : false,
                    className : '',
                    script : '', 
                    useExistingEventloop : false, 
                    eventloopInstanceName : '' 
                }), 
                successfulSteps : [false, false, false] 
            })
        }
        this.dashboardStateManager = null
        this.dashboardURL = ''
        this.setGlobalLocation = null
        this._loggedIn = false 
        makeObservable(this, {
                appsettings : observable,
                dashboardStateManager : observable,
                dashboardURL : observable,
                setPrimaryHostServer : action,
                updateSetting : action,
                updateSettings : action,
                setDashboard : action,
            }
        )
    }

    get json () : string {
        return JSON.stringify({
            primaryHostServer : this.primaryHostServer,
            appsettings : this.appsettings,
            servers : [],
            loggedIn : this._loggedIn
        })
    }

    static createObjectFromSession() : ApplicationState {
        let state = new ApplicationState()
        let primaryHostServer = window.sessionStorage.getItem('primaryHostServer')
        if(primaryHostServer) 
            // @ts-ignore
            state.primaryHostServer = primaryHostServer
        let appsettings = window.sessionStorage.getItem('appsettings')
        if(appsettings)
            state.appsettings = JSON.parse(appsettings)
        return state
    }

    updateSetting(field : string, value : any) {
        // @ts-ignore
        updateObjectFromString(field, value, this.appsettings)
        window.sessionStorage.setItem('appsettings', JSON.stringify(this.appsettings))
    }
    
    updateSettings(value : ApplicationSettings) {
        this.appsettings = {
            ...this.appsettings,
            ...value 
        } 
        window.sessionStorage.setItem('appsettings', JSON.stringify(value))
    }

    async setPrimaryHostServer(serverURL : string) {
        // @ts-ignore
        this.primaryHostServer = serverURL
        window.sessionStorage.setItem('primaryHostServer', serverURL)
        return
        await Promise.all([axios({
            url : 'dashboard-util/app/info/all', 
            method : 'get',
            baseURL : serverURL,
            // httpsAgent: new https.Agent({ rejectUnauthorized: false })
        }), axios({
            url : 'server-util/subscribers', 
            method : 'get',
            baseURL : serverURL,
            // httpsAgent: new https.Agent({ rejectUnauthorized: false })
        })]).then((responses) => {
            // console.log(responses)
            // debugger
            for(let response of responses) {
                if(response.status === 202 || response.status === 200 ) {
                    if(response.data.returnValue.appsettings) 
                        this.appsettings = response.data.returnValue.appsettings
                    if(response.data.returnValue.servers) {
                        for(let server of response.data.returnValue.servers) {
                            let found = false
                            for(let serv of this.servers){
                                if(serv.qualifiedIP === server.qualifiedIP)
                                    found = true
                            }
                            if(!found) {
                                if(!this.servers.includes(server))
                                    this.servers.push(new PythonServer(server))
                            }
                            if(server.type === PRIMARY_HOST)
                                this.primaryHostServer = new PythonServer(server)
                        }
                    }
                    if(response.data.returnValue.subscribers) {
                        for(let server of response.data.returnValue.subscribers) {
                            let found = false
                            for(let serv of this.servers){
                                if(serv.qualifiedIP === server.qualifiedIP)
                                    found = true
                            }
                            if(!found) {
                                if(!this.servers.includes(server))
                                    this.servers.push(new PythonServer(server))
                            }
                            if(server.type === PRIMARY_HOST && !this.primaryHostServer)
                                this.primaryHostServer = new PythonServer(server)
                        }
                    }
                }
            }
        })
        
        // console.log(this.servers)
        // console.log(this.primaryHostServer)
        // console.log(this.appsettings)
    }

    async fetchServerData () {
        debugger
        await Promise.all(this.servers.map((server : PythonServer) => {
            return axios({
                url : 'server-util/info/all', 
                method : 'get',
                baseURL : getFullDomain(server),
                // httpsAgent: new https.Agent({ rejectUnauthorized: false })
            })            
        })).then((responses) => {
            for(let i=0; i < responses.length; i++){
                let response = responses[i]
                let server = this.servers[i]
                if(response.status === 200 || response.status === 202) {
                    server._remoteObjectInfo = response.data.returnValue.remoteObjectInfo
                    server.remoteObjectState = response.data.returnValue.remoteObjectState
                }
            }
        }).catch((error) => 
            console.log(error)
        )
    }

    get slashSegregatedRemoteObjects() : object {
        let tree : object = {}
        let all_remote_objects = this.servers.map((server) => {
            let ro = []
            for(let ro_info of server.remoteObjectsInfo)
                ro.push(ro_info.instance_name)
            return ro}).flat()
        for(let RO of all_remote_objects){
            let currentLevel = tree
            let qualifiedName = RO.split('/')
            qualifiedName.forEach((key : string, index : number) => {
                if (index === qualifiedName.length - 1) {
                    // @ts-ignore
                    currentLevel[key] = RO;
                } else {
                    // @ts-ignore
                    currentLevel[key as any] = currentLevel[key] || {};
                    // @ts-ignore
                    currentLevel = currentLevel[key];
                }
            })
        }
        return tree 
    }

    setDashboard(stateManager : StateManager, URL : string) {
        this.dashboardStateManager = stateManager
        this.dashboardURL = URL
    }
}



export type ComponentStateMap = {
    [key : string] : ComponentState //| HttpButtonState | ReactResponsiveGridState 
}


export function getFullDomain(server : PythonServer) {
    return server.https? "https://" + server.qualifiedIP : "http://" + server.qualifiedIP
}


export const GlobalStateContext = createContext<ApplicationState | null>(null)