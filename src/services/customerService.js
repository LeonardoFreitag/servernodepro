'use strict';
const Firebird = require("node-firebird");
const config = require('../config');
var options = {};
options.host = config.host;
options.port = 3050;
options.database = config.connectionString;
options.user = 'SYSDBA';
options.password = 'masterkey';
options.lowercase_keys = false;
options.role = null;
options.pageSize = 4096;

const firebase = require('../services/firebaseConfig');

const fb = firebase.firebase;


exports.getNewCustomers = (idProvider) => {
    // console.log(idProvider);
    // let newCustomers = [];

    fb.firestore().collection("customers")
        .where("idProvider", "==", idProvider)
        .where("read", "==", false)
        .get()
        .then((result) => {
            result.forEach((item) => {
                saveCustomer(item.data());
            });

        })
        .catch((erro) => {
            console.log(erro);
        });
};


const saveCustomer = (customer) => {
    let data = customer;
    console.log(data);
    const {
        id, email, password, name, cpf, zipcode, address,
        number, neigh, feedelivery, complement, city, uf, ibge,
        whats, comments
    } = customer;

    // console.log(data);
    Firebird.attach(options, function(err, db) {

        if (err)
            throw err;

        // db = DATABASE
        db.query('SELECT oretorno FROM WEB_CLIENTES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                 [data.id, data.email, data.password, data.name, data.cpf, data.zipcode, data.address,
                  data.number, data.neigh, data.feeDelivery, data.complement, data.city, data.uf,
                  data.ibge, data.whats, data.comments], function(err, result) {
            if (err) {
                console.log('erro cadastro ' + err);
            } else {
                console.log(result);
            }
            db.detach();
        });

    });
    fb.firestore().collection("customers").doc(data.id).update({
        read: true
    });
}

