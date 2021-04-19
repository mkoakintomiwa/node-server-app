const fx = require("./functions");
const { escape_sed,remote_portal_dir,portal_properties_dir,remote_public_html } = require("./functions");
const chalk = require('chalk');
const {NodeSSH} = require('node-ssh')
var Client = require('ssh2').Client;
var readline = require('readline');
const fs = require("fs");
var stdout = require('./stdout');
const path = require("path");


var ssh_options = exports.ssh_options = function(_options){
    
    var options = fx.setDefaults({
        readyTimeout: 99999,
        port:22,
        cwd:null,
        raw_ppk:false,
        show_put_file:true,
        show_spinner:true
    },_options); 

    return {
        host: options.host,
        username: options.username,
        privateKey: options.privateKey,
        password:options.password,
        passphrase:options.passphrase,
        readyTimeout: options.readyTimeout,
        port:options.port,
        cwd:options.cwd,
        raw_ppk:options.raw_ppk,
        show_put_file:options.show_put_file,
        show_spinner:options.show_spinner
    }
}


var node_ssh_options = exports.node_ssh_options = function(node_id,_options={}){
    var options = fx.setDefaults({
        cwd: null,
        show_put_file:true,
        show_spinner:true
      },_options); 
      
      var _node = fx.node(node_id);
      var ssh = _node.ssh;

      return {
        host: _node.host,
        username: ssh.username,
        password: ssh.password,
        //cwd:options.cwd,
        show_put_file:options.show_put_file,
        show_spinner:options.show_spinner
    }
}



var node_root_ssh_options = exports.node_root_ssh_options = function(node_id,_options={}){
    var options = fx.setDefaults({
        cwd: null,
        show_put_file:true,
        show_spinner:true
      },_options); 
      
      var _node = fx.node(node_id);
      var _node_root = fx.node_root(node_id);

      return {
        host: _node.host,
        username: _node_root.username,
        password: _node_root.password,
        //cwd:options.cwd,
        show_put_file:options.show_put_file,
        show_spinner:options.show_spinner
    }
}


var interactive_shell = exports.interactive_shell = function(_options){
  
    var options = ssh_options(_options);
    var spinner = preloader.spinner('Creating shell session %s');
    return new Promise(resolve=>{
        var conn = new Client();
        conn.on('ready', function() {
        //console.log(chalk.green("Client :: ready"));
        //console.log("");
        spinner.stop(true);
        conn.shell(function(err, stream) {
        if (err) throw err;
            // create readline interface
            var rl = readline.createInterface(process.stdin, process.stdout)
    
            stream.on('close', function() {
                //process.stdout.write('Connection closed.')
                //console.log('Stream :: close');
                conn.end();
                //resolve();
            }).on('data', function(data) {
                // pause to prevent more data from coming in
                process.stdin.pause()
                process.stdout.write(data)
                process.stdin.resume();
            }).stderr.on('data', function(data) {
                process.stderr.write(data);
            });
    
            rl.on('line', function (d) {
                // send data to through the client to the host
                stream.write(d.trim()+'\n');
            })
    
            rl.on('SIGINT', function () {
                // stop input
                process.stdin.pause()
                //process.stdout.write('\nEnding session\n')
                process.stdout.write('\n')
                rl.close()
        
                // close connection
                stream.end('exit\n')
                conn.end();
                resolve();
            })
    
        });
        }).connect(options);
    });
}


/**
 * @return {Promise<NodeSSH>}
 */
var ssh_connection = exports.ssh_connection = async function(_options={}){
    var options = ssh_options(_options);
    var ssh = new NodeSSH();
    
    await new Promise(resolve=>{
        ssh.connect(options).then(_=>{
            resolve();
        });
    });
    return ssh;
}

/**
 * @return {Promise<NodeSSH>}
 */
var node_ssh_connection = exports.node_ssh_connection = function(node_id,_options={}){
    return ssh_connection(node_ssh_options(node_id,_options));
}

