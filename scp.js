const fx = require("./functions");
const ssh = require("./ssh");
const argv = require("yargs").argv;

let localFile = argv._[0];

let remote = new RegExp(/(.+)@(.+):(.+)/).exec(argv._[1]);

let username = remote[1];
let host = remote[2];

let password = argv.p;

let remoteFile = remote[3];


(async _=>{
    var ssh_connection = await ssh.ssh_connection({
        host: host,
        username: username,
        password: password
    });

    await ssh_connection.putFile(localFile,remoteFile,null,{
        step: (total_transferred,chunk,total_size)=>{
        console.log(`${fx.round(total_transferred/total_size,5) * 100}%`)}
    });

    ssh_connection.dispose();
})();