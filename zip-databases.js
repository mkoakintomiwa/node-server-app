let fx = require("./functions");
let db  = require("./mysql");
let argv = require("yargs").argv;



let conn = db.create_connection();
(async _=>{
    let subquery = "";
    if (argv._[0]) subquery = `LIKE '${argv._[0]}'`;
    let rows = await db.fetch(`SHOW DATABASES ${subquery}`,null,conn);

    let database_names = [];
    let native_database_names = ["information_schema","mysql","performance_schema","sys"];

    for (let row of rows){
        let database_name = Object.values(row)[0];

        if (!native_database_names.includes(database_name)) database_names.push();
    }

    console.log(database_names);
    
    db.close_connection(conn);
})();
