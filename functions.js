const fs = require("fs");
const path = require("path");
const {spawn} = require("child_process");
const EventEmitter = require('events');
const {google} = require('googleapis');
const os = require("os");
const ini = require('node-ini');

const eventEmitter = new EventEmitter();


process.on("SIGINT",function(){
	eventEmitter.emit("SIGINT");
	process.exit();
});


class log{

	static write(content){
		fs.writeFileSync(this.file(),content);
	}

	static clear(){
		fs.writeFileSync(this.file(),'');
	}

	static content(){
		return fs.readFileSync(this.file(),"utf-8");
	}

	static file(){
		let log_file_path = path.join(document_root(),".webman","log_file");
		if (!fs.existsSync(log_file_path)) fs.writeFileSync(log_file_path,"");
		return path.join(log_file_path);
	}
}

exports.log = log;

var portal_properties_dir = exports.portal_properties_dir = function(portal_id){
	return path.normalize(`${variables.portal_properties_dir}/${portal_id}`)
}

var portal_properties = exports.portal_properties = function(portal_id){
    return variables.portal_properties.portalProperties(portal_id);
}

var remote_dir = exports.remote_dir = function(node_id){
	return `/home/${node(node_id).ssh.username}`;
}

var remote_public_html = exports.remote_public_html = function(node_id){
	return `${remote_dir(node_id)}/public_html`;
}


var remote_node_dir = exports.remote_node_dir = function(node_id){
	return `${remote_public_html(node_id)}${node(node_id).rel_dirname}`;
}


var time = exports.time = function(){
    return Date.now();
}

var subdirectories = exports.subdirectories = function(directory){
	var _subdirectories = [];
	fs.readdirSync(directory).forEach(filename=>{
		if (fs.lstatSync(path.normalize(directory+'/'+filename)).isDirectory()) _subdirectories.push(filename);
	});
	return _subdirectories;
}


var files_in_directory = exports.files_in_directory = function(directory){
	var _files_in_directory = [];
	fs.readdirSync(directory).forEach(file=>{
		if (fs.lstatSync(path.join(directory,file)).isFile()) _files_in_directory.push(path.basename(file));
	});
	return _files_in_directory;
}



var copyFiles = exports.copyFiles = function(source,destination,excluded=[]){
	if (!fs.existsSync(destination)) fs.mkdirSync(destination,{recursive:true});
	const ncp = require("ncp").ncp;
	return new Promise (resolve=>{
		ncp.limit = 16;

		ncpOptions = {
			filter : function(file){
				filesBool = [];
				excluded.forEach((k)=>{
				filesBool.push(file.toString().indexOf(k)===-1);
				});
				return !filesBool.includes(false);
			}
		}
		
		ncp(source, destination, ncpOptions, function (err) {
			if (err) {
				resolve(err);
			}else{
				resolve(true);
			}
		});
	});
}



var emptyDir = exports.emptyDir = function(dir){
	const fsExtra = require("fs-extra");
	return new Promise(resolve=>{
		fsExtra.emptyDir(dir,_=>{
			resolve();
		})
	})
}


var rmdir = exports.rmdir = function(dir){
	const fsExtra = require("fs-extra");
	return new Promise(resolve=>{
		fsExtra.remove(dir,_=>{
			resolve();
		});
	});
}

/**
 * @param {String[]} dirs
 * @param {String} cwd
 */
var rmdirs = exports.rmdirs = async function(dirs,cwd=null){
	 
	for (let dir of dirs){
		var _dir;
		if (cwd){
			_dir = path.join(cwd,dir);
		}else{
			_dir = dir;
		}
		await rmdir(_dir);
	}
}



/**
 * @param {String[]} file_content_array
 * @param {String} cwd
 */
var writeFiles = exports.writeFiles = function(file_content_array,cwd=null,callback=null){
	return new Promise(async resolve=>{
		for (let file_content of file_content_array){
			const file = file_content[0];
			const _path = cwd?path.join(cwd,file):file;
			const content = file_content[1];
			await new Promise(resolve=>{
				fs.writeFile(_path,content,_=>{
					if(callback) callback(_path);
					resolve();
				});
			});
		}
		resolve();
	});
}



var setDefault = exports.setDefault = function(parameter,value){
	return typeof parameter != 'undefined' ? parameter : value;
}

var setDefaults = exports.setDefaults = function(defaults,options){
	for (let property in defaults){
        let value = defaults[property];
		if (typeof options[property] === 'undefined') options[property] = value; 
	};
    return options;
}

var document_root = exports.document_root = function(root_file=".webman"){
    var dirname = process.cwd();
    while(true){
        if (fs.existsSync(dirname+'/'+root_file)){
            return dirname;
        }else{
            dirname=path.dirname(dirname);
        }
    }
    
}



