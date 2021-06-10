var fs = require("fs");
var fx = require("./functions");
var glob = require("glob");
var path = require("path");
const argv = require("yargs").argv;

(async _=>{

    let zipFilePath = argv._[0];
    let unzipExecutionFolder = `backup-unzip-execution-folder`;

    await fx.shell_exec(`rm -rf ${unzipExecutionFolder}`);
    await fx.shell_exec(`mkdir ${unzipExecutionFolder}`);
    await fx.shell_exec(`unzip ${zipFilePath} -d ${unzipExecutionFolder}`);

    await new Promise(resolve=>{
        glob("*/*.sql",{
            cwd: unzipExecutionFolder,
            absolute: true
        },async function(err,matches){
            for(let filePath of matches){
                let database_name = path.basename(filePath).replace(".sql","");
                await fx.shell_exec(`mysql --execute "DROP DATABASE IF EXISTS ${database_name}"`);
                await fx.shell_exec(`mysql --execute "CREATE DATABASE ${database_name}"`);
                console.log(`Importing ${database_name}`);
                fx.println();
                await fx.shell_exec(`mysql ${database_name} < ${unzipExecutionFolder}/databases/${database_name}.sql`);
            }
            resolve();
        });
    });

    let cnf = JSON.parse(fs.readFileSync(`${unzipExecutionFolder}/client.json`).toString());

    console.log(`Running queries for ${cnf.client.user}`);

    console.log(`Creating user ${cnf.client.user}`)
    await fx.shell_exec(`mysql --execute "CREATE USER '${cnf.client.user}'@'localhost' IDENTIFIED BY '${cnf.client.password}'";`);

    await fx.shell_exec(`mysql --execute "GRANT ALL PRIVILEGES ON *.* TO '${cnf.client.user}'@'localhost';"`);

    fx.println();
    fx.println();

    await fx.shell_exec(`mysql --execute "FLUSH PRIVILEGES;"`);

    await fx.shell_exec(`rm -rf ${unzipExecutionFolder}`);

})();