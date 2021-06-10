const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const os = require("os");
const argv = require("yargs").argv;

let emailAddress = argv._[0];


const SCOPES = [
    'https://www.googleapis.com/auth/drive'
];


let token_path = `${os.homedir()}/public_html/assets/google/accounts/${emailAddress}/token.json`;
let credentials_path = `${os.homedir()}/public_html/assets/google/accounts/${emailAddress}/credentials.json`

let credentials = JSON.parse(fs.readFileSync(credentials_path).toString());

const {client_secret, client_id, redirect_uris} = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
});


console.log('Authorize this app by visiting this url:', authUrl);
  

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(token_path, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', token_path);
        });
    });
});