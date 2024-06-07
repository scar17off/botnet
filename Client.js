class Client {
	constructor(socket) {
		this.ws = socket;
		this.sid = socket.id;
		this.id = global.lastId++;
		this.connected = false;
		this.controlled = false;
		this.controller = 0;
		this.markedController = false;
		this.ip = (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address).split(',')[0];
		if(this.ip == "::1") this.ip = "localhost";
	}
}

module.exports = Client;