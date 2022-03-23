#!/usr/bin/env node
/**
 *
 *@Time: 2022/3/21 21:14
 *@Author: Mr.lin
 *@Version: v1.0.1
 *@File: command.js
 */

class Command{
    constructor() {
        this.terminal = process.stdout
        this.left_padding_len = 4
        this.right_padding_len = 2
        this.cmd = require("./cmd.json")
        this.arg = [...new Set(process.argv.slice(2))]
        this.left_padding = Array(this.left_padding_len + 1).join(' ')
    }

    help(){
        if(this.arg.includes("-h") || this.arg.includes("--help")){
            let max_name_len = this._genMaxLen()
            this.description()
            this.usage()
            if(max_name_len !== 0){
                let padding_len = max_name_len + this.left_padding_len + this.right_padding_len
                let padding = Array(padding_len+1).join(' ')
                let re = new RegExp(`[\\s\\S]{1,${this.terminal.columns - padding_len}}`, 'g')
                for(let o of Object.entries(this.cmd)){
                    if(typeof o[1] == "object"){
                        this._prettyPrint(o, re, padding)
                    }
                }
            }
            return true
        }
        return false
    }

    description(){
        if (this.cmd.hasOwnProperty("Description") && this.cmd["Description"] !== ''){
            this.terminal.write(this.cmd["Description"]+'\n')
        }
    }

    usage(){
        if (this.cmd.hasOwnProperty("Usage") && this.cmd["Usage"] !== ''){
            this.terminal.write(`\nUsage:\n${this.left_padding + this.cmd["Usage"]}\n`)
        }
    }

    version(){
        if(this.arg.includes("-v") || this.arg.includes("--version")){
            this.terminal.write(this.cmd.Version)
            return true
        }
        return false
    }

    parse(){
        return {
            "option": this.option_parse(),
            "arguments": this.arguments_parse()
        }
    }

    arguments_parse(){
        let args_len = Object.keys(this.cmd.Arguments).length
        return this.arg.length === args_len ? this.arg.slice(0, args_len): undefined
    }

    option_parse(){
        let options_list = Object.keys(this.cmd.Options)
        let options = new Array(options_list.length)
        options_list.forEach((value, index)=>{
            let args = value.match(/<.*?>/g)
            let n = args? args.length: 0
            let cmds = value.split('<')[0].replace(' ','').split(',')
            for(let c of cmds){
                let arg_index = this.arg.indexOf(c)
                if(arg_index !== -1){
                    options[index] = this.arg.slice(arg_index+1, arg_index+n+1)
                    this.arg.splice(arg_index, n + 1)
                }
            }
        })
        return options
    }

    _prettyPrint(obj, re, padding){
        this.terminal.write(`\n${obj[0]}:\n`)
        for(let o of Object.entries(obj[1])){
            let desc_list = o[1].match(re)
            if(desc_list){
                let desc = desc_list.join('\n'+padding)
                let right_padding = Array(padding.length - o[0].length - this.left_padding.length + 1).join(' ')
                this.terminal.write(this.left_padding + o[0] + right_padding + desc + '\n')
            }
        }
    }

    _genMaxLen(){
        let max = 0
        for(let o of Object.values(this.cmd)){
            if(typeof o == "object"){
                let keys = Object.keys(o)
                if(keys.length !== 0){
                    let max_ = keys.reduce((a,b)=>{
                        return a.length >= b.length ? a : b
                    }).length
                    if(max_ > max){
                        max = max_
                    }
                }
            }
        }
        return max
    }
}

module.exports = new Command()