var node_root_ssh_connection = exports.node_root_ssh_connection = function(node_id,_options={}){
    return ssh_connection(node_root_ssh_options(node_id,_options));
}


var execute_command = exports.execute_command = function(command,ssh_connection,_options={}){

    var options = fx.setDefaults({
        cwd:null
    },_options);
    return new Promise(resolve=>{
        try{
            ssh_connection.exec(command, [], {
                cwd: options.cwd,
                onStdout(chunk) {
                    console.log(chunk.toString());
                },
                onStderr(chunk) {
                    console.log(chunk.toString('utf8'))
                }
            }).then(_=>{
                resolve();
            }).catch(_=>{
                resolve();
            })
        }catch(e){
            console.log(e);
            resolve();
        }
    });
}



var upload_files = exports.upload_files = function(local_remote_files_array,ssh_connection,_options){
  
    var spinner;
    //if (options.show_spinner) spinner = preloader.spinner('Uploading files %s');
    return new Promise(resolve=>{
        //if(options.show_spinner) spinner.stop(true);
        try{
            ssh_connection.putFiles(local_remote_files_array).then(_=>{
                resolve();
            });
        }catch(e){
            console.log(e);
            resolve();
        }
    });
}



var put_directory = exports.put_directory = function(local_directory,remote_directory,_options){
    var ssh = new NodeSSH();
  
    return new Promise(resolve=>{
            
        ssh.connect(ssh_options(_options)).then(_=>{
            try{
                ssh.putDirectory(local_directory,remote_directory,{
                    recursive: true,
                    concurrency: 10
                }).then(_=>{
                    ssh.dispose();
                    resolve();
                });
            }catch(e){
                console.log(e);
                ssh.dispose();
                resolve();
            }
        });
    });
}





var get_file = exports.get_file = function(local_file,remote_file,_options){
    var ssh = new NodeSSH();
  
    return new Promise(resolve=>{
            
        ssh.connect(ssh_options(_options)).then(_=>{
            try{
                ssh.getFile(local_file,remote_file).then(contents=>{
                    ssh.dispose();
                });
            }catch(e){
                console.log(e);
                ssh.dispose();
                resolve();
            }
        });
    });
}


var get_directory = exports.get_directory = function(local_directory,remote_directory,_options){
    var ssh = new NodeSSH();
    if (!fs.existsSync(local_directory)) fs.mkdirSync(local_directory,{recursive:true});
    return new Promise(resolve=>{
            
        ssh.connect(ssh_options(_options)).then(_=>{
            try{
                ssh.getDirectory(local_directory,remote_directory).then(_=>{
                    ssh.dispose();
                });
            }catch(e){
                console.log(e);
                ssh.dispose();
                resolve();
            }
        });
    });
}



var node_execute_command = exports.node_execute_command = function(command,node_ssh_connection,_options={}){
    let node_id = _options.node_id || "";
    let options = fx.setDefaults({
        cwd: fx.remote_node_dir(node_id)
    },_options);
    return execute_command(command,node_ssh_connection,options);
}



var node_root_execute_command = exports.node_root_execute_command = function(command,node_root_ssh_connection,_options){
    return execute_command(command,node_root_ssh_connection,_options);
}
  


var portal_interactive_shell = exports.portal_interactive_shell = function(portal_id){
    return interactive_shell(portal_ssh_options(portal_id,{
        raw_ppk:true
    }));
}



var node_upload_files = exports.node_upload_files = function(local_remote_files_array,node_id,ssh_connection,_options={}){

    var options = fx.setDefaults({
        show_node_name:false,
        show_put_file:true
    },_options)

    if(options.show_node_name) console.log(chalk.green(`\n----- ${fx.node(node_id).name} -----`));

    if (options.show_put_file){
        local_remote_files_array.forEach(local_remote_file => {
            fx.println();
            console.log(`${chalk.magentaBright('put file:')} ${chalk.greenBright(fx.forward_slash(local_remote_file.local))} ${chalk.redBright(`->`)} ${chalk.cyanBright(fx.forward_slash(local_remote_file.remote))}`);
        });
    }
    
    return upload_files(local_remote_files_array,ssh_connection);
}


