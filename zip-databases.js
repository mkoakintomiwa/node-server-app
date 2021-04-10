let fx = require("./functions");
let db  = require("./mysql");
let argv = require("yargs").argv;



let conn = db.createConnection();
(async _=>{
    let subquery = "";
    if (argv._[0]) subquery = `LIKE '${argv._[0]}'`;
    console.log(await db.fetch(`SHOW DATABASES ${subquery}`,null,conn));
    db.closeConnection(conn);
})();
