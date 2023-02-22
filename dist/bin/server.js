"use strict";
"user strict";

const app = require("../app");

const http = require("http");

const debug = require("debug")("nodestr:server");

const config = require("../config"); // const customers = require('../services/customerService');


const requests = require("../services/requestService");

const providers = require("../services/providerService");

const venonService = require("../services/venonService");

const port = normalizePort(process.env.PORT || config.port); //'3333');

app.set("port", port);
const server = http.createServer(app);
var idProvider = "";
providers.getProviderId(result => {
  console.log(result);
  idProvider = result;
});
setInterval(function () {
  //customers.getNewCustomers(idProvider);
  requests.getNewRequests(idProvider);
}, 15000);
server.listen(port);
server.on("error", onError);
server.on("listening", onListening);
console.log("API rodando na porta " + port);

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
}

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  switch (error.code) {
    case "EACCES":
      console.error(bind + " requer privilégios elevados!");
      process.exit(1);
      break;

    case "EADDRINUSE":
      console.error(bind + " está em uso!");
      process.exit(1);
      break;

    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}