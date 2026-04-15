import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, getIdToken, signOut, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const API_BASE_URL = 'http://localhost:5202/api';
const googleProvider = new GoogleAuthProvider();

// utility: translate Firebase auth error codes into user-friendly messages
function firebaseErrorMessage(error) {
    if (!error || !error.code) {
        return error?.message || 'Authentication error. Please try again.';
    }

    switch (error.code) {
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
            return 'No account found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/user-disabled':
            return 'Your account has been disabled. Contact support.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        case 'auth/email-already-in-use':
            return 'This email is already in use. Try logging in or resetting your password.';
        case 'auth/popup-closed-by-user':
            return 'Sign‑in was cancelled. Please try again.';
        case 'auth/popup-blocked':
            return 'Popup was blocked by the browser. Allow popups and try again.';
        case 'auth/cancelled-popup-request':
            return 'Sign‑in request was cancelled. Please retry.';
        default:
            return error.message || 'Authentication error. Please try again.';
    }
}

// Email Login Button - Show password form
const emailLoginBtn = document.getElementById('emailLoginBtn');
const loginForm = document.getElementById('loginForm');

if (emailLoginBtn) {
    emailLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('email').focus();
    });
}

// Forgot Password Modal Handler
const modal = document.getElementById('forgotPasswordModal');
const forgotBtn = document.getElementById('forgotPasswordBtn');
const closeBtn = document.getElementById('closeModal');
const backBtn = document.getElementById('backToLogin');
const resetForm = document.getElementById('resetForm');

if (forgotBtn) {
    forgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        setTimeout(() => modal.style.opacity = '1', 10);
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
    });
}

if (backBtn) {
    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 300);
    });
}

if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.opacity = '0';
            setTimeout(() => modal.style.display = 'none', 300);
        }
    });
}

// Password Reset Form Submission - Sends reset email to Gmail
if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;
        const resetError = document.getElementById('resetError');
        const resetSuccess = document.getElementById('resetSuccess');
        const submitBtn = resetForm.querySelector('button[type="submit"]');

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            resetError.style.display = 'none';
            resetSuccess.style.display = 'none';

            // Send Firebase password reset email to user's Gmail
            await sendPasswordResetEmail(auth, email);
            
            resetForm.reset();
            resetSuccess.style.display = 'block';
            
            // Auto-close modal after 2 seconds
            setTimeout(() => {
                modal.style.opacity = '0';
                setTimeout(() => {
                    modal.style.display = 'none';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Reset Link';
                }, 300);
            }, 2000);
        } catch (error) {
            console.error('Reset email error:', error);
            // reuse friendly translation and add a fallback
            let errorMsg = firebaseErrorMessage(error);
            if (error.code === 'auth/user-not-found') {
                // already handled above, but ensure clarity
                errorMsg = 'No account found with this email address.';
            }
            
            resetError.textContent = errorMsg;
            resetError.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
        }
    });
}

// Existing login form handler
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
            // translate firebase error codes or use provided message
            const friendly = firebaseErrorMessage(error);
            errorDiv.textContent = friendly;
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

// Google Sign-In Handler
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('loginError');
        const errorMessage = document.getElementById('errorMessage');

        try {
            googleLoginBtn.disabled = true;
            googleLoginBtn.textContent = 'Signing in with Google...';
            errorDiv.style.display = 'none';

            // 1. Authenticate with Firebase using Google
            const userCredential = await signInWithPopup(auth, googleProvider);
            const user = userCredential.user;

            // 2. Get the JWT token
            const idToken = await getIdToken(user, true);

            // 3. Verify/Register User with Backend
            try {
                const response = await fetch(`${API_BASE_URL}/User/me`, {
                    headers: {
                        "Authorization": `Bearer ${idToken}`
                    }
                });

                let profile;

                if (!response.ok) {
                    if (response.status === 404) {
                        // User doesn't exist in backend - need to create account
                        const registerRes = await fetch(`${API_BASE_URL}/User/register`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${idToken}`
                            },
                            body: JSON.stringify({
                                email: user.email,
                                firstName: user.displayName?.split(' ')[0] || '',
                                lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                                phoneNumber: user.phoneNumber || '',
                                profilePicture: user.photoURL || '',
                                userType: 'Tourist'
                            })
                        });

                        if (!registerRes.ok) {
                            await signOut(auth);
                            throw new Error('Failed to create account. Please try registering manually.');
                        }

                        const regApiRes = await registerRes.json();
                        profile = regApiRes.data;
                    } else {
                        await signOut(auth);
                        throw new Error("Account provisioning incomplete. Contact admin.");
                    }
                } else {
                    const apiRes = await response.json();
                    profile = apiRes.data;
                }

                // 4. Check account status
                if (profile.status !== 'Active') {
                    await signOut(auth);
                    if (profile.status === 'Suspended') {
                        throw new Error("Account suspended. Contact admin.");
                    }
                    throw new Error(`Account is ${profile.status}. Contact support.`);
                }

                // 5. Store token in localStorage
                localStorage.setItem('ridehub_token', idToken);
                localStorage.setItem('user_email', user.email);

                // 6. Redirect to dashboard
                window.location.href = 'dashboard.html';
            } catch (apiError) {
                console.error("API error:", apiError);
                errorMessage.textContent = apiError.message || 'Failed to verify account.';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error("Google login failed:", error);
            // map common codes, fall back to helper
            const friendly = firebaseErrorMessage(error);
            errorMessage.textContent = friendly;
            errorDiv.style.display = 'block';
        } finally {
            googleLoginBtn.disabled = false;
            googleLoginBtn.textContent = 'Continue with Google';
        }
    });
}