var project_root = exports.project_root = function(root_file="bin"){
    var dirname = __dirname;
    while(true){
        if (fs.existsSync(dirname+'/'+root_file)){
            return dirname;
        }else{
            dirname=path.dirname(dirname);
        }
    }
    
}


var tmp_directory = exports.tmp_directory = function(){
	var _tmp_directory = path.normalize(`${document_root()}/tmp`);
	if (!fs.existsSync(_tmp_directory)) fs.mkdirSync(_tmp_directory);
	return _tmp_directory;
}


var empty_tmp_directory = exports.empty_tmp_directory = function(){
	return emptyDir(tmp_directory());
}


var settings = exports.settings = function(){
	return JSON.parse(fs.readFileSync(document_root()+'/settings.json','utf8'));
}



var portal_dir = exports.portal_dir = function(){
	return document_root("portal_root.json");
}




var log_file = exports.log_file = function(){
	var _portal_dir = portal_dir();
	return `${_portal_dir}/nodejs/logs/shell_execute`;
}


var shell_log_file = exports.shell_log_file = function(){
	var _portal_dir = portal_dir();
	return `${_portal_dir}/logs/shell_execute`;
}


var echo_log_file = exports.echo_log_file = function(){
	var _portal_dir = portal_dir();
	return `${_portal_dir}/logs/echo`;
}


/**
 * @returns {Promise<String>}
 */
var shell_exec = exports.shell_exec = async function(command,_options={}){
	
	var options = setDefaults({
		stdout :data=>{
			console.log(data);
		},
		complete:code=>{
			
		},
		hide_output:false
	},_options);

	var logFile = `${os.homedir()}/.shell`;
	var command_append;

	if (options.hide_output){
		command_append = `> ${logFile}`;
	}else{
		command_append = `| tee -a ${logFile}`;
	}
	
	command = `${command} 2>&1 ${command_append}`;
	
	let response;
	await new Promise(resolve=>{

		var spawnOptions = {
			stdio:'inherit',
			shell:true
		}

		if (typeof options['cwd'] != "undefined"){
			spawnOptions['cwd'] = options['cwd'];
		}

		const ls = spawn(command,spawnOptions);

		// ls.stdout.on("data",data=>{
		// 	options.stdout(data);
		// });

		ls.on("exit",code=>{
			var r = fs.readFileSync(logFile,"utf-8").trim();
			fs.writeFileSync(logFile,"")
			response = r;
            resolve(r);
		});
	});
    return response;
}



var fileDialog = exports.fileDialog = function(default_path=null,title=null){

	var i = '';
	if (default_path) i+= ` --default-path="${default_path}" `;
	if (title) i+= ` --title="${title}" ` 


	return new Promise(resolve=>{
		shell_exec(`electron %portal%/nodejs/dialog ${i}`,{
			hide_output:true
		}).then(response=>{
			resolve(JSON.parse(response)[0]);
		});;
	})
}



var filesDialog = exports.filesDialog = function(default_path=null,title=null){
	var i = ` --multiple-selections="true" `;
	if (default_path) i+= ` --default-path="${default_path}" `;
	if (title) i+= ` --title="${title}" `; 


	return new Promise(resolve=>{
		shell_exec(`electron %portal%/nodejs/dialog ${i}`,{
			hide_output:true
		}).then(response=>{
			resolve(JSON.parse(response));
		});;
	});
}




var folderDialog = exports.folderDialog = function(default_path=null,title=null){
	const glob = require("glob");
	var i = ` --dialog-type="directory" `;
	if (default_path) i+= ` --default-path="${default_path}" `;
	if (title) i+= ` --title="${title}" `; 


	return new Promise(resolve=>{
		shell_exec(`electron %portal%/nodejs/dialog ${i}`,{
			hide_output:true
		}).then(response=>{
			var _path = JSON.parse(response)[0];
			console.log(_path);
			glob(`**`, {
                absolute:true,
                cwd:path.normalize(_path)
            }, function (er, dir_stat) {
                var files = dir_stat.filter(x=>fs.lstatSync(x).isFile());
                resolve(files);
            });
		});;
	});
}



var file_copy_contents = exports.file_copy_contents = function(file_path){
	return shell_exec(`type "${path.normalize(file_path)}" | clip`);
}


var encoded_url = exports.encoded_url = function(main_link,queryStringObject={}){
	var url = main_link;
	if (Object.keys(queryStringObject).length>0) url+="?";

	for (key in queryStringObject){
		var value = queryStringObject[key];
		url+=`${encodeURIComponent(key)}=${encodeURIComponent(value)}&`;
	}

	if (Object.keys(queryStringObject).length>0) url = url.replace(/&$/,'');

	return url;
}



var open_in_browser = exports.open_in_browser = function(url,browser='chrome',_options={}){
	var options = setDefaults({
		nodeIntegration:false
	},_options);

	var command='';
	if (browser==="electron"){
		command = `electron %portal%/nodejs/browser "${url}"`;
		if (options.nodeIntegration) command+=` --node-integration="true" `
	}else{
		command = `start ${browser} "${url}"`;
	}
	return shell_exec(command);
}


