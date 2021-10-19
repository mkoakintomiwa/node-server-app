const fs = require('fs');
const fse = require("fs-extra");
const fx = require("../functions");
const db = require("../db");
const WebSocket = require('ws');
const https = require('https');
const http =  require("http");
const os = require("os");
const path = require("path");
const axios = require('axios').default;
const { spawn, spawnSync, exec, execSync } = require("child_process");

const root_settings = JSON.parse(fs.readFileSync("/root/.settings.json").toString());
const mysql = root_settings.mysql;

let server;

let host = JSON.parse(fs.readFileSync("/etc/host.json").toString());

if (fs.existsSync(`/etc/letsencrypt/live`)){
    // @ts-ignore
    server = new https.createServer({
        cert: fs.readFileSync(`/etc/letsencrypt/live/${host.hostname}/cert.pem`),
        key: fs.readFileSync(`/etc/letsencrypt/live/${host.hostname}/privkey.pem`),
        ca: fs.readFileSync(`/etc/letsencrypt/live/${host.hostname}/chain.pem`)
    });
}else{
    // @ts-ignore
    server = new http.createServer();
}

let databaseConnection = db.conn("information_schema",mysql.username,mysql.password);

const wss = new WebSocket.Server({server});

(async _=>{

    wss.on('connection', function connection(ws) {
        ws.on('message', async function incoming(requestJSONString) {
            let request = JSON.parse(requestJSONString.toString());
            
            let context = request.context;

            switch(context){
                case "portalSetup":
                    await portalSetup(ws,request);
            }
        });
    });

    //Start the server
    server.listen(7077);
    console.log(`WebSocket listening at port 7077`);
})();


/**
 * 
 * @param {*} message 
 * @param { WebSocket } websocket 
 */
async function sendJsonMessage(message,websocket){
    await new Promise(function(resolve){
        websocket.send(JSON.stringify(message),function(error){
            resolve();
        });
    });
    return true;
}


/**
     * 
     * @param {string} command 
     */
async function mysqlExecute (command){
    await fx.shell_exec(`mysql -u ${mysql.username} --execute "${command}"`);
}

/**
 * 
 * @param { WebSocket } ws 
 * @param { any } request 
 */
