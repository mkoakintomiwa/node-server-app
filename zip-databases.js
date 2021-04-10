let fx = require("./functions");
let db  = require("./mysql");


let conn = db.createConnection();
(async _=>{
    console.log(await db.fetch_one("SHOW DATABASES",null,conn));
    db.closeConnection(conn);
})();
