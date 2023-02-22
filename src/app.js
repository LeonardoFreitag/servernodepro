"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
// const router = express.Router();

// react mettre
const indexRoute = require("./routes/index-route");
const productRoute = require("./routes/products-route");
const gruposRoute = require("./routes/grupos-route");
const subgruposRoute = require("./routes/subgrupos-route");
const obsRoute = require("./routes/obs-route");
const mesasRoute = require("./routes/mesas-route");
const itensRoute = require("./routes/itens-route");
const funcRoute = require("./routes/func-route");
const configRoute = require("./routes/config-route");

// mettre smart
const providersRoute = require("./routes/providers-route");
const neighRoute = require("./routes/neigh-route");
const paymentRoute = require("./routes/payment-rout");
const requestRoute = require("./routes/request-route");
const productManagerRoute = require("./routes/product-manager-route");

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, "images")));

//rotas reactmettre
app.use("/", indexRoute);
app.use("/products", productRoute);
app.use("/obs", obsRoute);
app.use("/mesas", mesasRoute);
app.use("/itens", itensRoute);
app.use("/func", funcRoute);
app.use("/config", configRoute);
app.use("/grupos", gruposRoute);
app.use("/subgrupos", subgruposRoute);

// rotas mettre smart
app.use("/providers", providersRoute);
app.use("/neighborhood", neighRoute);
app.use("/payment", paymentRoute);
app.use("/request", requestRoute);
app.use("/productManager", productManagerRoute);

module.exports = app;
