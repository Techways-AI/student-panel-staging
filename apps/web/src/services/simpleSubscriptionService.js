// Simplified Subscription Service for Direct Payments Only
// Removes all complex subscription API logic and uses only direct payments

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app';

class SimpleSubscriptionService {
  constructor() {
    this.razorpay = null;
    this.scriptLoaded = false;
    this.scriptLoading = false;
    this.loadPromise = null;
    this.initRazorpay();
  }

  // Initialize Razorpay
  initRazorpay() {
    if (typeof window === 'undefined') return;

    if (this.scriptLoaded) {
      this.razorpay = window.Razorpay;
      return Promise.resolve();
    }

    if (this.scriptLoading && this.loadPromise) {
      return this.loadPromise;
    }

    if (window.Razorpay) {
      this.razorpay = window.Razorpay;
      this.scriptLoaded = true;
      return Promise.resolve();
    }

    this.scriptLoading = true;
    this.loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        this.razorpay = window.Razorpay;
        this.scriptLoaded = true;
        this.scriptLoading = false;
        resolve();
      };
      script.onerror = () => {
        this.scriptLoading = false;
        reject(new Error('Failed to load Razorpay script'));
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  // Ensure Razorpay is loaded
  async ensureRazorpayLoaded() {
    if (!this.scriptLoaded) {
      await this.initRazorpay();
    }
    if (!this.razorpay) {
      throw new Error('Razorpay failed to load');
    }
  }

  // Process direct payment for semester/yearly plans with live offers
  async processDirectPayment(planData, userData) {
    await this.ensureRazorpayLoaded();

    const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      throw new Error('Razorpay key not configured. Please set NEXT_PUBLIC_RAZORPAY_KEY_ID in your environment variables.');
    }

    try {
      // Step 1: Create order on backend first
      if (process.env.NODE_ENV !== 'production') console.log('Creating Razorpay order on backend...');
      const orderResponse = await this.createOrder(planData, userData);
      if (process.env.NODE_ENV !== 'production') console.log('Order created successfully:', orderResponse);

      return new Promise((resolve, reject) => {
        if (process.env.NODE_ENV !== 'production') console.log('🔍 DEBUG - Razorpay order response:', orderResponse);
        
        const options = {
          key: razorpayKey,
          amount: orderResponse.amount * 100, // Convert to paise
          currency: orderResponse.currency,
          order_id: orderResponse.order_id, // Use backend-generated order ID
          prefill: {
            name: userData.name || userData.mobile,
            email: userData.email || '',
            contact: userData.mobile,
          },
          // Live offers configuration - Razorpay will automatically apply the best offer
          offers: (() => {
            const offer1 = process.env.NEXT_PUBLIC_RAZORPAY_OFFER_ID_1;
            const offer2 = process.env.NEXT_PUBLIC_RAZORPAY_OFFER_ID_2;
            if (process.env.NODE_ENV !== 'production') console.log('🔍 Debug - Offer 1:', offer1);
            if (process.env.NODE_ENV !== 'production') console.log('🔍 Debug - Offer 2:', offer2);
            const offers = [offer1, offer2].filter(Boolean);
            if (process.env.NODE_ENV !== 'production') console.log('🔍 Debug - Final offers array:', offers);
            return offers;
          })(),
          notes: {
            plan_id: planData.id,
            plan_name: planData.name,
            plan_type: planData.planType,
            duration_months: planData.duration,
            user_id: userData.id,
            payment_type: 'direct',
            receipt: orderResponse.receipt,
            subject_code: planData.subject_code,
            subjects: JSON.stringify(planData.subjects || [])
          },
          // Enhanced mobile and QR code support
          config: {
            display: {
              blocks: {
                banks: {
                  name: "Pay using",
                  instruments: [
                    {
                      method: "card",
                      issuers: ["VISA", "MASTERCARD", "RUPAY"]
                    },
                    {
                      method: "upi",
                      flows: ["collect", "intent"]
                    },
                    {
                      method: "wallet",
                      wallets: ["PAYTM", "PHONEPE", "GOOGLEPAY"]
                    }
                  ]
                }
              },
              sequence: ["block.banks"],
              preferences: {
                show_default_blocks: true
              }
            }
          },
          // Better error handling - disable retry for debugging
          retry: {
            enabled: false,
            max_count: 1
          },
          handler: async (response) => {
            try {
              if (process.env.NODE_ENV !== 'production') console.log('Razorpay payment response:', response);
              
              // Verify payment with backend
              const verificationResponse = await this.verifyPayment(response, planData, userData);
              resolve(verificationResponse);
            } catch (error) {
              console.error('Error processing payment:', error);
              reject(error);
            }
          },
          modal: {
            ondismiss: () => {
              reject(new Error('Payment cancelled by user'));
            }
          }
        };

        const rzp = new this.razorpay(options);
        rzp.open();
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error creating order:', error);
      throw error;
    }
  }

  // Create order on backend
  async createOrder(planData, userData) {
    try {
      const token = localStorage.getItem('token');
      
      const orderData = {
        amount: planData.amount,
        currency: 'INR',
        plan_id: planData.id,
        plan_name: planData.name,
        plan_type: planData.planType,
        duration_months: planData.duration,
        subject_code: planData.subject_code,
        subjects: planData.subjects
      };
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 DEBUG - Creating Razorpay order on backend...');
        console.log('🔍 DEBUG - Order data being sent:', orderData);
        console.log('🔍 DEBUG - Amount in order data:', orderData.amount);
        console.log('🔍 DEBUG - Subjects in order data:', orderData.subjects);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create order');
      }

      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error creating order:', error);
      throw error;
    }
  }

  // Get available offers for a plan
  async getAvailableOffers(planData) {
    try {
      const params = new URLSearchParams();
      if (planData?.id) params.append('plan_id', planData.id);
      if (planData?.name) params.append('plan_name', planData.name);
      if (planData?.planType) params.append('plan_type', planData.planType);

      const response = await fetch(`${API_BASE_URL}/api/payments/available-offers?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch available offers');
      }

      const data = await response.json();
      return { ok: true, offers: data.offers || [] };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error fetching offers:', error);
      return { ok: false, offers: [] };
    }
  }

  // Apply coupon on backend and get discounted amount
  async applyCoupon(planData, couponCode) {
    try {
      const token = localStorage.getItem('token');

      const payload = {
        code: couponCode,
        original_amount: planData.amount,
        plan_id: planData.id,
        plan_name: planData.name,
        plan_type: planData.planType,
      };

      const response = await fetch(`${API_BASE_URL}/api/payments/apply-coupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        // Ignore JSON parse errors and fall back to generic message
      }

      if (!response.ok) {
        const message = (data && (data.detail || data.message)) || 'Failed to apply coupon';
        return { ok: false, error: message, data: null };
      }

      return { ok: true, error: null, data };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error applying coupon:', error);
      const message = error && error.message ? error.message : 'Failed to apply coupon';
      return { ok: false, error: message, data: null };
    }
  }

  // Verify payment with backend
  async verifyPayment(paymentResponse, planData, userData) {
    try {
      const token = localStorage.getItem('token');
      
      const verificationData = {
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        plan_data: planData,
        user_data: userData
      };
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Sending payment verification data:', verificationData);
        console.log('Payment response from Razorpay:', paymentResponse);
        console.log('Plan data:', planData);
        console.log('User data:', userData);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(verificationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to verify payment');
      }

      return await response.json();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Error verifying payment:', error);
      throw error;
    }
  }

  // Get subscription status (simplified)
  async getSubscriptionStatus() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/payments/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch subscription status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      throw error;
    }
  }

  // Check if user has active subscription
  async hasActiveSubscription() {
    try {
      const subscription = await this.getSubscriptionStatus();
      return subscription && subscription.is_active && !subscription.is_expired;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }
}

export default new SimpleSubscriptionService();

