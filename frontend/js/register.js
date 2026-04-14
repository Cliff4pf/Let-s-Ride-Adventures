const API_BASE_URL = 'http://localhost:5202/api';

const registerForm = document.getElementById('registerForm');

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('registerError');
        const registerBtn = document.getElementById('registerBtn');

        try {
            registerBtn.disabled = true;
            registerBtn.textContent = 'Creating account...';
            errorDiv.style.display = 'none';

            // Call Backend to Create UserProfile and Firebase Auth Account
            const response = await fetch(`${API_BASE_URL}/User/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fullName: fullName,
                    email: email,
                    password: password
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to create user profile in backend.');
            }

            alert("Account created successfully. Please log in.");
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Registration failed:", error);
            let msg = error.message || 'Failed to create account.';
            // common network issue
            if (error instanceof TypeError && /Failed to fetch/i.test(error.message)) {
                msg = 'Network error. Please check your connection and try again.';
            }
            document.getElementById('errorText').textContent = msg;
            errorDiv.style.display = 'block';
        } finally {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Create Account';
        }
    });
}
