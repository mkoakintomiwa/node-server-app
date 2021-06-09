const fx = require("./functions");
const db  = require("./mysql");
const argv = require("yargs").argv;
const AdmZip = require('adm-zip');

fx.println();

(async _=>{
    let conn = db.create_connection();

    let subquery = "";
    if (argv._[0]) subquery = `LIKE '${argv._[0]}'`;


    var zip = new AdmZip();

    console.log(await db.all_databases(subquery,conn));

    require("process").exit(-1);

    for (let database_name of await db.all_databases(subquery,conn)){
        console.log(`Dumping ${database_name}`);
        let dump = await fx.shell_exec(`mysqldump ${database_name}`,{
            hide_output: true
        });
        console.log(`Adding ${database_name} to zip archive`);
        zip.addFile(`databases/${database_name}.sql`,Buffer.alloc(dump.length,dump));
        fx.println();
        fx.println();
    }

    console.log("Writing clients...");

    let users = db.users();

    let clients = [];

    for (let user of await db.all_users(conn)){
        if (users.includes(user) && user!="root"){
            console.log(user)
            fx.println();
            let client = db.client(user);
            clients.push({
                user: user,
                password: client.password
            });
        }    
    }

    let content = JSON.stringify(clients,null,4);

    zip.addFile(`clients.json`,Buffer.alloc(content.length,content));

    console.log("Creating server-db.zip");

    zip.writeZip("server-db.zip");
    
    db.close_connection(conn);

    fx.println();
    fx.println();
})();
