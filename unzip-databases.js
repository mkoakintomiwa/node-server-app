var fs = require("fs");
var fx = require("./functions");
var glob = require("glob");
var path = require("path");

(async _=>{
    await fx.shell_exec(`rm -rf server-db`);
    await fx.shell_exec(`mkdir server-db`);
    await fx.shell_exec(`unzip server-db.zip -d server-db`);

    await new Promise(resolve=>{
        glob("*/*.sql",{
            cwd:"server-db",
            absolute: true
        },async function(err,matches){
            for(let filePath of matches){
                let database_name = path.basename(filePath).replace(".sql","");
                await fx.shell_exec(`mysql --execute "CREATE DATABASE ${database_name}"`);
                console.log(`Importing ${database_name}`);
                fx.println();
                await fx.shell_exec(`mysql -u root ${database_name} < server-db/databases/${database_name}.sql`);
            }
            resolve();
        });
    });

    let clients = JSON.parse(fs.readFileSync("server-db/clients.json").toString());

    for(let client of clients){
        console.log(`Running queries for ${client.user}`);

        console.log(`Creating user ${client.user}`)
        await fx.shell_exec(`mysql --execute "CREATE USER '${client.user}'@'localhost' IDENTIFIED BY '${client.password}'";`);

        await fx.shell_exec(`mysql --execute "GRANT ALL PRIVILEGES ON *.* TO '${client.user}'@'localhost';"`);

        fx.println();
        fx.println();
    }

    await fx.shell_exec(`mysql --execute "FLUSH PRIVILEGES;"`);

    await fx.shell_exec(`rm -rf server-db`);

})();