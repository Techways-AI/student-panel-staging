import React, { useState } from 'react';
import styles from './Settings.module.css';
import { useLayout } from '../context/LayoutContext';


const Settings = () => {
  const [activeSection, setActiveSection] = useState('security');
  


  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingSection}>
        <h1>Settings</h1>
        <p>Manage your login security, billing info, and account preferences.</p>
      </div>

      <div className={styles.settingsTabs}>
        <div
          className={`${styles.tabsItem} ${activeSection === 'security' ? styles.active : ''}`}
          onClick={() => setActiveSection('security')}
        >
          Security
        </div>
        <div
          className={`${styles.tabsItem} ${activeSection === 'billing' ? styles.active : ''}`}
          onClick={() => setActiveSection('billing')}
        >
          Billing Information
        </div>
        <div
          className={`${styles.tabsItem} ${activeSection === 'account' ? styles.active : ''}`}
          onClick={() => setActiveSection('account')}
        >
          Account Management
        </div>
      </div>

        <section className={styles.settingsInfo}>
          <h2 className={styles.title}>
            {activeSection === 'security' && 'Security'}
            {activeSection === 'billing' && 'Billing Information'}
            {activeSection === 'account' && 'Account Management'}
          </h2>

          <p className={styles.subtitle}>
            {activeSection === 'security' &&
              'Manage your secure OTP login and trusted devices.'}
            {activeSection === 'billing' &&
              'View and update your billing and payment information.'}
            {activeSection === 'account' &&
              'Update your profile details and account preferences.'}
          </p>

          {activeSection === 'security' && (
            <div className={styles.twofaSection}>
              <h3 className={styles.sectionHeading}>Security</h3>
              <div className={styles.twofaContent}>
                <div className={styles.twofaInfo}>
                  <div className={styles.twofaLabelRow}>
                    <span className={styles.twofaLabel}>Login Method</span>
                    <span className={`${styles.mfaStatus} ${styles.enabled}`}>SECURE</span>
                  </div>
                  <p className={styles.settingDescription}>
                    Your account is protected using one-time passcodes (OTP) sent to your iPhone. No password is required.
                  </p>
                </div>

                <button className={`${styles.mfaButton} ${styles.disabled}`} disabled>
                  OTP Login Enabled
                </button>
              </div>
            </div>
          )}

          {activeSection === 'billing' && (
            <>
              <div className={styles.billingRow}>
                <div className={styles.billingHeader}>
                  <h4>Current Plan</h4>
                  <a className={styles.billingAction} href="#">
                    Manage subscription
                  </a>
                </div>
                <p className={styles.billingStatus}>
                  Monthly - Trial <span className={styles.statusBadge}>Active</span>
                </p>
                <p className={styles.billingSubtext}>
                  You'll be charged for an annual subscription after your trial ends.
                </p>
              </div>

              <div className={styles.billingRow}>
                <div className={styles.billingHeader}>
                  <h4>Payment Method</h4>
                  <a className={styles.billingAction} href="#">
                    Update payment method
                  </a>
                </div>
                <p className={styles.billingDetail}>Mastercard ending in 0930</p>
              </div>

              <div className={styles.billingRow}>
                <div className={styles.billingHeader}>
                  <h4>Next Payment</h4>
                </div>
                <p className={styles.billingDetail}>$14.99 on March 5, 2025</p>
                <p className={styles.billingSubtext}>
                  Depending on your state, you may see sales tax included in your final charge.
                </p>
              </div>

              <div className={styles.billingRow}>
                <div className={styles.billingHeader}>
                  <h4>Billing History</h4>
                  <a className={styles.billingAction} href="#">
                    View all invoices
                  </a>
                </div>
                <p className={styles.billingDetail}>Last invoice: $14.99 on May 5, 2025</p>
                <p className={styles.billingSubtext}>
                  Need help? <a href="#">Contact support</a>
                </p>
              </div>
            </>
          )}

          {activeSection === 'account' && (
            <>
              <div className={`${styles.subscriptionSummary} ${styles.accountBox}`}>
                <h3 className={styles.sectionHeading}>Subscription Info</h3>
                <p>
                  Current Plan: <strong>Pro Monthly</strong>
                </p>
                <p>
                  Renews: <strong>July 10, 2025</strong>
                </p>
                <p className={styles.cancelText}>
                  Want to update your payment method or view invoices?{' '}
                  <span className={styles.link} onClick={() => setActiveSection('billing')}>
                    Go to Billing Settings
                  </span>
                </p>
              </div>

              <div className={`${styles.accountBox} ${styles.warningBox}`}>
                <h3 className={styles.sectionHeading}>Delete Account</h3>
                <p className={styles.settingDescription}>
                  If you choose to delete your account, all your data, settings, and content
                  will be permanently lost. This action cannot be undone.
                </p>
                <p className={styles.cancelText}>
                  Just wanted to cancel your subscription?{' '}
                  <span className={styles.link} onClick={() => setActiveSection('billing')}>
                    Manage subscription
                  </span>
                </p>
                <button className={styles.deleteButton}>Delete account</button>
              </div>
            </>
          )}
        </section>
      </div>
  );
};

export default Settings;

