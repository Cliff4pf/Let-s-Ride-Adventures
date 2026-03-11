// profile-modal.js - User profile edit modal component
import api from "../api.js";
import { showToast, icons } from "./shared.js";

export async function initializeProfileModal() {
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.style.cursor = 'pointer';
        userAvatar.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        
        // Add click event listener
        userAvatar.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await openProfileModal();
        });
        
        // Add hover effects
        userAvatar.addEventListener('mouseenter', () => {
            userAvatar.style.transform = 'scale(1.1)';
            userAvatar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        });
        
        userAvatar.addEventListener('mouseleave', () => {
            userAvatar.style.transform = 'scale(1)';
            userAvatar.style.boxShadow = 'none';
        });
    }
}

export async function openProfileModal() {
    try {
        // Fetch current user profile
        const res = await api.getCurrentUser();
        if (!res.ok) throw new Error('Failed to fetch user profile');
        
        const userData = await res.json();
        const profile = userData.data || {};

        const modalHtml = createProfileModalHtml(profile);
        
        // Create and show modal
        const modal = document.createElement('div');
        modal.id = 'profileModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);

        // Attach event listeners
        attachProfileModalEvents(modal, profile);

        // Show modal
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Profile modal error:', error);
        showToast('Failed to load profile', '#ef4444');
    }
}