var node_upload_file = exports.node_upload_file = function(local_path,remote_path,node_id,ssh_connection,_options={}){
    return node_upload_files([
        {
            "local":local_path,
            "remote": remote_path
        }
    ],node_id,ssh_connection);
}



var upload_project_files = exports.upload_project_files = function(file_relative_paths, node_id, ssh_connection,message){
	var local_remote_array = [];

	var _node = fx.node(node_id);

	for (let rel_path of file_relative_paths){
		
		local_remote_array.push({
			local: path.join(fx.document_root(),rel_path),
			remote: fx.remote_node_dir(node_id).concat("/").concat(rel_path)
		});
	}
	return node_upload_files(local_remote_array, node_id, ssh_connection, message);
}



var upload_project_file = exports.upload_project_file = function(file_relative_path, node_id, ssh_connection, message){
	return upload_project_files([file_relative_path], node_id, ssh_connection, message);
}


var portal_put_directory = exports.portal_put_directory = function(local_directory,remote_directory,portal_id,_options={}){

    var options = fx.setDefaults({
        show_school_name:false
    },_options)

    if(options.show_school_name) console.log(chalk.green(`\n----- ${fx.portal_properties(portal_id).school_name} -----`));
    
    return put_directory(local_directory,remote_directory,portal_ssh_options(portal_id,_options));
}


var portal_get_file = exports.portal_get_file = function(local_file,remote_file,portal_id,_options={}){

    var options = fx.setDefaults({
        show_school_name:false
    },_options)

    if(options.show_school_name) console.log(chalk.green(`\n----- ${fx.portal_properties(portal_id).school_name} -----`));
    
    return get_file(local_file,remote_file,portal_ssh_options(portal_id,_options));
}


var portal_get_directory = exports.portal_get_directory = function(local_directory,remote_directory,portal_id,_options={}){

    var options = fx.setDefaults({
        show_school_name:false
    },_options)

    if(options.show_school_name) console.log(chalk.green(`\n----- ${fx.portal_properties(portal_id).school_name} -----`));
    
    return get_directory(local_directory,remote_directory,portal_ssh_options(portal_id,_options));
}


var cron_command_from_array = exports.cron_command_from_array = function(command_array){
    var command = '';
    var command_period = command_array[0];

    for (let i=0;i<5;i++){
        command+=`${command_period[i]} `
    }
    command+=command_array[1];

    return command;
} 


var build_cron_job_command = exports.build_cron_job_command = function(command){
    return `crontab -l > mycron && echo "${command}" >> mycron && crontab mycron && rm mycron`;
}


var build_delete_cron_job_command = exports.build_delete_cron_job_command = function(command){
    return `crontab -l > mycron && sed -re 's/${escape_sed(command)}//g' mycron > mycron2 && crontab mycron2 && rm mycron && rm mycron2`
}


var add_cron_job = exports.add_cron_job = function(command_array,portal_id){
    var command =  cron_command_from_array(command_array);
    return portal_execute_command(build_cron_job_command(command),portal_id);
}


var delete_cron_job = exports.delete_cron_job = function(command_array,portal_id){
    var command =  cron_command_from_array(command_array);
    return portal_execute_command(build_delete_cron_job_command(command),portal_id);
}


var create_cron_job = exports.create_cron_job = function(command_array,portal_id){
    var portal_properties = fx.portal_properties(portal_id);
    var ssh = portal_properties.ssh;

    return new Promise(resolve=>{
        var command_period = command_array[0];
        var cron_job_url = fx.encoded_url(`https://${ssh.host}:2083/frontend/paper_lantern/cron/index.html`,{
            u:ssh.username,
            p:ssh.password,
            minute:command_period[0],
            hour:command_period[1],
            day:command_period[2],
            month:command_period[3],
            weekday:command_period[4],
            command:command_array[1]
        });

        fx.copy_to_clipboard(cron_job_url).then(_=>{
            
            stdout.info_console("Redirect",cron_job_url);

            fx.open_in_browser(cron_job_url).then(_=>{
                resolve();
            });
        });
    });
}


