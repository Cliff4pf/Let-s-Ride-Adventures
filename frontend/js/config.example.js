// config.js - Configuration file for environment-specific settings
// This file should not be committed to version control with sensitive data
// Copy this file to config.js and fill in your own values

const isLocalDev = window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1'
    || window.location.protocol === 'file:';

const config = {
    firebase: {
        apiKey: "YOUR_FIREBASE_API_KEY_HERE",
        authDomain: "YOUR_FIREBASE_AUTH_DOMAIN_HERE",
        projectId: "YOUR_FIREBASE_PROJECT_ID_HERE",
        storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET_HERE",
        messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID_HERE",
        appId: "YOUR_FIREBASE_APP_ID_HERE"
    },
    api: {
        baseUrl: isLocalDev ? 'http://localhost:5202/api' : 'https://your-production-api.com/api'
    }
};

export default config;
