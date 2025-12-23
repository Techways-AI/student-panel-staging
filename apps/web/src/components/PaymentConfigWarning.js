import React from 'react';

const PaymentConfigWarning = () => {
  const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  
  if (razorpayKey && !razorpayKey.includes('YOUR_KEY_HERE')) {
    return null; // Config is properly set
  }

  return (
    <div style={{
      backgroundColor: '#fff3cd',
      border: '1px solid #ffeaa7',
      color: '#856404',
      padding: '12px',
      borderRadius: '8px',
      margin: '16px 0',
      fontSize: '14px'
    }}>
      <strong>⚠️ Payment Configuration Required</strong>
      <br />
      Razorpay payment integration is not properly configured. 
      Please check the RAZORPAY_SETUP_GUIDE.md for setup instructions.
    </div>
  );
};

export default PaymentConfigWarning;

