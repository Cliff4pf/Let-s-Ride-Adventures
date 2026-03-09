import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBLze9_ZJzihpwpyRl54V2D9uB4ZVNgvEQ",
    authDomain: "ridehub-4ab73.firebaseapp.com",
    projectId: "ridehub-4ab73",
    storageBucket: "ridehub-4ab73.firebasestorage.app",
    messagingSenderId: "526401248721",
    appId: "1:526401248721:web:6b7af7336677a05d1a54f0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
