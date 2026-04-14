// payment-confirmation-modal.js - Payment confirmation component
import api from "../api.js";
import { showToast, icons } from "./shared.js";

export async function showPaymentConfirmationModal(booking, sidebar, content, onComplete) {
    const modalHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 4000; padding: 1rem;">
            <div style="background: white; border-radius: 16px; max-width: 550px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3); animation: slideUp 0.4s ease-out; overflow: hidden;">
                
                <!-- Step 1: Payment Confirmation (shown first) -->
                <div id="paymentConfirmStep" style="display: flex; flex-direction: column; height: 100%; overflow-y: auto;">
                    <!-- Payment Header -->
                    <div style="padding: 2.5rem 2rem 1.5rem; flex-shrink: 0; border-bottom: 1px solid var(--border-color);">
                        <div style="text-align: center;">
                            <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);">
                                <svg style="width: 40px; height: 40px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <h2 style="margin: 0 0 0.5rem; color: var(--text-primary); font-size: 1.75rem; font-weight: 700;">Booking Confirmed! 🎉</h2>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.95rem;">Your ride is scheduled. You can clear payment once the trip is completed.</p>
                        </div>
                    </div>

                    <!-- Payment Details -->
                    <div style="flex: 1; overflow-y: auto; padding: 0 2rem; scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.2) transparent;">
                        <div style="padding: 1.5rem 0;">
                            <!-- Booking Summary -->
                            <div style="background: #f0fdf4; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border-left: 4px solid #10b981;">
                                <div style="margin-bottom: 1rem;">
                                    <p style="margin: 0 0 0.25rem; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Trip Details</p>
                                    <p style="margin: 0; color: var(--text-primary); font-weight: 600;">📍 ${booking.pickupLocation || 'TBD'} → ${booking.destination || 'TBD'}</p>
                                </div>
                                <div>
                                    <p style="margin: 0 0 0.25rem; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Date & Time</p>
                                    <p style="margin: 0; color: var(--text-primary); font-weight: 600;">🕐 ${new Date(booking.startDate || new Date()).toLocaleString()}</p>
                                </div>
                            </div>

                            <!-- Payment Info -->
                            <div style="background: white; border: 2px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                                    <span style="color: var(--text-secondary);">Amount Paid</span>
                                    <span style="font-size: 1.5rem; font-weight: 700; color: #10b981;">KSH ${booking.price || 0}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                    <span style="color: var(--text-secondary); font-size: 0.875rem;">Payment Status</span>
                                    <span style="background: #d1fae5; color: #065f46; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.75rem;">✓ PAID</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: var(--text-secondary); font-size: 0.875rem;">Confirmation ID</span>
                                    <span style="color: var(--text-primary); font-family: monospace; font-weight: 500; font-size: 0.875rem;">#${booking.id?.substring(0, 8) || 'PENDING'}</span>
                                </div>
                            </div>

                            <!-- Passengers -->
                            <div style="background: #f8fafc; border-radius: 12px; padding: 1rem; margin-bottom: 0;">
                                <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;">👥 <strong>${booking.numberOfGuests || 1}</strong> passenger(s)</p>
                            </div>
                        </div>
                    </div>
                </div>


                <!-- Footer -->
                <div id="paymentFooter" style="padding: 1.5rem 2rem; flex-shrink: 0; border-top: 1px solid var(--border-color);">
                    <button id="closeModalBtn" class="btn-modern" style="width: 100%; padding: 0.875rem; font-size: 1rem; font-weight: 600; border: none; border-radius: 8px; background: var(--primary-color); color: white; cursor: pointer; transition: all 0.3s;">
                        Done
                    </button>
                </div>
            </div>
        </div>

        <style>
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        </style>
    `;

    // Create and display modal
    const container = document.createElement('div');
    container.innerHTML = modalHTML;
    document.body.appendChild(container);

    const closeModalBtn = container.getElementById('closeModalBtn');
    const paymentStep = container.getElementById('paymentConfirmStep');

    const closeModal = () => {
        container.remove();
        if (onComplete) onComplete();
    };

    // Event listeners
    closeModalBtn.addEventListener('click', closeModal);
}