async function portalSetup(ws,request){
    let data = request.data;

    let context;

    /**
     * 
     * @param {string} description 
     */
    const sendDescription = async (description)=>{
        await sendJsonMessage({
            context: context,
            description: description
        },ws);
    }

    /**
     * 
     * @param {string} _context 
     */
    const setContext = (_context)=>{
        context = _context;
    }

    setContext("Database");


    await sendDescription(`Creating user ${data.database_user}`);

    if (!data.database_password) data.database_password = fx.random_characters(15);

    await db.execute(`CREATE USER '${data.database_user}'@'localhost' IDENTIFIED BY '${data.database_password}'`,[],databaseConnection).catch(e=>{
        sendDescription(e.message);
    });

    await sendDescription(`Creating database ${data.database_name}`);
    
    await db.execute(`CREATE DATABASE IF NOT EXISTS ${data.database_name}`,[],databaseConnection);

    await db.execute(`CREATE DATABASE IF NOT EXISTS ${data.database_name}_files`,[],databaseConnection);

    await sendDescription(`Granting user ${data.database_user} all privileges on database ${data.database_name}`);
    
    await mysqlExecute(`GRANT ALL ON ${data.database_name}.* TO '${data.database_user}'@'localhost';flush privileges;`).catch(e=>{
        sendDescription(e.message);
    });


    await mysqlExecute(`GRANT ALL ON ${data.database_name}_files.* TO '${data.database_user}'@'localhost';flush privileges;`).catch(e=>{
        sendDescription(e.message);
    });

    await sendDescription("Executing primary queries - main db");

    let primaryQueriesResponse = await axios.get(`https://demo.icitifysolution.com/php/primary_queries`);

    let mainDBConnection = db.conn(data.database_name,data.database_user,data.database_password);

    await db.execute(primaryQueriesResponse.data,[],mainDBConnection).catch(e=>{
        sendDescription(e.message);
    });

    //mainDBConnection.end();

    await sendDescription("Executing primary queries - files db");

    primaryQueriesResponse = await axios.get(`https://demo.icitifysolution.com/php/primary_queries?conn=conn_files`);

    let filesDBConnection = db.conn(data.database_name+'_files',data.database_user,data.database_password);

    await db.execute(primaryQueriesResponse.data,[],filesDBConnection).catch(e=>{
        sendDescription(e.message);
    });

    filesDBConnection.end();

    await sendDescription("Updating school name");

    await db.execute(`INSERT INTO school_info (property,value,branch) VALUES (?,?,?)`,[
        "general",
        JSON.stringify({
            "school_name": data.school_name
        }),
        ""
    ],mainDBConnection);


    for(let branch of data.school_branches){
        await sendDescription(`Creating branch ${branch.branch_name}`);
        await db.execute(`INSERT INTO school_branches (branch_name) VALUES (?)`,[branch.branch_name],mainDBConnection);

        await sendDescription(`Creating admin user ${branch.admin_username}`);
        await db.execute(`INSERT INTO community_details (username,password,name,clearance,branch,admin_priviledge) VALUES (?,?,?,?,?,?)`,[branch.admin_username, branch.admin_password,'System Admin','system-admin',branch.branch_name,'true'],mainDBConnection);
    }


    await sendDescription(`Creating developer's account`);
    await db.execute(`INSERT INTO community_details (username,password,name,clearance,admin_priviledge) VALUES (?,?,?,?,?)`,[data.developer_username, data.developer_password, data.developer_name,'icitify-dev','true'],mainDBConnection);

    setContext("Files");

    let apiResponse = await axios.get(`https://api.icitifysolution.com/git-token`);
    let gitToken = apiResponse.data["git_token"];
    let gitTmpDirectory = `${data.current_directory}/git-tmp`;

    await fx.rmdir(gitTmpDirectory);

    let gitProc = spawn("git",["clone",`https://${gitToken}@github.com/mkoakintomiwa/portal.git`,gitTmpDirectory]);

    await new Promise(function(resolve){
        gitProc.stdout.on("data", async function(data){
            await sendDescription(data.toString());
        });

        gitProc.stderr.on("data", async function(data){
            await sendDescription(data.toString());
        });

        gitProc.on("close",function(){
            resolve();
        });
    });

    await sendDescription("Portal git repository successfully cloned");


    await sendDescription("Copy files from git tmp directory to current directory");
    await fse.copy(gitTmpDirectory,path.dirname(gitTmpDirectory),{ overwrite: false });

    await sendDescription("Deleting git tmp directory");
    await fx.rmdir(gitTmpDirectory);

    setContext("htaccess");

    await sendDescription("Downloading htaccess");
    await fx.download(`https://api.icitifysolution.com/portal-setup/htaccess.txt`,path.join(data.current_directory,'.htaccess'));

    setContext("Composer");

    await sendDescription("Update composer");

    let composerProc = spawn("php",["composer.phar","update"],{
        cwd:path.join(data.current_directory,"composer")
    });

    await new Promise(function(resolve){
        composerProc.stdout.on("data", async function(data){
            await sendDescription(data.toString());
        });

        composerProc.stderr.on("data", async function(data){
            await sendDescription(data.toString());
        });

        composerProc.on("close",function(){
            resolve();
        });
    });



    setContext("NodeJS");

    await sendDescription("Updating NodeJS");

    let nodejsProc = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm',["install"],{
        cwd:path.join(data.current_directory,"nodejs")
    });

    await new Promise(function(resolve){
        nodejsProc.stdout.on("data", async function(data){
            await sendDescription(data.toString());
        });

        nodejsProc.stderr.on("data", async function(data){
            await sendDescription(data.toString());
        });

        nodejsProc.on("close",function(){
            resolve();
        });
    });


    setContext("settings.json");
    await sendDescription("Generating settings.json");

    let _settings = {
        "name": data.school_name,
        "domain_name": data.domain_name,
        "host": data.host_ip,
        "base_url": data.base_url,
        "rel_dirname": data.rel_dirname,
        "node_url": data.base_url+data.rel_dirname,
        "handshake_auth_key": fx.random_characters(15),
        "ssh": data.ssh,
        "ftp": {
            "user": data.ssh.username,
            "password": data.ssh.password
        },
        "mysql": {
            "username": data.database_user,
            "password": data.database_password,
            "databases": [
                data.database_name
            ],
            "phpmyadmin_auth_key": fx.hash(fx.random_characters(15))
        },
        "active": true
    }


    fs.writeFileSync(`${data.current_directory}/settings.json`,JSON.stringify(_settings,null,4));

    execSync(`chown -R ${data.ssh.username}:${data.ssh.username} /home/${data.ssh.username}/*`);

    let developer = await db.fetchOne("SELECT * FROM community_details WHERE clearance=?",["icitify-dev"],mainDBConnection);

    mainDBConnection.end();

    fs.unlinkSync(path.join(data.current_directory,"setup.php"));

    ws.close(3030,JSON.stringify({
        developer_uid: developer.uid
    }));

}