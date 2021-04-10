const mysql = require('mysql2');
const { setDefault,setDefaults,settings } = require('./functions');


var _conn = exports._conn = function(db_name=null,db_user=null,host="localhost"){
    
    var _settings = settings();
    if (!db_name) db_name = _settings.db_name;
    if (!db_user) db_user = _settings.db_user;

    return mysql.createConnection({
        host: host,
        user: db_user,
        password:_settings.db_password,
        database: db_name,
        multipleStatements: true
    });
}


var _conn_files = exports._conn_files = function(){
    return mysql.createConnection({
        host: 'localhost',
        user: 'root',
        database: db+"_files",
        multipleStatements: true
    });
}



var import_db = exports.import_db = function(db_name=null,db_user=DB_USER,db_password=DB_PASSWORD,db_host=DB_HOST){
    const host = db_host;
    const user = db_user;
    const password = db_password;
    const database = db_name;

    const Importer = require('mysql-import');
    return new Importer({host, user, password, database});

    importer.import('path/to/dump.sql').then(()=>{
    var files_imported = importer.getImported();
    console.log(`${files_imported.length} SQL file(s) imported.`);
    }).catch(err=>{
    console.error(err);
    });

}


var execute = exports.execute = function(query,parameters,conn=null,retain_connection=true){
    //if (!conn) conn = _conn();
    return new Promise((resolve,reject)=>{
        conn.execute(query,parameters,(err,results,fields)=>{
            //if(!retain_connection) conn.end();
            if (err){
                reject(err);
            }else{
                resolve(results);
            }
        });
    });
}


var fetch = exports.fetch = function(query,parameters=[],db_conn=null,retain_connection=null){

    var conn;
    if (!db_conn){
        //conn=_conn();
        if (!retain_connection) retain_connection = false;
    }else{
        if (typeof db_conn === "string"){
            conn = _conn(db_conn);
        }else{
            conn = db_conn;
        }
        if (!retain_connection) retain_connection = true;
    }

    return execute(query,parameters,conn,retain_connection);
    
}



var fetch_one = exports.fetch_one = function(query,parameters=[],db_conn=null,retain_connection=null){
    return new Promise((resolve,reject)=>{
        fetch(query,parameters,db_conn,retain_connection).then(results=>{
            resolve(results[0]);
        }).catch(err=>{
            reject(err);
        })
    });
}



class row_action{
    
    constructor(db_parameters=[]){
        this.db_parameters = db_parameters;
        if (typeof db_parameters['conn']==="undefined"){
            this.conn = _conn();
        }else{
            this.conn  = db_parameters["conn"];
        }
        return this;
    }

    
    
    
    statement(){
        var db_parameters = this.db_parameters;

        var columns = db_parameters['columns'];

        var s=" WHERE ";
        var i=0;
    


        for (let column in columns){
            var column_value = columns[column];
    
            if (i===0){
                s+=" `"+column.trim()+"`=? ";
            }else{
                s+=" AND `"+column.trim()+"`=? ";
            }
            i++;            
        }

        var query_append = setDefault(db_parameters['query_append'],""); 
        return s+" "+query_append;
    }



    
    
    fetch(retain_connection=true){

        var db_parameters=this.db_parameters;

        var q = this.statement();
        var h=Object.values(db_parameters['columns']);
        return fetch(`SELECT * FROM \`${db_parameters['table_name']}\` ${q}`,h,this.conn,retain_connection);
    }

    
    
    
    fetch_one(retain_connection=true){
        var db_parameters=this.db_parameters;

        var q = this.statement();
        var h=Object.values(db_parameters['columns']);
        
        return fetch_one(`SELECT * FROM \`${db_parameters['table_name']}\` ${q}`,h,this.conn,retain_connection);
    }
    
    

    exists(retain_connection=false){

        var db_parameters = this.db_parameters;
        return new Promise(resolve=>{
            this.fetch(retain_connection).then(results=>{
                if (typeof db_parameters['count'] === "undefined"){
                    resolve(results.length>0);
                }else{
                    resolve(false);
                }
                if (!retain_connection) this.end();
            });
        }); 

    }
    
    
    
