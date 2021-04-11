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
                console.log(`Importing ${database_name}`);
                fx.println();
                await fx.shell_exec(`mysql -u root ${database_name} < ./server-db/${database_name}.sql`);
            }
            resolve();
        });
    });

    let clients = JSON.parse(fs.readFileSync("server-db/clients.json").toString());

    for(let client of clients){
        console.log(`Running queries for ${client.user}`);

        console.log(`Creating user ${client.user}`)
        await fx.shell_exec(`mysql --execute "${client.createUser}"`);

        console.log(`Running GRANT queries ${client.user}`);

        for (let grantQuery of client.grants){
            await fx.shell_exec(`mysql --execute "${grantQuery}"`);
        }
        fx.println();
        fx.println();
    }

    await fx.shell_exec(`rm -rf server-db`);
    fx.println();
    fx.println();

})();