function createProfileModalHtml(profile) {
    return `
        <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 style="margin: 0;">${icons.user} Profile & Settings</h2>
                <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">×</button>
            </div>

            <div class="modal-body" style="padding: 2rem;">
                <!-- Profile Section -->
                <div style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border-color);">
                    <div style="text-align: center; margin-bottom: 1.5rem;">
                        <div style="width: 80px; height: 80px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 700; margin: 0 auto 1rem;">
                            ${profile.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <h3 style="margin: 0; color: var(--text-primary);">${profile.fullName || 'User'}</h3>
                        <p style="margin: 0.5rem 0 0; color: var(--text-secondary);">${profile.role || 'Tourist'}</p>
                    </div>

                    <div style="background: var(--surface-hover); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                        <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">Account Status</p>
                        <p style="margin: 0.5rem 0 0; font-weight: 600; color: ${profile.status === 'Active' ? 'var(--success)' : 'var(--danger)'};">
                            ${profile.status === 'Active' ? '✓ Active' : '⚠ Inactive'}
                        </p>
                    </div>
                </div>

                <!-- Personal Information Section -->
                <div style="margin-bottom: 2rem;">
                    <h4 style="margin: 0 0 1rem; color: var(--text-primary); font-weight: 600;">Personal Information</h4>
                    
                    <div class="form-group-modern" style="margin-bottom: 1rem;">
                        <label style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem; display: block;">Full Name</label>
                        <input type="text" id="profileFullName" class="input-modern profile-input" data-original="${profile.fullName || ''}" value="${profile.fullName || ''}" placeholder="Enter full name" />
                    </div>

                    <div class="form-group-modern" style="margin-bottom: 1rem;">
                        <label style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem; display: block;">Email</label>
                        <input type="email" id="profileEmail" class="input-modern profile-input" data-original="${profile.email || ''}" value="${profile.email || ''}" placeholder="Enter email" />
                    </div>

                    <div class="form-group-modern" style="margin-bottom: 1rem;">
                        <label style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem; display: block;">Phone Number</label>
                        <input type="tel" id="profilePhone" class="input-modern profile-input" data-original="${profile.phoneNumber || ''}" value="${profile.phoneNumber || ''}" placeholder="Enter phone number" />
                    </div>

                    ${profile.role === 'Driver' ? `
                        <div class="form-group-modern" style="margin-bottom: 1rem;">
                            <label style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem; display: block;">License Number</label>
                            <input type="text" id="profileLicense" class="input-modern profile-input" data-original="${profile.licenseNumber || ''}" value="${profile.licenseNumber || ''}" placeholder="Enter license number" />
                        </div>
                    ` : ''}

                    ${profile.commissionBalance !== undefined ? `
                        <div class="form-group-modern" style="margin-bottom: 1rem;">
                            <label style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem; display: block;">Commission Balance</label>
                            <input type="number" id="profileCommission" class="input-modern" value="${profile.commissionBalance || 0}" placeholder="0" disabled style="background: var(--surface-hover); cursor: not-allowed;" />
                            <small style="color: var(--text-secondary); display: block; margin-top: 0.25rem;">This field is managed by the system</small>
                        </div>
                    ` : ''}
                </div>

                <!-- Security Section -->
                <div style="margin-bottom: 2rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
                    <h4 style="margin: 0 0 1rem; color: var(--text-primary); font-weight: 600;">Security</h4>
                    
                    <div class="form-group-modern" style="margin-bottom: 1rem;">
                        <label style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem; display: block;">Current Password</label>
                        <input type="password" id="profileCurrentPassword" class="input-modern profile-password-input" placeholder="Enter current password" />
                    </div>

                    <div class="form-group-modern" style="margin-bottom: 1rem;">
                        <label style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem; display: block;">New Password</label>
                        <input type="password" id="profileNewPassword" class="input-modern profile-password-input" placeholder="Leave blank if no change" />
                    </div>

                    <div class="form-group-modern" style="margin-bottom: 1rem;">
                        <label style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.5rem; display: block;">Confirm New Password</label>
                        <input type="password" id="profileConfirmPassword" class="input-modern profile-password-input" placeholder="Confirm new password" />
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 1rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                    <button id="profileSaveBtn" class="btn-modern" style="flex: 1; padding: 1rem 1.5rem; font-size: 1rem; font-weight: 600; border: none; border-radius: var(--radius-md); cursor: not-allowed; background: var(--surface-hover); color: var(--text-secondary); transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem;" disabled>
                        💾 Save Changes
                    </button>
                    <button id="profileCancelBtn" class="btn-modern" style="flex: 1; padding: 1rem 1.5rem; font-size: 1rem; font-weight: 600; border: 2px solid var(--border-color); border-radius: var(--radius-md); background: transparent; color: var(--text-primary); cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
                        ✕ Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
}

function attachProfileModalEvents(modal, originalProfile) {
    // Close button
    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('#profileCancelBtn');
    const saveBtn = modal.querySelector('#profileSaveBtn');

    const closeModal = () => {
        modal.style.display = 'none';
        setTimeout(() => modal.remove(), 300);
    };

    // Helper function to check if any changes were made
    const checkForChanges = () => {
        const fullName = modal.querySelector('#profileFullName').value;
        const email = modal.querySelector('#profileEmail').value;
        const phoneNumber = modal.querySelector('#profilePhone').value;
        const currentPassword = modal.querySelector('#profileCurrentPassword').value;
        const newPassword = modal.querySelector('#profileNewPassword').value;

        // Check text field changes
        const hasTextChanges = 
            fullName !== originalProfile.fullName || 
            email !== originalProfile.email || 
            phoneNumber !== (originalProfile.phoneNumber || '');

        // Check driver license if applicable
        const hasLicenseChanges = originalProfile.role === 'Driver' && 
            modal.querySelector('#profileLicense') && 
            modal.querySelector('#profileLicense').value !== (originalProfile.licenseNumber || '');

        // Check password change request
        const hasPasswordChanges = currentPassword && newPassword;

        return hasTextChanges || hasLicenseChanges || hasPasswordChanges;
    };

    // Update button state
    const updateSaveButtonState = () => {
        if (checkForChanges()) {
            saveBtn.disabled = false;
            saveBtn.style.background = 'var(--primary-color)';
            saveBtn.style.color = 'white';
            saveBtn.style.cursor = 'pointer';
            saveBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        } else {
            saveBtn.disabled = true;
            saveBtn.style.background = 'var(--surface-hover)';
            saveBtn.style.color = 'var(--text-secondary)';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.style.boxShadow = 'none';
        }
    };

    // Add event listeners to all profile inputs
    const profileInputs = modal.querySelectorAll('.profile-input');
    profileInputs.forEach(input => {
        input.addEventListener('input', updateSaveButtonState);
        input.addEventListener('change', updateSaveButtonState);
    });

    // Add event listeners to password inputs
    const passwordInputs = modal.querySelectorAll('.profile-password-input');
    passwordInputs.forEach(input => {
        input.addEventListener('input', updateSaveButtonState);
        input.addEventListener('change', updateSaveButtonState);
    });

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Hover effects for cancel button
    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'var(--surface-hover)';
        cancelBtn.style.borderColor = 'var(--primary-color)';
        cancelBtn.style.color = 'var(--primary-color)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'transparent';
        cancelBtn.style.borderColor = 'var(--border-color)';
        cancelBtn.style.color = 'var(--text-primary)';
    });

    // Hover effects for save button
    const updateSaveButtonHover = () => {
        if (!saveBtn.disabled) {
            saveBtn.style.background = 'var(--primary-color-hover, #1d5fa1)';
            saveBtn.style.transform = 'translateY(-2px)';
            saveBtn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        }
    };
    const updateSaveButtonLeave = () => {
        if (!saveBtn.disabled) {
            saveBtn.style.background = 'var(--primary-color)';
            saveBtn.style.transform = 'translateY(0)';
            saveBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }
    };

    saveBtn.addEventListener('mouseenter', updateSaveButtonHover);
    saveBtn.addEventListener('mouseleave', updateSaveButtonLeave);

    // Click outside modal to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Save button handler
    saveBtn.addEventListener('click', async () => {
        if (!saveBtn.disabled) {
            await saveProfileChanges(modal, originalProfile);
        }
    });

    // Password validation
    const newPassInput = modal.querySelector('#profileNewPassword');
    const confirmPassInput = modal.querySelector('#profileConfirmPassword');

    confirmPassInput.addEventListener('change', () => {
        if (newPassInput.value && newPassInput.value !== confirmPassInput.value) {
            confirmPassInput.style.borderColor = 'var(--danger)';
        } else {
            confirmPassInput.style.borderColor = '';
        }
        updateSaveButtonState();
    });

    // Initial button state
    updateSaveButtonState();
}

async function saveProfileChanges(modal, originalProfile) {
    const saveBtn = modal.querySelector('#profileSaveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Saving...';

    try {
        const fullName = modal.querySelector('#profileFullName').value;
        const email = modal.querySelector('#profileEmail').value;
        const phoneNumber = modal.querySelector('#profilePhone').value;
        const currentPassword = modal.querySelector('#profileCurrentPassword').value;
        const newPassword = modal.querySelector('#profileNewPassword').value;
        const confirmPassword = modal.querySelector('#profileConfirmPassword').value;

        // Validation
        if (!fullName.trim()) {
            showToast('Full name is required', '#ef4444');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '💾 Save Changes';
            return;
        }

        if (!email.trim()) {
            showToast('Email is required', '#ef4444');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '💾 Save Changes';
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            showToast('Passwords do not match', '#ef4444');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '💾 Save Changes';
            return;
        }

        // Build update object
        const updateData = {
            fullName,
            email,
            phoneNumber: phoneNumber || originalProfile.phoneNumber
        };

        // Add driver-specific fields if applicable
        if (originalProfile.role === 'Driver') {
            const license = modal.querySelector('#profileLicense')?.value;
            if (license) updateData.licenseNumber = license;
        }

        // Handle password change if provided
        if (newPassword && currentPassword) {
            updateData.currentPassword = currentPassword;
            updateData.newPassword = newPassword;
        }

        // Send update to API
        const res = await api.updateProfile(updateData);
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to update profile');
        }

        showToast('✓ Profile updated successfully!', '#10b981');
        
        // Close modal and refresh
        setTimeout(() => {
            modal.style.display = 'none';
            setTimeout(() => {
                modal.remove();
                location.reload();
            }, 300);
        }, 1000);
    } catch (error) {
        console.error('Save profile error:', error);
        showToast(error.message || 'Failed to save profile', '#ef4444');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Save Changes';
    }
}