var copy_to_clipboard = exports.copy_to_clipboard = function(content){
	log.write(content);
	return file_copy_contents(log.file());
}


var unique_school_id = exports.unique_school_id = function(){
	return shell_exec(`php php/generate_school_id.php`,{
		hide_output:true
	});
}


var school_portal_ids = exports.school_portal_ids = function(){
	var excluded = ['.git'];
	var portal_properties_dir = variables.portal_properties_dir;
	var portals_in_tree = subdirectories(portal_properties_dir).filter(x=>!excluded.includes(x));

	var r = [];

	for (let portal_id of portals_in_tree){
		if (fs.existsSync(`${variables.portal_properties_dir}/${portal_id}/portal-properties.json`)){
			var _school = school(portal_id);

			try{
				var compulsory_criteria = [
					_school.ssh,
					_school.settings,
					_school.htaccess,
					_school.htaccess.conditions
				];

				var compulsory_accumulated = [];
				for (let compulsory_criterion of compulsory_criteria){
					compulsory_accumulated.push(typeof compulsory_criterion != "undefined");
				}



				if (!compulsory_accumulated.includes(false)){
					var necessary_criteria = [
						_school.portal_id,
						_school.portal_url,
						_school.school_name,
						_school.handshake_auth_key,
						_school.integration_time,
						_school.ssh.host,
						_school.ssh.username,
						_school.ssh.password,
						_school.ssh.passphrase,
						_school.settings.db_name,
						_school.settings.db_user,
						_school.settings.db_password,
						_school.htaccess.conditions.https
					];

					var neccesary_accumulated = [];
					for (let neccesary_criterion of necessary_criteria){
						neccesary_accumulated.push(typeof neccesary_criterion != "undefined");
					}

					if (!neccesary_accumulated.includes(false)){
						r.push(portal_id);
					}
				}
			}catch(e){}
		}
	}
	return r;
}


var school = exports.school = function(school_portal_id){
	var _servers = servers();
	var servers_ids = Object.keys(_servers);
	if (servers_ids.includes(school_portal_id)){
		return _servers[school_portal_id];
	}else{
		return JSON.parse(fs.readFileSync(`${variables.portal_properties_dir}/${school_portal_id}/portal-properties.json`,"utf-8"));
	}
}


var schools = exports.schools = function(order_by="integration_time",sort="ASC"){
	var _school_portal_ids = school_portal_ids();
	
	var schools_data = [];

	for(let portal_id of _school_portal_ids){
		schools_data.push(school(portal_id));
	}

	if (sort==="ASC"){
		schools_data = schools_data.sort((a,b)=>{
			return a[order_by] - b[order_by]
		});
	}else if(sort==="DESC"){
		schools_data = schools_data.sort((a,b)=>{
			return b[order_by] - a[order_by]
		});
	}
	
	return schools_data;
}


var active_schools = exports.active_schools = function(){
	
	var _schools = schools();
	var _active_schools = [];
	for (let _school of _schools){
		if (_school.active){
			_active_schools.push(_school)
		}
	}
	
	return _active_schools;
}



var inactive_schools = exports.inactive_schools = function(){
	
	var _schools = schools();
	var _inactive_schools = [];
	for (let _school of _schools){
		if (!_school.active){
			_inactive_schools.push(_school)
		}
	}
	
	return _inactive_schools;
}



var portal_ids = exports.portal_ids = function(){
	var r = [];
	var _schools = schools();
	for(let _school of _schools){
		r.push(_school.portal_id);
	}
	return r;
}


var forward_slash = exports.forward_slash = function(string){
	return string.replace(/\\/g,"/");
}

