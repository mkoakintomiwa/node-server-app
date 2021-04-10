const fx = require("./functions");
const argv = require("yargs").argv;

let context = argv._[0];

(async _=>{
    switch(context){
        case "push":
            await fx.shell_exec(`git add .`);
            await fx.shell_exec(`git commit -m "Auto Commit"`);
            await fx.shell_exec(`git push origin master`);
        break;
    }
})();