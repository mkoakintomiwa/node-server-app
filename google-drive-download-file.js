const fx = require("./functions");
const fs = require("fs");
const os = require("os");
const argv = require("yargs").argv;
const {google} = require('googleapis');

(async _=>{
    let emailAddress = argv._[0];

    let fileId = argv["file-id"];

    let destPath = argv["dest"];

    let auth = fx.googleAccountAPIAuth(emailAddress);

    const drive = google.drive({version: 'v3', auth});

    var dest = fs.createWriteStream(destPath);
    
    drive.files.get({
        fileId: fileId,
        alt: 'media'
    }).on('end', function () {
      console.log(`Downloaded ${destPath}`);
    }).on('error', function (err) {
      console.log('Error during download', err);
    }).pipe(dest)

})();