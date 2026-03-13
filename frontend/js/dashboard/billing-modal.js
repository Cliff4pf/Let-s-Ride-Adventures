// billing-modal.js - Payment prompt for tourists when trip is completed
import api from "../api.js";
import { showToast } from "./shared.js";

export async function showBillingModal(trip, onPaymentComplete) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';

    const amount = trip.price || 0;
    const modalHtml = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header" style="border-bottom: 2px solid var(--border-color); background: linear-gradient(135deg, #10b981, #059669); color: white;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                    💳 Trip Payment
                </h3>
                <button class="billing-modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: white; opacity: 0.8;">×</button>
            </div>

            <div class="modal-body" style="padding: 2rem;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;">Trip Completed Successfully!</p>
                    <h2 style="margin: 1rem 0 0; color: var(--text-primary); font-size: 2.5rem; font-weight: 700;">KSH ${amount.toLocaleString()}</h2>
                </div>

                <div style="background: var(--surface-hover); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 1rem; font-weight: 600; font-size: 0.875rem; text-transform: uppercase;">Trip Summary</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                        <span style="color: var(--text-secondary);">From:</span>
                        <span style="font-weight: 600;">${trip.pickupLocation || 'N/A'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                        <span style="color: var(--text-secondary);">To:</span>
                        <span style="font-weight: 600;">${trip.destination || 'N/A'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Date:</span>
                        <span style="font-weight: 600;">${new Date(trip.startDate).toLocaleDateString()}</span>
                    </div>
                </div>

                <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem;">
                    <p style="margin: 0; color: #1e40af; font-size: 0.875rem;">
                        <strong>Note:</strong> This payment is processed through our secure payment gateway. Your account will be updated immediately upon successful payment.
                    </p>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-secondary billing-modal-close" style="flex: 1;">Cancel</button>
                    <button id="confirmPaymentBtn" class="btn btn-primary" style="flex: 1; background: #10b981; border-color: #10b981;">Pay Now</button>
                </div>
            </div>
        </div>
    `;

    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);

    // Attach events
    const closeBtn = modal.querySelector('.billing-modal-close');
    const payBtn = modal.querySelector('#confirmPaymentBtn');

    const closeModal = () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (payBtn) {
        payBtn.addEventListener('click', async () => {
            payBtn.disabled = true;
            payBtn.innerHTML = '⏳ Processing...';

            try {
                // Update payment status
                const updateRes = await api.updatePaymentStatus(trip.id, 'PAID');
                
                if (!updateRes.ok) {
                    throw new Error('Payment update failed');
                }

                showToast('Payment confirmed!', '#10b981');
                closeModal();

                // Call the callback (don't let UI refresh errors affect payment success)
                if (onPaymentComplete) {
                    try {
                        await onPaymentComplete(trip);
                    } catch (callbackError) {
                        console.error('UI refresh error after payment:', callbackError);
                        // Payment still succeeded, just UI refresh failed
                    }
                }
            } catch (error) {
                console.error('Payment error:', error);
                showToast('Payment failed. Please try again.', '#ef4444');
                payBtn.disabled = false;
                payBtn.innerHTML = 'Pay Now';
            }
        });
    }

    // Fade in
    setTimeout(() => {
        modal.style.opacity = '1';
    }, 10);

    return modal;
}
