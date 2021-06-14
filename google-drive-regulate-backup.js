const fx = require("./functions");
const fs = require("fs");
const os = require("os");
const argv = require("yargs").argv;
const {google} = require('googleapis');
const db = require("./mysql");
const process = require("process");

(async _=>{
    let emailAddress = argv._[0];

    let auth = fx.googleAccountAPIAuth(emailAddress);

    const drive = google.drive({version: 'v3', auth});

   let createdTime = new Date(Date.now() - 60*60*30*10).toISOString();

   console.log(createdTime)

    drive.files.list({
        q: `mimeType != 'application/vnd.google-apps.folder' and trashed=false and createdTime < '${createdTime}'`,
        fields: 'nextPageToken, files(id, name)',
        spaces: 'drive'
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const files = res.data.files;
        if (files.length) {
            files.map(async (file) => {
                console.log(file.name);
                fx.println();
            });
        } else {
            console.log('No files found.');
        }
    });
})();