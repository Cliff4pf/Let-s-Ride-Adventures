import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, getIdToken, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const API_BASE_URL = 'http://localhost:5202/api';
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');

        try {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing in...';
            errorDiv.style.display = 'none';

            // 1. Authenticate with Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Get the JWT token
            const idToken = await getIdToken(user, true);

            // 3. Verify Account Provisioning & Active Status via Backend
            const response = await fetch(`${API_BASE_URL}/User/me`, {
                headers: {
                    "Authorization": `Bearer ${idToken}`
                }
            });
            if (!response.ok) {
                await signOut(auth);
                if (response.status === 404) {
                    // no backend profile yet
                    throw new Error("No account found. Please register.");
                }
                throw new Error("Account provisioning incomplete. Contact admin.");
            }

            const apiRes = await response.json();
            const profile = apiRes.data;

            if (profile.status !== 'Active') {
                await signOut(auth);
                if (profile.status === 'Suspended') {
                    throw new Error("Account suspended. Contact admin.");
                }
                throw new Error(`Account is ${profile.status}. Contact support.`);
            }

            // 4. Store in localStorage
            localStorage.setItem('ridehub_token', idToken);

            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error("Login failed:", error);
            errorDiv.textContent = error.message || "Invalid email or password.";
            errorDiv.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    });
}

// forgot password handling (separate from form submit)
const forgotLink = document.querySelector('a[href="#"]');
if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        if (!email) {
            alert('Please enter your email above to reset password.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert('Password reset email sent. Check your inbox.');
        } catch (err) {
            console.error('Reset email error', err);
            alert('Failed to send reset email. Make sure the email is correct.');
        }
    });
}
