class Client {
	constructor(socket) {
		this.ws = socket;
		this.sid = socket.id;
		this.id = global.lastid;
		this.controlled = false;
		this.controller = 0;
		this.markedController = false;
		this.ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
		if(this.ip == "::1") this.ip = "localhost";
		global.lastid++;
	};
};

module.exports = Client;