const fx = require("./functions");
const ssh = require("./ssh");
const argv = require("yargs").argv;

let host = argv.host;
let username = argv.username;
let password = argv.password;

let local_file_path = argv["local-file-path"];
let remote_file_path = argv["remote-file-path"];


(async _=>{
    var ssh_connection = await ssh.ssh_connection({
        host: host,
        username: username,
        password: password
    });

    await ssh_connection.putFile(local_file_path,remote_file_path,null,{
        step: (total_transferred,chunk,total_size)=>{
        console.log(`${fx.round(total_transferred/total_size,8) * 100}%`)}
    });

    ssh_connection.dispose();
})();