var back_slash = exports.back_slash = function(string){
	return string.replace(/\//g,"\\");
}

var escapeRegExp = exports.escapeRegExp = function(string) {
	return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

var escape_sed = exports.escape_sed = function(command){
	return escapeRegExp(command).replace(/\//g,"\\/").replace(/\\\\\\/g,'\\');
}

var brackets_replace = exports.brackets_replace = function(string,properties,brackets=2){
	try{
		for(let property in properties){
			var value = properties[property];
			var b = "{".repeat(brackets);
			var eb = "}".repeat(brackets);
			string = string.replace(new RegExp(escapeRegExp(`${b}${property}${eb}`),'g'),value);
		}
	}catch(e){}
    return string;
}



var dollar_replace = exports.dollar_replace = function(string,properties){
	try{
		for(let property in properties){
			var value = properties[property];
			string = string.replace(new RegExp(escapeRegExp(`$${property}`),'g'),value);
		}
	}catch(e){}
    return string;
}


var real_array = exports.real_array = function(array,trim=false){
	var output = [];
	array.forEach(element=>{
		if (element.trim().length>0){
			output.push(trim?element.trim():element);
		}
	});
	return output;
}


var taskkil = exports.taskkil = function(process_name){
	return shell_exec(`taskkil /IMF ${process_name}`)
}


var colorpicker = exports.colorpicker = function(output="last_color"){
	var last_color = "ERROR_NO_COLOR_SUPPLIED"
	var history = [];
	var _resolve;

	return new Promise(resolve=>{
		
		shell_exec(`"C:/Program Files/Colorpicker/Colorpicker.exe"`,{
			hide_output:true
		}).then(response=>{
			try{
				response.match(/{ lastColor: '(.*)' }/g).forEach(element=>{
					var color = element.match(/lastColor: '(.*)'/)[1];
					history.push(color);
				});
				last_color = history.slice(-1).pop()
			}catch(e){}
			if (output==="last_color"){
				copy_to_clipboard(last_color).then(_=>{
					resolve(last_color);
				})
			}
			 
			if (output==="history"){
				resolve(history);
			}
			
		});
	});
}



var sleep = exports.sleep = function(milliseconds){
	return new Promise(resolve=>{
		setTimeout(resolve,milliseconds);
    });
}




var modify_resource_icon = exports.modify_resource_icon = function(resource_name,resource_icon_path,_options){

	var options = setDefaults({
		cwd:__dirname
	},_options);

	return shell_exec(`ResourceHacker -open "${resource_name}" -save "${resource_name}" -action addoverwrite  -res "${resource_icon_path}" -mask ICONGROUP,1,1033`,{cwd:options.cwd});
}

/**
 * @param select Decide if file path is focused in directory. Default `true`
 */
var show_in_explorer = exports.show_in_explorer = (file_path,select=true)=>{
	file_path = path.normalize(file_path);
    return new Promise(resolve=>{
		var command;
		if (select){
			command = `explorer /select,"${file_path}"` 
		}else{
			command = `explorer "${file_path}"`
		}
		 
		shell_exec(command).then(_=>{
			resolve();
		})
    });
}


var dotted_parameter = exports.dotted_parameter = function(object,parameter,value){
    if (typeof parameter == 'string')
        return dotted_parameter(object,parameter.split('.'), value);
    else if (parameter.length==1 && value!==undefined)
        return object[parameter[0]] = value;
    else if (parameter.length==0)
        return object;
    else
        return dotted_parameter(object[parameter[0]],parameter.slice(1), value);
}



var match = exports.match = function(pattern,haystack){
	var regex = new RegExp(pattern,"g")
	var matches = [];
	
	var match_result = haystack.match(regex);
	
	for (let index in match_result){
		var item = match_result[index];
		matches[index] = item.match(new RegExp(pattern)); 
	}
	return matches;
}


var parse_htaccess = exports.parse_htaccess = function(portal_id){

	const portal = process.env.portal;
	const htaccess_template_path = path.normalize(`${portal}/templates/htacess`);
	const htaccess_template = fs.readFileSync(htaccess_template_path,"utf-8");
	var htaccess = htaccess_template;

	const _variables = match("{{(.*)}}",htaccess_template);

	var _school = school(portal_id);

    for (let value of _variables){
		var variable = value[1];
		var dotted_value = dotted_parameter(variable,_school);
        htaccess = htaccess.replace(`{{${variable}}}`,((variable==="rel_dirname" && dotted_value.length===0)?"/":"")+dotted_value);
    }
    
    
    var lines = htaccess.split('\n');
    var new_lines = [];
    for (let index in lines){
        var line = lines[index];
        var matches =  match("<<(.*)>>",line);
        if (matches.length>0){
            var condition = matches[0][1];
    
            if (_school.htaccess.conditions[condition]){
                new_lines.push(line.replace(`<<${condition}>>`,""));
            }
        }else{
            if (!(index===0 && line.trim().length===0)){
                new_lines.push(line);
            }
        }
    }
    if (new_lines[0].trim().length===0) new_lines = new_lines.slice(1,new_lines.length);
    htaccess = new_lines.join('\n');
    fs.writeFileSync(`${variables.portal_properties_dir}/${portal_id}/.htaccess`,htaccess);
}



var require_portal_id = exports.require_portal_id = function(supposed_portal_id){
	var stdout = require("./stdout");
	return new Promise(resolve=>{
		if (supposed_portal_id){
			resolve(supposed_portal_id);
		}else{
			stdout.info_prompt("portal_id","required","demo").then(p=>{
				resolve(p);
			});
		}
	});
}



var portal_api_request = exports.portal_api_request = function(node_id,relative_server_script="assets/handshake.php",request_options={}){
	var unirest = require("unirest");
	var _node = node(node_id);

	request_options = setDefaults({
		fields:{},
		attachments:{}
	},request_options);

	return new Promise(resolve=>{
		unirest.post(_node.node_url+"/"+relative_server_script).headers({
			"Authorization": _node.handshake_auth_key
		}).field(Object.assign({
			"auth_key":_node.handshake_auth_key
		},request_options.fields)).attach(request_options.attachments).then(async response=>{
			response['is_successful'] = response.status===200 && response.body && response.body.trim().length>0 && response.body.indexOf('Error: ')===-1 && response.body.indexOf('Redirecting')===-1;             
			resolve(response);
		});
	});
}



var portal_http_upload = exports.portal_http_upload = function(portal_id,relative_local_path,relative_remote_path=null,relative_server_script="/assets/handshake.php"){
	const portal = process.env.portal;
	return portal_api_request(portal_id,relative_server_script,{
		fields:{
			"filename":"\\"+(relative_remote_path?relative_remote_path:relative_local_path)
		},
		attachments:{
			"file":path.normalize(portal+"\\"+relative_local_path)
		}
	});
}


var file_request_success_message = exports.file_request_success_message = function(school,response,row_cursor_position,rows){
	const { default:chalk } = require("chalk");
	console.log("");
	console.log(`${chalk.yellowBright(response.body)} ${chalk.whiteBright('*')} ${chalk.yellowBright(`${row_cursor_position}/${rows.length} files synced`)} ${chalk.whiteBright('*')} ${chalk.yellowBright(`${parseFloat(((row_cursor_position/rows.length)*100).toFixed(2))}%`)}`);
}



var file_request_error_message = exports.file_request_error_message = function(school,response){
	const { default:chalk } = require("chalk");
	console.log("");
	console.log(`${school.school_name} * ${school.portal_id} * ${chalk.redBright(response.raw_body)} * ${chalk.redBright(response.statusMessage)}`);
	console.log("");
}



var servers = exports.servers = function(){
	var properties_containers = subdirectories(variables.servers_properties_dir);
	
	var servers_information = {};
	for (let properties_container of properties_containers){
		servers_information[properties_container] = JSON.parse(fs.readFileSync(`${variables.servers_properties_dir}/${properties_container}/server-properties.json`,"utf-8"));
		servers_information[properties_container]["privateKey"] = path.normalize(`${variables.servers_properties_dir}/${properties_container}/id_rsa.ppk`) 
	}
	return servers_information;
}


var server = exports.server = function(server_id){
	return servers()[server_id];
}


var server_ids = exports.server_ids = function(){
	return subdirectories(variables.servers_properties_dir);
}

 
var write_portal_properties = exports.write_portal_properties = function(portal_id,properties){
	var _portal_properties_dir = portal_properties_dir(portal_id);
	fs.writeFileSync(path.normalize(`${_portal_properties_dir}/portal-properties.json`),JSON.stringify(properties,null,4));
}


class minify{
	
	static js(code){
		const { minify } = require("javascript-minifier");
		return new Promise(resolve=>{
			minify(code).then(minified_code=>{
				resolve(minified_code);
			}).catch(error=>{
				resolve(null);
			});
		})
	}
}

exports.minify = minify;


var git_full_address = exports.git_full_address = function(username,password){
	return `https://${username}:${encodeURIComponent(password)}@github.com/${username}/`;
}



var random_float = exports.random_float = function(min,max,precision=2){
    return (Math.random() * (max - min) + min).toFixed(precision);
}


var config = exports.config = function(){
    return JSON.parse(fs.readFileSync("/root/server-config.json").toString())
}


var mysql_cnf = exports.mysql_cnf = function(){
	return ini.parseSync(`${os.homedir()}/.my.cnf`);
}


var writeConfig = exports.writeConfig = function(_config,_document_root=null){
	if (!_document_root) _document_root = document_root();
	let _path = path.join(_document_root,".webman","config.json");
	return writeFileSync(_path,JSON.stringify(_config,null,4));
}


var writeFileSync = exports.writeFileSync = function(_path,content){
	if (!fs.existsSync(path.dirname(_path))) fs.mkdirSync(path.dirname(_path),{recursive:true});
	fs.writeFileSync(_path,content)
}


var hash = exports.hash = function(string){
	var crypto = require('crypto');
	return crypto.createHash('sha256').update(string).digest('hex');
}



var ftp_connection = exports.ftp_connection = function(ftp_config){
	var Client = require('ftp');

	return new Promise(resolve=>{
		var c = new Client();

		c.connect(ftp_config);

		c.on('ready', function() {
			resolve(c);
		});
	});

}



var upload_files = exports.upload_files = function(local_remote_array, ftp_connection, message = null){

	return new Promise(async resolve=>{
		
		for (let local_remote of local_remote_array){
			var local_path = local_remote["local"];
			var remote_path = local_remote["remote"];
			
			const chalk = require("chalk");
			
			console.log();

			if (message){
				message(local_path,remote_path);
			}else{
				console.log(`${chalk.magentaBright('put file:')} ${chalk.greenBright(forward_slash(local_path))} ${chalk.redBright(`->`)} ${chalk.cyanBright(forward_slash(remote_path))}`);
			}

			await new Promise(resolve=>{
				ftp_connection.mkdir(path.dirname(remote_path),true,(err)=>{
					resolve();
				})
			});
			
			await ftp_put(local_path,remote_path, ftp_connection);

			resolve();
		}
	});
}



var upload_file = exports.upload_file = function(local_path,remote_path,ftp_connection,message){
	
	return upload_files([
		{
			local:local_path,
			remote:remote_path
		}
	],ftp_connection,message);
}


var ftp_config = exports.ftp_config = function(node_id){
	let _node = node(node_id);
	
	let _ftp_config = _node.ftp;

	_ftp_config["host"] = _node.host;
	_ftp_config["rel_dirname"] = _node.rel_dirname;
	return _ftp_config;
}


var node_ftp_connection = exports.node_ftp_connection = function(node_id){
	return ftp_connection(ftp_config(node_id));
}


var upload_project_files = exports.upload_project_files = function(file_relative_paths, node_id, ftp_connection,message){
	var local_remote_array = [];

	var _node = node(node_id);

	for (let rel_path of file_relative_paths){
		
		local_remote_array.push({
			local: path.join(_node.rel_dirname,rel_path),
			remote: `/public_html${_node.rel_dirname}/${rel_path}`
		});
	}
	return upload_files(local_remote_array, ftp_connection, message);
}



var upload_project_file = exports.upload_project_file = function(file_relative_path, node_id, ftp_connection, message){
	return upload_project_files([file_relative_path], node_id, ftp_connection, message);
}


var ftp_put = exports.ftp_put = function(local_file_path, remote_file_path, ftp_client_connection){
	return new Promise(resolve=>{
		ftp_client_connection.put(local_file_path, remote_file_path, function(err) {
			resolve(err?err:true);
		});
	});
}




var ftp_mkdir = exports.ftp_mkdir = function(remote_path,ftp_connection){

	return new Promise(resolve=>{

		var chalk = require("chalk");
		println();
		console.log(chalk.magentaBright(`ftp > mkdir -> ${remote_path}`));

		ftp_connection.mkdir(remote_path,true,(err)=>{
			resolve();
		});

	});
}


var project_ftp_mkdir = exports.project_ftp_mkdir = function(relative_path,node_id,ftp_connection){
	return ftp_mkdir(`${remote_dir(node_id)}/${relative_path}`,ftp_connection);
}


var hftp_request = exports.hftp_request = function(node_id,request_options={}){
	var unirest = require("unirest");

	const _node = node(node_id);

	var request_options = setDefaults({
		fields:{},
		attachments:{}
	},request_options);

	return new Promise(resolve=>{
		unirest.post(_node.node_url.concat("/assets/handshake.php")).headers({
			"Authorization": _node.handshake_auth_key
		}).field(Object.assign({
			"auth_key":_node.handshake_auth_key
		},request_options.fields)).attach(request_options.attachments).then(async response=>{
			response['is_successful'] = response.status===200 && response.body && response.body.trim().length>0 && response.body.indexOf('Error: ')===-1 && response.body.indexOf('Redirecting')===-1;            
			resolve(response);
		});
	});
}




var base64_encode = exports.base64_encode = function(non_base64_string){
	return Buffer.from(non_base64_string).toString('base64');
}


var base64_decode = exports.base64_decode = function(base64_string){
	return Buffer.from(base64_string, 'base64').toString('ascii')
}


var spawn_process = exports.spawn_process = function(command,options=null){
	return new Promise(resolve=>{
        const proc = spawn(command,options);
        var output;
        proc.stdout.on("data",data=>{
            output = data;
        });
        proc.on("close",_=>{
            resolve(output?output.toString():"null");
        });
    })
}


var node_ids = exports.node_ids = function(){
	return Object.keys(config()["nodes"]);
}

var node = exports.node = function(node_id){
	if (!node_id)  node_id = node_ids()[0]; 
	return config()["nodes"][node_id];
}


var root = exports.root = function(root_ip_address){
	return config()["roots"][root_ip_address];
}


var node_root = exports.node_root = function(node_id=null){
	return root(node(node_id).host);
}


var active_node_ids = exports.active_node_ids = function(){
	let accumulator = [];

	for (let node_id of node_ids()){
		if (node(node_id).active) accumulator.push(node_id);
	}
	return accumulator;
}


var hstart = exports.hstart = function(command){
	return `hstart /NOCONSOLE "${command}"`;
}


var relative_to_document_root = exports.relative_to_document_root = function(absolute_path){
	return path.relative(document_root(),absolute_path);
}


var trace_save = exports.trace_save = async function(relative_path,is_source_file,is_specs_file,is_test_mode,node_id=null){

	let conn = sqlite.connection();

	_project_root = project_root();

	let _config = config();

	let _active_node_ids;
	if (node_id){
		_active_node_ids = [node_id];
	}else{
		_active_node_ids = active_node_ids();
	}

	let filename = relative_path;

	return new Promise(async resolve=>{

        for (let node_id of _active_node_ids){
			
			if (filename==="update.php"){

				let rows;
				await sqlite.fetch("SELECT node_id FROM 'update' WHERE node_id=?",[node_id],conn).then(_rows=>{
					rows = _rows;
				});

				if (rows.length===0){
					await sqlite.execute("INSERT INTO 'update' (node_id, synced) VALUES (?, ?)",[node_id, "false"],conn);
					//println(`New entry for '${filename} - ${node_id}' saved`);
				}else{
					await sqlite.execute("UPDATE 'update' SET synced = ? WHERE node_id=?",["false", node_id],conn);
					//println(`Initial entry for '${filename} - ${node_id}' saved`);
				}

			}else{

				let rows;
				await sqlite.fetch("SELECT node_id,filename FROM files WHERE node_id=? AND filename=?",[node_id,filename],conn).then(_rows=>{
					rows = _rows;
				});

				if (rows.length===0){
					await sqlite.execute("INSERT INTO files (node_id, filename, is_source_file, is_specs_file, synced) VALUES (?, ?, ?, ?, ?)",[node_id,filename, is_source_file?"true":"false", is_specs_file?"true":"false","false"],conn);
					//println(`New entry for '${filename} - ${node_id}' saved`);
				}else{
					await sqlite.execute("UPDATE files SET synced = ? WHERE node_id=? AND filename=?",["false", node_id,filename],conn);
					//println(`Initial entry for '${filename} - ${node_id}' saved`);
				}
			}
			
		}


		if (_config.test.active){
			let test_rows;
			let node_id = _config.test.node_id;
			await sqlite.fetch("SELECT node_id,filename FROM test_files WHERE node_id=? AND filename=?",[node_id,filename],conn).then(_rows=>{
				test_rows = _rows;
			});

			if (test_rows.length===0){
				await sqlite.execute("INSERT INTO test_files (node_id, filename, is_source_file, is_specs_file, synced) VALUES (?, ?, ?, ?, ?)",[node_id,filename, is_source_file?"true":"false", is_specs_file?"true":"false","false"],conn);
				//println(`New entry for '${filename} - ${node_id}' saved`);
			}else{
				await sqlite.execute("UPDATE test_files SET synced = ? WHERE node_id=? AND filename=?",["false", node_id,filename],conn);
				//println(`Initial entry for '${filename} - ${node_id}' saved`);
			}
		}
		println("Saved");
		conn.close()
		resolve();
    });
}


var println = exports.println = function(message=''){
	console.log(message);
}


var public_ip = exports.public_ip = function(){
	const publicIp = require('public-ip');
	return publicIp.v4();
}


var rigid_public_ip = exports.rigid_public_ip = function(){
	var _public_ip;

	return new Promise(async resolve=>{
		await public_ip().then(ip=>{
			_public_ip = ip;
		});
	
		var p = _public_ip.split(".");
	
		resolve(`${p[0]}.${p[1]}.%.%`);
	});
} 


var round = exports.round = function(number, precision=2) {
	return Math.round(number * Math.pow(10, precision)) / Math.pow(10, precision);
}



var random_characters = exports.random_characters = function(length) {
	var result           = '';
	var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for ( var i = 0; i < length; i++ ) {
	   result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
 }
 
 
 
 var random_digits = exports.random_digits = function(length) {
	var result           = '';
	var characters       = '0123456789';
	var charactersLength = characters.length;
	for ( var i = 0; i < length; i++ ) {
	   result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
 }
 
 
 
var unique_from_fs = exports.unique_from_fs = function(directory_path, length, context){
	let  content;
	while(true){
		if (context==="digits"){
			content = random_digits(length)
		}else{
			content = random_characters(length);
		}


		if (!fs.existsSync(path.join(directory_path,content))){
			break;
		}
	}
	 
	return content;
 
 }
 
 
var unique_digits_from_fs = exports.unique_digits_from_fs = function(directory_path, length){
	return unique_from_fs(directory_path, length, "digits");
 }
 
 
 
var unique_characters_from_fs = exports.unique_characters_from_fs = function(directory_path, length){
	return  unique_from_fs(directory_path, length, "characters");
}


var new_tmp_file = exports.new_tmp_file = function(file_extension="",length=7){
	let _document_root = document_root();
	if (file_extension.length>0) file_extension = ".".concat(file_extension)

	let _tmp_directory = tmp_directory();
	let file_name = unique_characters_from_fs(_tmp_directory,length).concat(file_extension);
	let file_path = path.join(_tmp_directory,file_name);
	return file_path;
}


var template_path = exports.template_path = function(template_relative_path){
	let _project_root = project_root();
	let _document_root = document_root();
	let document_file_path = `${_document_root}/.webman/templates/${template_relative_path}`;
	let project_file_path = `${_project_root}/templates/${template_relative_path}`;

	let file_path = document_file_path;

	if (!fs.existsSync(file_path)) file_path = project_file_path;

	return file_path;
}


var template_content = exports.template_content = function(template_relative_path){
	return fs.readFileSync(template_path(template_relative_path)).toString();
}



var copyTemplateFile = exports.copyTemplateFile = function(template_relative_file_path,document_relative_file_path){
	return new Promise(async function(){
		let _document_root = document_root();
		let _path = path.join(_document_root,document_relative_file_path);
		fs.copyFileSync(template_path(template_relative_file_path),_path);
		await shell_exec(`webman save "${_path}"`);
	});
}


var copyProjectTemplateFile = exports.copyProjectTemplateFile = function(template_relative_file_path){
	return copyTemplateFile(template_relative_file_path,template_relative_file_path);
}



var copyTemplateDirectory = exports.copyTemplateDirectory = function(template_relative_directory,document_relative_directory){
	let _document_root = document_root();
	return copyFiles(template_path(template_relative_directory),path.join(_document_root,document_relative_directory))
}


var copyProjectTemplateDirectory = exports.copyProjectTemplateDirectory = function(template_relative_directory){
	return copyTemplateDirectory(template_relative_directory,template_relative_directory);
}





/**
 * @param {String} source
 * @param {String} out
 * @returns {Promise}
 */
var zipDirectory = exports.zipDirectory = function(source_flle_path, output_file_path) {
	const archiver = require('archiver');
  	const archive = archiver('zip', { zlib: { level: 9 }});
 	const stream = fs.createWriteStream(output_file_path);

	return new Promise((resolve, reject) => {
		archive
		.directory(source_flle_path, false)
		.on('error', err => reject(err))
		.pipe(stream)
		;

		stream.on('close', () => resolve());
		archive.finalize();
	});
}


var arg_node_ids = exports.arg_node_ids = function(argv){
	let _node_ids;
	if (argv["node-id"]){
		_node_ids = [argv["node-id"]];
	}else if (argv["node-ids"]){
		_node_ids = real_array(argv["node-ids"].split(","),true);
	}else{
		_node_ids = active_node_ids();
	}

	return _node_ids;
}



var bin2hex = exports.bin2hex = function(b) {
    return b.match(/.{4}/g).reduce(function(acc, i) {
        return acc + parseInt(i, 2).toString(16);
    }, '')
}

var hex2bin = exports.hex2bin = function(h) {
    return h.split('').reduce(function(acc, i) {
        return acc + ('000' + parseInt(i, 16).toString(2)).substr(-4, 4);
    }, '')
}


var escapeShell = exports.escapeShell = function(cmd) {
	return '"'+cmd.replace(/(["\s'$`\\])/g,'\\$1')+'"';
};



var getGoogleAPIAuth = exports.getGoogleAPIAuth = function(token_path,credentials_path){

    let credentials = JSON.parse(fs.readFileSync(credentials_path).toString());
    let token = JSON.parse(fs.readFileSync(token_path).toString());

    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    oAuth2Client.setCredentials(token);
    return oAuth2Client;
}



var googleAccountAPIAuth = exports.googleAccountAPIAuth = function(emailAddress){
	return getGoogleAPIAuth(
		`${os.homedir()}/public_html/assets/google/accounts/${emailAddress}/token.json`,
		`${os.homedir()}/public_html/assets/google/accounts/${emailAddress}/credentials.json`
	)
}


var UTCDate = exports.UTCDate = function(){
	return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}


var zipDatabases = exports.zipDatabases = async function(db_connection){

	const db  = require("./mysql");
	const argv = require("yargs").argv;
	const AdmZip = require('adm-zip');
	const spawn = require('child_process').spawn;

    let subquery = "";
    if (argv["like"]) subquery = `LIKE '${argv["like"]}'`;


    var zip = new AdmZip();

    for (let database_name of await db.all_databases(subquery,db_connection)){
        console.log(`Dumping ${database_name}`);
        
		let dump = "";

		let dumpToFile = ".dump.sql";

		await new Promise(resolve=>{
			spawn('mysqldump', [database_name]).stdout.pipe(fs.createWriteStream(dumpToFile)).on("finish",_=>{
				resolve();
			});
			
		});

		dump = fs.readFileSync(dumpToFile);

        console.log(`Adding ${database_name} to zip archive`);
        zip.addFile(`databases/${database_name}.sql`,Buffer.alloc(dump.length,dump));
        println();
        println();
    }

    console.log("Writing client...");

    let content = JSON.stringify(mysql_cnf(),null,4);

    zip.addFile(`client.json`,Buffer.alloc(content.length,content));

	let zipFileName = `db-backup-${UTCDate()}.zip`; 

    console.log(`Creating ${zipFileName}`);

    zip.writeZip(zipFileName);

    println();

	return zipFileName;
}