var update_portal_properties = exports.update_portal_properties = function(){
    var portal_id = "demo";
    var _remote_portal_dir = remote_portal_dir(portal_id);
    return portal_execute_command(`git pull origin master`,portal_id,{
        cwd:`${_remote_portal_dir}/specs/assets/portal-properties`
    });
}


var update_portal_templates = exports.update_portal_templates = function(){
    var portal_id = "demo";
    var _remote_portal_dir = remote_portal_dir(portal_id);
    return portal_execute_command(`git pull origin master`,portal_id,{
        cwd:`${_remote_portal_dir}/specs/assets/portal-templates`
    });
}


var update_composer = exports.update_composer = function(node_id,ssh_connection){
    return new Promise(async resolve=>{
        await node_upload_files([
            {
                local:`${fx.document_root()}/composer/composer.json`,
                remote:`${fx.remote_node_dir(node_id)}/composer/composer.json`
            }
        ],node_id,ssh_connection);

        await node_execute_command(`php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" && php -r "if (hash_file('sha384', 'composer-setup.php') === '756890a4488ce9024fc62c56153228907f1545c228516cbf63f885e036d37e9a59d27d63f46af1d4d07ee0f76181c7d3') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;" && php composer-setup.php && php -r "unlink('composer-setup.php');" && php composer.phar update`, ssh_connection,{
            cwd:`${fx.remote_node_dir(node_id)}/composer`
        });
        resolve();
    });
}



var update_node = exports.update_node = function(node_id,ssh_connection){
    return new Promise(async resolve=>{
        let document_root = fx.document_root();

        await node_upload_file(path.join(document_root,'/remote/package.json'), `${fx.remote_node_dir(node_id)}/package.json`, node_id ,ssh_connection);

        await node_execute_command(`npm update`,ssh_connection,{
            cwd:`${fx.remote_node_dir(node_id)}/composer`
        });
        resolve();
    });    
}



var upload_htaccess = exports.upload_htaccess = function(portal_id){
    return portal_put_files([{
        local:`${portal_properties_dir(portal_id)}/.htaccess`,
        remote:`${remote_portal_dir(portal_id)}/.htaccess`
    }],portal_id);
}


var upload_settings = exports.upload_settings = function(portal_id){
    var _portal_properties_dir = portal_properties_dir(portal_id);
    var school = fx.school(portal_id);
    fs.writeFileSync(`${_portal_properties_dir}/settings.json`,JSON.stringify(school.settings,null,4));
    return portal_put_files([{
        local:`${portal_properties_dir(portal_id)}/settings.json`,
        remote:`${remote_public_html(portal_id)}/settings.json`
    }],portal_id);
}


var open_filezilla = exports.open_filezilla = function(options){
    var command;
    const project_root = fx.project_root();
    const filezilla = path.join(project_root,"FileZilla","filezilla.exe");
    if (options.site_manager){
        command = `"${filezilla}" --site="0/${options.portal_id}"`;
        console.log(command);
    }else{
        command = `"${filezilla}" ${options.protocol || "sftp"}://${options.username}:${options.password}@${options.host}:${options.port || 22}`;
    }


    if (options.local) command+=` --local "${options.local}"`;

    return fx.shell_exec(fx.hstart(command));
}


var node_open_filezilla = exports.node_open_filezilla = function(node_id){
    var _node = fx.node(node_id);
    var ssh = _node.ssh;
    var ftp = _node.ftp || {};
    
    return open_filezilla({
        protocol:ftp.protocol||"sftp",
        username:ftp.user,
        password:ftp.password,
        host: _node.host,
        local: fx.document_root(),
        port:ftp.port||22,
        site_manager:ftp.site_manager||false
    });
};



