#!/usr/bin/env node
/**
 *
 *@Time: 2022/3/21 21:13
 *@Author: Mr.lin
 *@Version: v1.0.1
 *@File: main.js
 */

const fs = require("fs")
const path = require("path")
const https = require("https")
const url = require("url")
const command = require("./cmd/command")

const node_modules = process.env.NODE_PATH
const package_config = "package.json"
const package_map = new Map()
const dependencies = new Set()

async function readdir(path) {
    return fs.promises.readdir(path)
}

async function readFile(path) {
    return fs.promises.readFile(path, "utf-8")
}

async function exists(path){
    return fs.promises.access(path, fs.constants.F_OK)
        .then(()=>true)
        .catch(()=>false)
}

async function global_dependent(){
    let modules = await readdir(node_modules)
    for(let module of modules){
        let package_json_path = path.join(node_modules, module, package_config)
        if(await exists(package_json_path)){
            let package_json = require(package_json_path)
            package_map.set(module, package_json.version)
        }
    }
}

async function project_dependent(package_path){
    let files = await readdir(package_path)
    for(let file of files){
        let file_path = path.join(package_path, file)
        if (fs.statSync(file_path).isDirectory()){
            await project_dependent(file_path)
        }else {
            let data = await readFile(file_path)
            if(data){
                let file_depend = data.match(/require\("(.*?)"\)/g)
                if(file_depend){
                    for(let depend of file_depend){
                        dependencies.add(depend.replace(/require\("(.*?)"\)/, "$1"))
                    }
                }
            }
        }
    }
}

function global_depend(prefix){
    let dependence = {}
    let no_dependence = {}
    for(let dp of dependencies){
        let version = package_map.get(dp)
        if(version){
            dependence[dp] = prefix+version
        }else {
            no_dependence[dp] = '*'
        }
    }
    return [dependence, no_dependence]
}

async function registry_depend(prefix, registry){
    let dependence = {}
    let no_dependence = {}
    let data = await Promise.all(Array.from(dependencies).map(dp=>
        new Promise((resolve, reject) =>
            https.get(new url.URL(dp, registry).toString(), res => {
                res.on('data', data => {
                    res.emit('end')
                    let data_s = data.toString()
                    try {
                        resolve([data_s.match(/"_id":"(.*?)"/)[1], data_s.match(/"latest":"(.*?)"/)[1]])
                    }catch {
                        resolve([dp, ])
                    }
                })
            }).on('error', e=> {
                reject(e)
            })
        )
    ))
    let natives = process.binding('natives')
    for(let d of data){
        if(!natives[d[0]] && d[1]){
            dependence[d[0]] = prefix+d[1]
        }else {
            no_dependence[d[0]]='*'
        }
    }
    return [dependence, no_dependence]
}

async function update_package_json(package_path, depend, prefix, encoding, registry){
    let dependence
    let package_json_path = path.resolve(package_path, package_config)
    let data = fs.readFileSync(package_json_path, encoding)
    let package_json = JSON.parse(data)
    if(!package_json.hasOwnProperty(depend)){
        package_json[depend] = {}
    }
    if(registry){
        dependence = await registry_depend(prefix, registry)
    }else {
        await global_dependent()
        dependence = global_depend(prefix)
    }
    package_json[depend] = {...package_json[depend], ...dependence[0]}
    fs.writeFileSync(package_json_path, JSON.stringify(package_json, null,3), encoding)
    console.log("The following packages have been added to the %s", depend)
    console.log(dependence[0])
    console.log("The following packages are not added to the %s", depend)
    console.log(dependence[1])
}

async function gpm(){
    if(! command.help() && ! command.version()){
        let res = command.parse()
        let opt = res.option
        let arg = res.arguments
        if (arg){
            let package_path = arg[0]
            if(await exists(package_path)){
                let depend = opt[1]? "devDependencies": opt[2]? "optionalDependencies": "dependencies"
                let prefix = opt[3]? opt[3][0]: '^'
                let encoding = opt[4]? opt[4][0]: "utf-8"
                let registry = opt[5]? opt[5][0]? opt[5][0]: "https://registry.npmjs.org": undefined
                try{
                    await project_dependent(package_path)
                    await update_package_json(package_path, depend, prefix, encoding, registry)
                }catch (e){
                    console.log(e)
                }
            }else {
                console.log("Sorry, incorrect directory!")
            }
        }

    }
}

gpm()
