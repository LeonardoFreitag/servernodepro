import firebase from 'firebase';

const firebaseConfig = {
  apiKey: 'AIzaSyCrZbKZwMbfUFJBTJe7EwQtT24ScMllqRA',
  authDomain: 'mettresmart.firebaseapp.com',
  databaseURL: 'https://mettresmart.firebaseio.com',
  projectId: 'mettresmart',
  storageBucket: 'mettresmart.appspot.com',
  messagingSenderId: '525578500447',
  appId: '1:525578500447:web:f7460a49fd1cc9654a1eea',
};

firebase.initializeApp(firebaseConfig);

export { firebase };
