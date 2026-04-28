"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "firebase", {
  enumerable: true,
  get: function () {
    return _firebase.default;
  }
});
var _firebase = _interopRequireDefault(require("firebase"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const firebaseConfig = {
  apiKey: 'AIzaSyCrZbKZwMbfUFJBTJe7EwQtT24ScMllqRA',
  authDomain: 'mettresmart.firebaseapp.com',
  databaseURL: 'https://mettresmart.firebaseio.com',
  projectId: 'mettresmart',
  storageBucket: 'mettresmart.appspot.com',
  messagingSenderId: '525578500447',
  appId: '1:525578500447:web:f7460a49fd1cc9654a1eea'
};
_firebase.default.initializeApp(firebaseConfig);