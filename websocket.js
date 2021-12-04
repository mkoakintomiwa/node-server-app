const fs = require('fs');
const WebSocket = require('ws');
const https = require('https');
const http =  require("http");

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

const wss = new WebSocket.Server({server});

(async _=>{

    wss.on('connection', function connection(ws) {
        let receivedMessages = 0;
        ws.on('message', async function incoming(requestJSONString) {
            if (receivedMessages === 0){
                try{
                    let request = JSON.parse(requestJSONString.toString());
                    let headers = request.headers;
                    let data = request.data;
                    let module = require(data.path);
                    nocache(request.path);
                    receivedMessages++;
                    module.main(ws);
                }catch(e){
                    ws.send(JSON.stringify({
                        headers: {
                            "Content-Type": "websocket/error"
                        },
                        data: e.message
                    }))
                }
            }
        });
    });

    //Start the server
    server.listen(7077);
    console.log(`WebSocket listening at port 7077`);
})();


function nocache(module) {require("fs").watchFile(require("path").resolve(module), () => {delete require.cache[require.resolve(module)]})}