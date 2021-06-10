const fx = require("./functions");
const fs = require("fs");
const os = require("os");
const argv = require("yargs").argv;
const {google} = require('googleapis');
const db = require("./mysql");

(async _=>{
    let emailAddress = argv._[0];

    let auth = fx.googleAccountAPIAuth(emailAddress);

    const drive = google.drive({version: 'v3', auth});

    let db_connection = db.create_connection();

    let zipBackupFileName = await fx.zipDatabases(db_connection);

    drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false and name='server-backups'",
        fields: 'nextPageToken, files(id, name)',
        spaces: 'drive'
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const files = res.data.files;
        if (files.length) {
            files.map((file) => {

                var fileMetadata = {
                    'name': zipBackupFileName,
                    'parents':[file.id]
                }
                
                var media = {
                    mimeType: 'application/zip',
                    body: fs.createReadStream(zipBackupFileName)
                };
                
                drive.files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: 'id'
                }, function (err, file) {
                    if (err) {
                    // Handle error
                        console.error(err);
                    } else {
                        console.log('File Id: ', file.id);
                    }
                    db.close_connection(db_connection);
                });
            });
        } else {
            console.log('No files found.');
        }
    });
})();