let fx = require("./functions");
let db  = require("./mysql");
let argv = require("yargs").argv;
var AdmZip = require('adm-zip');



let conn = db.create_connection();
(async _=>{
    let subquery = "";
    if (argv._[0]) subquery = `LIKE '${argv._[0]}'`;
    let rows = await db.fetch(`SHOW DATABASES ${subquery}`,null,conn);

    let database_names = [];
    let native_database_names = ["information_schema","mysql","performance_schema","sys"];

    for (let row of rows){
        let database_name = Object.values(row)[0];

        if (!native_database_names.includes(database_name)) database_names.push(database_name);
    }

    var zip = new AdmZip();

    for (let database_name of database_names){
        let dump = await fx.shell_exec(`mysqldump -u root ${database_name}`);
        zip.addFile(`databases/${database_name}.sql`,Buffer.alloc(dump.length,dump));
    }

    zip.writeZip("server-db.zip");
    
    db.close_connection(conn);
})();
