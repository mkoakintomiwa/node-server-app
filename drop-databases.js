let fx = require("./functions");
let db  = require("./mysql");
let argv = require("yargs").argv;

fx.println();

(async _=>{
    let conn = db.create_connection();

    let subquery = "";
    if (argv._[0]) subquery = `LIKE '${argv._[0]}'`;

    for (let database_name of await db.all_databases(subquery,conn)){
        console.log(`Dropping ${database_name}`);
        await fx.shell_exec(`mysql --execute "DROP DATABASE IF EXISTS ${database_name}"`);
    }

    db.close_connection(conn);
})();