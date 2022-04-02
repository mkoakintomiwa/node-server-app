const fx = require("./functions");
const ssh = require("./ssh");
const argv = require("yargs").argv;

let host = argv.h || argv.host;
let username = argv.u || argv.username;
let password = argv.p || argv.password;

let localFilePath = argv._[0] || argv["local-file-path"];
let remoteFilePath = argv._[1] || argv["remote-file-path"];


(async _=>{
    var ssh_connection = await ssh.ssh_connection({
        host: host,
        username: username,
        password: password
    });

    await ssh_connection.putFile(localFilePath,remoteFilePath,null,{
        step: (total_transferred,chunk,total_size)=>{
        console.log(`${fx.round(total_transferred/total_size,5) * 100}%`)}
    });

    ssh_connection.dispose();
})();