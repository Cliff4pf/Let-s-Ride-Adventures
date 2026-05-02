import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import config from './config.js';

const firebaseConfig = config.firebase;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
