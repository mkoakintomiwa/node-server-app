const fx = require("./functions");
const fs = require("fs");
const os = require("os");
const argv = require("yargs").argv;
const {google} = require('googleapis');
const db = require("./mysql");
const process = require("process");
const path = require("path");

(async _=>{
    let emailAddress = argv._[0];

    let specsRelDir = argv["s"] || "public_html/specs";

    let specsDirBasename = path.basename(specsRelDir);

    let auth = fx.googleAccountAPIAuth(emailAddress);

    const drive = google.drive({version: 'v3', auth});

    let db_connection = db.create_connection();

    let zipBackupFileName = await fx.zipDatabases(db_connection);

    let specsZipName = `${specsDirBasename}-${fx.UTCDate()}.zip`;

    let specsDir = `${os.homedir()}/${specsDir}`;

    let specsExist = fs.existsSync(specsDir);

    if (specsExist){
        await fx.shell_exec(`cd ${specsDir} && rm -rf ${specsDirBasename}*.zip && zip -rq "${specsZipName}" . && mv "${specsDir}/${specsZipName}" "${process.cwd()}/${specsZipName}"`);
    }

    drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false and name='server-backups'",
        fields: 'nextPageToken, files(id, name)',
        spaces: 'drive'
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const files = res.data.files;
        if (files.length) {
            files.map(async (file) => {

            let uploadItems = [zipBackupFileName];

            if (specsExist) uploadItems.push(specsZipName);

            for (let filename of uploadItems){
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
                db.close_connection(db_connection);
                fx.println();
            });
        } else {
            console.log('No files found.');
        }
    });
})();