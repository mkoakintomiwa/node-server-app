let fx = require("./functions");
let db  = require("./mysql");
let argv = require("yargs").argv;
var AdmZip = require('adm-zip');

fx.println();

(async _=>{
    let conn = db.create_connection();

    let subquery = "";
    // if (argv._[0]) subquery = `LIKE '${argv._[0]}'`;
    // let rows = await db.fetch(`SHOW DATABASES ${subquery}`,null,conn);

    // let database_names = [];
    // let native_database_names = ["information_schema","mysql","performance_schema","sys"];

    // for (let row of rows){
    //     let database_name = Object.values(row)[0];

    //     if (!native_database_names.includes(database_name)) database_names.push(database_name);
    // }

    // var zip = new AdmZip();

    // for (let database_name of database_names){
    //     console.log(`Dumping ${database_name}`);
    //     let dump = await fx.shell_exec(`mysqldump -u root ${database_name}`,{
    //         hide_output: true
    //     });
    //     console.log(`Adding ${database_name} to zip archive`);
    //     zip.addFile(`databases/${database_name}.sql`,Buffer.alloc(dump.length,dump));
    //     fx.println();
    //     fx.println();
    // }

    // zip.writeZip("server-db.zip");

    let users = await db.fetch("SELECT user FROM user");
    let users = users.map(x=>x["user"]);

    console.log(users);
    
    db.close_connection(conn);
})();
