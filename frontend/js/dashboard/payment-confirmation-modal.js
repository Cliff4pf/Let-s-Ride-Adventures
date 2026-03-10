// payment-confirmation-modal.js - Payment confirmation + Rating prompt component
import api from "../api.js";
import { showToast, icons } from "./shared.js";

export async function showPaymentAndRatingModal(booking, sidebar, content, onComplete) {
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
                            <h2 style="margin: 0 0 0.5rem; color: var(--text-primary); font-size: 1.75rem; font-weight: 700;">Payment Successful! 💳</h2>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.95rem;">Your booking has been confirmed</p>
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

                <!-- Step 2: Rating Request (shown after slight delay) -->
                <div id="ratingStep" style="display: none; flex-direction: column; height: 100%; overflow-y: auto;">
                    <!-- Rating Header -->
                    <div style="padding: 2rem 2rem 1.5rem; flex-shrink: 0; border-bottom: 1px solid var(--border-color);">
                        <div style="text-align: center;">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">⭐</div>
                            <h2 style="margin: 0 0 0.5rem; color: var(--text-primary); font-size: 1.5rem; font-weight: 700;">Rate Your Experience</h2>
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.95rem;">Help us improve by sharing your feedback</p>
                        </div>
                    </div>

                    <!-- Rating Content -->
                    <div style="flex: 1; overflow-y: auto; padding: 0 2rem;">
                        <div style="padding: 1.5rem 0;">
                            <!-- Star Rating -->
                            <div style="text-align: center; margin-bottom: 2rem;">
                                <div style="display: flex; justify-content: center; gap: 1rem; font-size: 3rem; margin-bottom: 1rem;">
                                    ${[1, 2, 3, 4, 5].map(star => `
                                        <button class="rating-star-btn" data-rating="${star}" style="background: none; border: none; cursor: pointer; color: #d1d5db; transition: all 0.2s; font-size: 2.5rem; padding: 0.5rem;">★</button>
                                    `).join('')}
                                </div>
                                <p id="ratingText" style="margin: 0; color: var(--text-secondary); font-size: 0.875rem; min-height: 20px; font-weight: 500;">Click to rate</p>
                            </div>

                            <!-- Feedback Text -->
                            <div style="margin-bottom: 1.5rem;">
                                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary); font-size: 0.875rem;">Optional: Share Your Feedback</label>
                                <textarea id="ratingFeedback" placeholder="Tell us about your experience..." style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; resize: vertical; min-height: 80px; font-family: inherit; font-size: 0.9rem;"></textarea>
                            </div>

                            <!-- Service Rating Breakdown -->
                            <div style="background: #f9fafb; border-radius: 8px; padding: 1rem; margin-bottom: 0;">
                                <p style="margin: 0 0 0.75rem; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">What was great?</p>
                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                    ${['🚗 Driver', '🛣️ Route', '⏱️ Time', '💰 Value'].map(item => `
                                        <button class="service-tag" data-tag="${item}" style="background: white; border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;">
                                            ${item}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div id="paymentFooter" style="padding: 1.5rem 2rem; flex-shrink: 0; border-top: 1px solid var(--border-color);">
                    <button id="proceedToRatingBtn" class="btn-modern" style="width: 100%; padding: 0.875rem; font-size: 1rem; font-weight: 600; border: none; border-radius: 8px; background: var(--primary-color); color: white; cursor: pointer; transition: all 0.3s;">
                        Rate Your Experience →
                    </button>
                    <button id="skipRatingBtn" style="width: 100%; padding: 0.875rem; margin-top: 0.75rem; font-size: 0.9rem; font-weight: 500; border: 1px solid var(--border-color); border-radius: 8px; background: transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.3s;">
                        Skip for Now
                    </button>
                </div>

                <div id="ratingFooter" style="display: none; padding: 1.5rem 2rem; flex-shrink: 0; border-top: 1px solid var(--border-color);">
                    <button id="submitRatingBtn" class="btn-modern" style="width: 100%; padding: 0.875rem; font-size: 1rem; font-weight: 600; border: none; border-radius: 8px; background: #d1d5db; color: #6b7280; cursor: not-allowed; transition: all 0.3s;" disabled>
                        Submit Rating
                    </button>
                    <button id="skipRatingBtn2" style="width: 100%; padding: 0.875rem; margin-top: 0.75rem; font-size: 0.9rem; font-weight: 500; border: 1px solid var(--border-color); border-radius: 8px; background: transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.3s;">
                        Skip
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
            .rating-star-btn:hover, .rating-star-btn.active {
                transform: scale(1.15);
            }
            .service-tag:hover, .service-tag.selected {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
        </style>
    `;

    // Create and display modal
    const container = document.createElement('div');
    container.innerHTML = modalHTML;
    document.body.appendChild(container);

    let selectedRating = 0;
    const ratingStars = container.querySelectorAll('.rating-star-btn');
    const ratingText = container.getElementById('ratingText');
    const ratingFeedback = container.getElementById('ratingFeedback');
    const submitRatingBtn = container.getElementById('submitRatingBtn');
    const proceedToRatingBtn = container.getElementById('proceedToRatingBtn');
    const skipRatingBtn = container.getElementById('skipRatingBtn');
    const skipRatingBtn2 = container.getElementById('skipRatingBtn2');
    const paymentFooter = container.getElementById('paymentFooter');
    const ratingFooter = container.getElementById('ratingFooter');
    const paymentStep = container.getElementById('paymentConfirmStep');
    const ratingStep = container.getElementById('ratingStep');

    // Rating star selection
    ratingStars.forEach(star => {
        star.addEventListener('click', (e) => {
            selectedRating = parseInt(e.target.getAttribute('data-rating'));
            ratingStars.forEach((s, idx) => {
                if (idx < selectedRating) {
                    s.style.color = '#fbbf24';
                    s.classList.add('active');
                } else {
                    s.style.color = '#d1d5db';
                    s.classList.remove('active');
                }
            });

            // Enable submit button
            submitRatingBtn.disabled = false;
            submitRatingBtn.style.background = 'var(--primary-color)';
            submitRatingBtn.style.color = 'white';
            submitRatingBtn.style.cursor = 'pointer';

            // Update rating text
            const labels = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];
            ratingText.textContent = labels[selectedRating - 1];
            ratingText.style.color = '#10b981';
        });

        star.addEventListener('mouseover', (e) => {
            const hoverRating = parseInt(e.target.getAttribute('data-rating'));
            ratingStars.forEach((s, idx) => {
                if (idx < hoverRating) {
                    s.style.color = '#fbbf24';
                } else {
                    s.style.color = '#d1d5db';
                }
            });
        });

        star.addEventListener('mouseout', () => {
            ratingStars.forEach((s, idx) => {
                if (idx < selectedRating) {
                    s.style.color = '#fbbf24';
                } else {
                    s.style.color = '#d1d5db';
                }
            });
        });
    });

    // Service tag selection
    container.querySelectorAll('.service-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            e.target.classList.toggle('selected');
        });
    });

    const closeModal = () => {
        container.remove();
    };

    const goToRatingStep = () => {
        paymentStep.style.display = 'none';
        ratingStep.style.display = 'flex';
        paymentFooter.style.display = 'none';
        ratingFooter.style.display = 'block';
    };

    const submitRating = async () => {
        if (selectedRating === 0) {
            showToast('Please select a rating', '#ef4444');
            return;
        }

        submitRatingBtn.disabled = true;
        submitRatingBtn.textContent = 'Submitting...';

        try {
            await api.createFeedback({
                bookingId: booking.id,
                targetUserId: booking.assignedDriverId,
                rating: selectedRating,
                comment: ratingFeedback.value,
                type: 'SERVICE'
            });

            showToast('Thank you! Your feedback helps us improve', '#10b981');
            closeModal();
            if (onComplete) onComplete();
        } catch (error) {
            console.error('Error submitting feedback:', error);
            showToast('Failed to submit feedback', '#ef4444');
            submitRatingBtn.disabled = false;
            submitRatingBtn.textContent = 'Submit Rating';
        }
    };

    // Event listeners
    proceedToRatingBtn.addEventListener('click', goToRatingStep);
    skipRatingBtn.addEventListener('click', () => {
        closeModal();
        if (onComplete) onComplete();
    });
    skipRatingBtn2.addEventListener('click', () => {
        closeModal();
        if (onComplete) onComplete();
    });
    submitRatingBtn.addEventListener('click', submitRating);

    // Auto-transition to rating after 2 seconds
    setTimeout(() => {
        goToRatingStep();
    }, 2500);
}
