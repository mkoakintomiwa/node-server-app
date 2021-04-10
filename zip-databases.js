let fx = require("./functions");
let db  = require("./mysql");
let argv = require("yargs").argv;



let conn = db.create_connection();
(async _=>{
    let subquery = "";
    if (argv._[0]) subquery = `LIKE '${argv._[0]}'`;
    let rows = await db.fetch(`SHOW DATABASES ${subquery}`,null,conn);

    let database_names = Object.values(rows);

    console.log(database_names);
    
    db.close_connection(conn);
})();
