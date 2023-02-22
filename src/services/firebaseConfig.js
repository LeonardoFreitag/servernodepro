const fb = require('firebase');

const config = {
    // METTRE
    // apiKey: "AIzaSyAD3-51Sk8rw9NbjJ07_xe9f3MO3Ij8X3Q",
    // authDomain: "mettre-a6183.firebaseapp.com",
    // databaseURL: "https://mettre-a6183.firebaseio.com",
    // projectId: "mettre-a6183",
    // storageBucket: "mettre-a6183.appspot.com",
    // messagingSenderId: "444725282441",
    // appId: "1:444725282441:web:b694c7611123b7e6152858"

    // METTRESMART
    apiKey: 'AIzaSyCrZbKZwMbfUFJBTJe7EwQtT24ScMllqRA',
    authDomain: 'mettresmart.firebaseapp.com',
    databaseURL: 'https://mettresmart.firebaseio.com',
    projectId: 'mettresmart',
    storageBucket: 'mettresmart.appspot.com',
    messagingSenderId: '525578500447',
    appId: '1:525578500447:web:f7460a49fd1cc9654a1eea',
};

fb.initializeApp(config);

exports.firebase = fb;