    delete(){
        var db_parameters  = this.db_parameters;
    
        var s = this.statement();

        return new Promise(resolve=>{
            execute(`DELETE FROM \`${db_parameters['table_name']}\` ${s}`,Object.values(db_parameters['columns']),this.conn,true).then(_=>{
                resolve(this);
            })
        });
    }



    
    update(){

        var db_parameters = this.db_parameters;
    
        var s = this.statement();

        var d = Object.keys(db_parameters['update']).length;

        var bb="";

        var k = Object.keys(db_parameters['update']);
        var v = Object.values(db_parameters['update']);

        for (var g=0;g<d;g++){
            if (g===d-1){
                bb+=" `"+k[g].trim()+"`=? ";
            }else{
                bb+=" `"+k[g].trim()+"`=?, ";
            }
        }
        
        
        return new Promise(resolve=>{
            execute(`UPDATE \`${db_parameters['table_name']}\` SET ${bb} ${s}`,Object.values(db_parameters['update']).concat(Object.values(db_parameters['columns'])),this.conn,true).then(_=>{
                resolve(this)
            });
        });
    }


    
    insert(){
        
        var db_parameters = this.db_parameters;
    
        var s = this.statement();

        var p="(";
        var c="(";
        var f=0;

        var columns = db_parameters['columns'];
        
        for (let column_name in columns){
            var column_value = columns[column_name];

            if (f===Object.keys(db_parameters['columns']).length-1){
                c+="?";
                p+="`"+column_name.trim()+"`";
            }else{
                c+="?,";
                p+="`"+column_name.trim()+"`,";
            }

            f++;
        }

        p+=")";
        c+=")";

        return new Promise(resolve=>{
            execute(`INSERT INTO \`${db_parameters['table_name']}\` ${p} VALUES ${c}`,Object.values(db_parameters['columns']),this.conn,true).then(_=>{
                resolve(this);
            })
        });
    }


    insert_once(){
        return new Promise(resolve=>{
            this.exists(true).then(_exists=>{
                if (!_exists){
                    this.insert().then(_=>{
                        resolve(this);
                    });
                }else{
                    resolve(this);
                }
            })
        })
    }


    end(){
        this.conn.destroy();
    }
}

exports.row_action = function(db_parameters){
    return new row_action(db_parameters);
}


var db_scheme = exports.db_scheme = function(query,db_conn,output='array'){
    if (!db_conn) db_conn = _conn();

    var f = [];

    return new Promise(resolve=>{
        fetch("SHOW TABLES",[],db_conn).then(rows=>{
            for (let table_name of rows){
                f.push(Object.values(table_name)[0]);
            }

            
            var k="";
            for(let d of f){
                k+=`\`${d}\`,`;
            }

            k = rtrim($k,",");
            k = k.replace(/,$/,'');
            
            resolve(output==='array'?f:k);
        });
    });
}


var db_tables = exports.db_tables = function(db_conn=null,$output='array'){
    return db_scheme("SHOW TABLES",db,output);
}



var db_fields = exports.db_fields =  function(table,db_conn=null,output='array'){
    return db_scheme(`SHOW columns FROM \`${table}\``,db,output);
}



var column_exists = exports.column_exists = function(column,table,db_conn=null){

    if (!db_conn) db_conn=_conn();
    return new Promise(resolve=>{
        db_fields(table,db_conn).then(_db_fields=>{
            resolve(_db_fields.includes(column));
        })
    });
}



var sql_character = exports.sql_character =  function(character){
    return character.trim().toUpperCase();
}




