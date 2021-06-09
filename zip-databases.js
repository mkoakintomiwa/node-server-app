const fx = require("./functions");
const db  = require("./mysql");

fx.println();

(async _=>{
    let db_connection = db.create_connection();

    await fx.zipDatabases(db_connection);

    db.close_connection(db_connection);
})();
