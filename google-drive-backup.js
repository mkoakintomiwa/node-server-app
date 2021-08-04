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

    let zipBackupFileName = await fx.zipDatabases();

    let specsZipName = `specs-${fx.UTCDate()}.zip`;

    await fx.shell_exec(`cd ${os.homedir()}/public_html/specs && rm -rf specs*.zip && zip -rq "${specsZipName}" . && mv "${os.homedir()}/public_html/specs/${specsZipName}" "${process.cwd()}/${specsZipName}"`);

    drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false and name='server-backups'",
        fields: 'nextPageToken, files(id, name)',
        spaces: 'drive'
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const files = res.data.files;
        if (files.length) {
            files.map(async (file) => {

                for (let filename of [zipBackupFileName,specsZipName]){
                    await new Promise(function(resolve){
                        var fileMetadata = {
                            'name': filename,
                            'parents':[file.id]
                        }
                        
                        var media = {
                            mimeType: 'application/zip',
                            body: fs.createReadStream(filename)
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
                                console.log(`${filename} uploaded.`)
                                fs.unlinkSync(filename);
                            }
                            resolve();
                        });
                    });
                }
                fx.println();
            });
        } else {
            console.log('No files found.');
        }
    });
})();