var node_root_open_filezilla = exports.node_root_open_filezilla = function(node_id){
    var root = fx.node_root(node_id);
    var _node = fx.node(node_id);
    var ssh = _node.ssh;
    var ftp = _node.ftp || {};
    
    return open_filezilla({
        protocol:ftp.protocol||"sftp",
        username:root.username,
        password:root.password,
        host: _node.host,
        local: fx.document_root(),
        port:ftp.port||22,
        site_manager:ftp.site_manager||false
    });
};


var open_putty = exports.open_putty = function(options){
    var command;
    const project_root = fx.project_root();
    const putty = path.join(project_root,"PuTTY","putty.exe");
    if (!options.key_path){
        command = `"${putty}" -ssh ${options.username}@${options.host} -pw "${options.password}"`;
    }else{
        command = `"${putty}" -ssh ${options.username}@${options.host} -i ${options.key_path}`;
    }

    return fx.shell_exec(fx.hstart(command));
}


var node_open_putty = exports.node_open_putty = function(node_id){
    var _node = fx.node(node_id);
    var ssh = _node.ssh;

    var argv = require("yargs").argv;

    var puttyOptions = {
        username:ssh.username,
        password:ssh.password,
        host:_node.host
    };

    var path = require("path");
    if (argv.ppk) puttyOptions.key_path = path.join(fx.document_root(),".webman",".ssh","nodes",node_id,"id_rsa.ppk");
    
    return open_putty(puttyOptions);
};



var node_root_open_putty = exports.node_root_open_putty = function(node_id){
    var _node = fx.node(node_id);
    var _node_root = fx.node_root(node_id);
    var ssh = _node.ssh;

    var argv = require("yargs").argv;

    var puttyOptions = {
        username:_node_root.username,
        password:_node_root.password,
        host:_node.host
    };
    var path = require("path");
    if (argv.ppk) puttyOptions.key_path = path.join(fx.document_root(),".webman",".ssh","roots",_node.host,"id_rsa.ppk");  
    
    return open_putty(puttyOptions);
};


var root_open_putty = exports.root_open_putty = function(root_ip_address){
    var _node_root = fx.root(root_ip_address);

    var argv = require("yargs").argv;

    var puttyOptions = {
        username:_node_root.username,
        password:_node_root.password,
        host: root_ip_address
    };
    var path = require("path");
    if (argv.ppk) puttyOptions.key_path = path.join(fx.document_root(),".webman",".ssh","roots",_node.host,"id_rsa.ppk");  
    
    return open_putty(puttyOptions);
};


var open_heidisql = exports.open_heidisql = function(options){
    const project_root = fx.project_root();
    const heidisql = path.join(project_root,"HeidiSQL","heidisql.exe");
    
    if (options.password.trim().length>0){
        var password_param = ` --password="${options.password}" `;
    }else{
        var password_param = ``;
    }

    var command = `"${heidisql}" --user="${options.username}" --host="${options.host}" ${password_param} --session="${options.host}"`;
    return fx.shell_exec(fx.hstart(command));
}


var node_open_heidisql = exports.node_open_heidisql = function(node_id){
    var _node = fx.node(node_id);
    var _mysql = _node.mysql;
    
    return open_heidisql({
        username:_mysql.username,
        password:_mysql.password,
        host:_node.host
    });
};



var node_open_phpmyadmin = exports.node_open_phpmyadmin = function(node_id){
    var _node = fx.node(node_id);
    var _mysql = _node.mysql;
    
    return fx.open_in_browser(`${_node.node_url}/phpmyadmin/${_mysql.phpmyadmin_auth_key}`,"chrome");
};


var node_root_open_phpmyadmin = exports.node_root_open_phpmyadmin = function(node_id){
    var root = fx.node_root(node_id);
    var _node = fx.node(node_id);
    var _mysql = _node.mysql;
    
    return fx.open_in_browser(`${_node.node_url}/phpmyadmin/${root.mysql.phpmyadmin_auth_key}`,"chrome");
};