var add_column = exports.add_column = function(column,table,column_definitions=[],db_conn=null){
    
    if (!db_conn) db_conn = _conn();

    var cds = setDefaults({
        'type':'VARCHAR',
        'length':250,
        'null':true,
    },column_definitions);

    var _type = `${cds.type}(${cds.length})`;

    var _after = typeof cds.after!="undefined" ? `AFTER \`${cds.after}\``:"";

    var _null = !$cds['null']?"NOT NULL":"NULL";

    var _default = typeof cds.default?`DEFAULT ${cds.default}`:"";

    var sql_type = sql_character(cds.type); 

    if (sql_type==='TEXT' || sql_type==='JSON' || sql_type==='BLOB'){
        _type = cds['type'];
    }

    return new Promise(resolve=>{
        column_exists(column,table,db_conn).then(_exists=>{
            if (_exists){
                execute(`ALTER TABLE \`${table}\` ADD ${column} ${_type} ${_null} ${_default} ${_after}`).then(_=>{
                    resolve();              
                })
            }
        })
    })
}



var show_create_table = exports.show_create_table = function(table_name,conn=null){
    if (!conn) conn = _conn();
    
    return new Promise(resolve=>{
        fetch_one(`SHOW CREATE TABLE \`${table_name}\``,[],conn).then(row=>{
            var query = row["Create Table"];
            query +=";";
            query += "\n";
            query += `ALTER TABLE \`${table_name}\` AUTO_INCREMENT = 1`;
            resolve(query);
        });
    });
}



var real_list = exports.real_list = function(list){
    var h=[];
    for (let j of list){
        if(j.trim().length>0){
            h.push(j.trim());
        }
    }
    return h;
}



var wild_card_query = exports.wild_card_query = function($m){

    if (typeof m['query'] === "undefined"){
        m['query'] = "";
    }

    
    if (typeof m['query_append'] === "undefined"){
        m['query_append'] = "";
    }

    
    var qa = m['query'].trim().split(/\s+/);
    var qas = real_list(qa);
    
    var query = `SELECT * FROM \`${m['table_name']}\``;
    
    if (qas.length>0){
        
        query+=" WHERE (";
        
        for (let field of m['fields']){
            query +="(";
            for (let af of qas){
                query+=` \`${field}\` LIKE '%`+af.replace(/'/g,"'")+`%' AND `;
            }
            query = query.replace(/AND\s+$/,"")+") OR"
        }
        
        query = query.replace(/OR\s+/,"");
        
        query = `${query})`;
        
        if (m['query_append'].trim().length>0){
            query += " AND "+m['query_append'];
        }
        
    }else{
        if (m['query_append'].trim().length>0){
            query += " WHERE "+m['query_append'];
        }
    }
    return query;
}



var wild_card_search = exports.wild_card_search = function(m){
    return fetch(wild_card_query(m));
}



var group_by = exports.group_by = function(group_name,sub_group_name,fetched_array){

    var accumulator = [];
    for (let fetched_row of fetched_array){
        var _group_name = group_name(fetched_row);
        var _sub_group_name = sub_group_name(fetched_row);

        if (!isset($accumulator[$_group_name])) $accumulator[$_group_name] = [];
        if (typeof accumulator[_group_name] === "undefined") accumulator[_group_name] = {};

        accumulator[_group_name][fetched_row[_sub_group_name]] = fetched_row;
    }
    return accumulator;
}



var primary_queries = exports.primary_queries = function(conn=null){
    
    if (!conn) $conn = _conn();
    var queries = "";

    return new Promise(resolve=>{
        db_tables(conn).then(async tables=>{
            for (let table of tables){
                await show_create_table(table,conn).then(_queries=>{
                    queries +=_queries
                });
                queries += ";";
                queries += "\n\n\n";
            }
            resolve(queries);
        })
    })
}



var user = exports.user = function(uid){
	const conn = _conn();
	return new Promise(resolve=>{
		fetch_one("SELECT * FROM community_details WHERE uid=?",[uid],conn,false).then(p=>{
			resolve(p);
		})
	});
}



var current_session_term = exports.current_session_term = function(conn=null){
	var argv  = require("yargs").argv;
	var session_term = {};
	return new Promise(resolve=>{
		fetch_one("SELECT * FROM current_term",null,conn).then(p=>{
			session_term.current_session =  argv.session?argv.session:p.session;
			session_term.current_term = argv.term?argv.term:p.name;
			resolve(session_term);
		})
	});
}