const fx = require("./functions");
const os = require("os");
const argv = require("yargs").argv;

let emailAddress = argv._[0];

let auth = fx.googleAccountAPIAuth(emailAddress);

const drive = google.drive({version: 'v3', auth});

drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and trashed=false and name='server-backups'",
    pageSize: 50,
    fields: 'nextPageToken, files(id, name)',
    spaces: 'drive'
}, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
        files.map((file) => {
            console.log(`${file.name} (${file.id})`);
        });
    } else {
        console.log('No files found.');
    }
});