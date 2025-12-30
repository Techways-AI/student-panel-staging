import os
from dotenv import load_dotenv
import re
from typing import List

load_dotenv()

class Settings:
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/durranis_pharma")
    
    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY")
    if not JWT_SECRET_KEY:
        if ENVIRONMENT == "development":
            JWT_SECRET_KEY = "your_jwt_secret_key_here_development_only"
            print("⚠️  WARNING: Using default JWT secret key for development only!")
        else:
            raise ValueError("JWT_SECRET_KEY environment variable is required in production")
    else:
        print("✅ Using JWT_SECRET_KEY from environment")
    
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    
    # Log JWT configuration for debugging (only in development)
    if ENVIRONMENT == "development":
        print(f"🔐 JWT Configuration:")
        print(f"   - Algorithm: {JWT_ALGORITHM}")
        print(f"   - Token Expiry: {ACCESS_TOKEN_EXPIRE_MINUTES} minutes ({ACCESS_TOKEN_EXPIRE_MINUTES/60:.1f} hours)")
        print(f"   - Secret Key Length: {len(JWT_SECRET_KEY)} characters")
        print(f"   - ✅ Using permanent JWT secret key")
    
    # CORS settings
    CORS_ORIGINS: List[str] = [
        "https://student-panel-staging-production-d927.up.railway.app",
        "https://sme-panel-staging-production-67df.up.railway.app",
        "https://student-panel-staging-production.up.railway.app",
        "https://sme-panel-staging-production.up.railway.app",
    ]

    CORS_ORIGINS_REGEX = "|".join([re.escape(origin) for origin in CORS_ORIGINS])

    CORS_ALLOWED_ORIGINS = [
        "https://student-panel-staging-production-d927.up.railway.app",
        "https://sme-panel-staging-production-67df.up.railway.app",
        "https://student-panel-staging-production.up.railway.app",
        "https://sme-panel-staging-production.up.railway.app",
    ]
    
    # Development CORS (only in development)
    if ENVIRONMENT == "development":
        # Add common localhost origins for development
        localhost_origins = [
            "https://student-panel-staging-production-d927.up.railway.app",
            "https://sme-panel-staging-production-67df.up.railway.app",
            "https://student-panel-staging-production.up.railway.app",
            "https://sme-panel-staging-production.up.railway.app",
        ]
        CORS_ORIGINS.extend(localhost_origins)
        CORS_ALLOWED_ORIGINS.extend(localhost_origins)
        
        # Also add any localhost origins from environment variables
        local_cors = os.getenv("LOCAL_CORS_ORIGINS", "")
        if local_cors:
            additional_origins = [origin.strip() for origin in local_cors.split(",") if origin.strip()]
            CORS_ORIGINS.extend(additional_origins)
            CORS_ALLOWED_ORIGINS.extend(additional_origins)
        
        # Log CORS configuration for development
        print(f"🔧 Development CORS Configuration:")
        print(f"   - Environment: {ENVIRONMENT}")
        print(f"   - Allowed Origins: {CORS_ORIGINS}")
    else:
        print(f"🔧 Production CORS Configuration:")
        print(f"   - Environment: {ENVIRONMENT}")
        print(f"   - Allowed Origins: {CORS_ORIGINS}")
    
    # Security settings
    SECURE_COOKIES: bool = os.getenv("SECURE_COOKIES", "true").lower() == "true"
    HTTPS_ONLY: bool = os.getenv("HTTPS_ONLY", "true").lower() == "true"
    



    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "100"))
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Analytics settings
    POSTHOG_API_KEY: str = os.getenv("POSTHOG_API_KEY", "")
    POSTHOG_HOST: str = os.getenv("POSTHOG_HOST", "https://app.posthog.com")
    POSTHOG_DEBUG: bool = os.getenv("POSTHOG_DEBUG", "false").lower() == "true"
    ENABLE_POSTHOG: bool = os.getenv("ENABLE_POSTHOG", "false").lower() == "true" and bool(POSTHOG_API_KEY)
    if ENVIRONMENT == "development":
        print("📊 PostHog Analytics Configuration:")
        print(f"   - Enabled: {ENABLE_POSTHOG}")
        print(f"   - Host: {POSTHOG_HOST}")
        print(f"   - Debug: {POSTHOG_DEBUG}")
        print(f"   - API Key Present: {'Yes' if POSTHOG_API_KEY else 'No'}")
    
    # Razorpay settings
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    
    # Log Razorpay configuration for debugging (only in development)
    if ENVIRONMENT == "development":
        print(f"💳 Razorpay Configuration:")
        print(f"   - Key ID: {RAZORPAY_KEY_ID[:20] if RAZORPAY_KEY_ID else 'NOT SET'}...{RAZORPAY_KEY_ID[-10:] if RAZORPAY_KEY_ID and len(RAZORPAY_KEY_ID) > 30 else ''}")
        print(f"   - Key Secret: {RAZORPAY_KEY_SECRET[:10] if RAZORPAY_KEY_SECRET else 'NOT SET'}...{RAZORPAY_KEY_SECRET[-10:] if RAZORPAY_KEY_SECRET and len(RAZORPAY_KEY_SECRET) > 20 else ''}")
        if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
            print(f"   - ⚠️  WARNING: Razorpay keys are not properly configured!")
            print(f"   - 💡 Check your .env file for RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET")
    
    # Payment settings
    PAYMENT_CURRENCY: str = os.getenv("PAYMENT_CURRENCY", "INR")
    PAYMENT_WEBHOOK_SECRET: str = os.getenv("PAYMENT_WEBHOOK_SECRET", "")
    
    # Device management settings
    MAX_MOBILE_DEVICES: int = int(os.getenv("MAX_MOBILE_DEVICES", "1"))
    MAX_DESKTOP_DEVICES: int = int(os.getenv("MAX_DESKTOP_DEVICES", "1"))
    
    # Device validation settings
    SKIP_DEVICE_VALIDATION_FOR_CACHED_USERS: bool = os.getenv("SKIP_DEVICE_VALIDATION_FOR_CACHED_USERS", "true").lower() == "true"
    S3_BATCH_SIZE: int = int(os.getenv("S3_BATCH_SIZE", "1000"))  # Max objects per batch
    S3_CONNECT_TIMEOUT: int = int(os.getenv("S3_CONNECT_TIMEOUT", "5"))  # 5 seconds
    S3_READ_TIMEOUT: int = int(os.getenv("S3_READ_TIMEOUT", "10"))  # 10 seconds
    
    # AI Backend Service settings
    AI_BACKEND_URL: str = os.getenv("AI_BACKEND_URL", "https://sme-panel-staging-production.up.railway.app/ai")
    AI_BACKEND_TIMEOUT: int = int(os.getenv("AI_BACKEND_TIMEOUT", "30"))
    AI_BACKEND_API_KEY: str = os.getenv("AI_BACKEND_API_KEY", "")

    # SME Panel Configuration
    SME_PANEL_API_KEY: str = os.getenv("SME_PANEL_API_KEY", "rjaLrgTqGA8LzJg9fMKqCvLtHrKLJoH1r8EHjRwVunqcA9KiiCy6jJfg2DoyCbNa8ZVUga-u5W7SCPPA486BQA")
    SME_PANEL_URL: str = os.getenv("SME_PANEL_URL", "https://sme-panel-staging-production.up.railway.app")
    SME_PANEL_TIMEOUT: int = int(os.getenv("SME_PANEL_TIMEOUT", "30"))
    
    # MSG91 settings for WhatsApp OTP
    MSG91_AUTH_KEY: str = os.getenv("MSG91_AUTH_KEY", "")
    MSG91_TEMPLATE_ID: str = os.getenv("MSG91_TEMPLATE_ID", "")
    MSG91_SENDER_ID: str = os.getenv("MSG91_SENDER_ID", "DURRANI")
    MSG91_BASE_URL: str = os.getenv("MSG91_BASE_URL", "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/")
    MSG91_NAMESPACE: str = os.getenv("MSG91_NAMESPACE", "")
    MSG91_INTEGRATED_NUMBER: str = os.getenv("MSG91_INTEGRATED_NUMBER", "")
    MSG91_OTP_LENGTH: int = int(os.getenv("MSG91_OTP_LENGTH", "4"))
    _otp_expiry_env = os.getenv("MSG91_OTP_EXPIRY_MINUTES")
    if _otp_expiry_env is None:
        _otp_expiry_env = os.getenv("MSG91_OTP_EXPIRE_MINUTES", "5")
    MSG91_OTP_EXPIRY_MINUTES: int = int(_otp_expiry_env)
    MSG91_OTP_EXPIRE_MINUTES: int = MSG91_OTP_EXPIRY_MINUTES
    MSG91_RESEND_INTERVAL_SECONDS: int = int(os.getenv("MSG91_RESEND_INTERVAL_SECONDS", "60"))
    
    # Log SME Panel configuration for debugging (only in development)
    if ENVIRONMENT == "development":
        print(f"🔑 SME Panel Configuration:")
        print(f"   - API Key: {SME_PANEL_API_KEY[:20] if SME_PANEL_API_KEY else 'NOT SET'}...{SME_PANEL_API_KEY[-20:] if SME_PANEL_API_KEY and len(SME_PANEL_API_KEY) > 40 else ''}")
        print(f"   - URL: {SME_PANEL_URL}")
        print(f"   - Timeout: {SME_PANEL_TIMEOUT}")
        if not SME_PANEL_API_KEY:
            print(f"   - ⚠️  WARNING: SME_PANEL_API_KEY is not set!")
            print(f"   - 💡 Set this environment variable to enable API key authentication")
    
    # Log MSG91 configuration for debugging (only in development)
    if ENVIRONMENT == "development":
        print(f"📱 MSG91 Configuration:")
        print(f"   - Auth Key: {MSG91_AUTH_KEY[:10] if MSG91_AUTH_KEY else 'NOT SET'}...{MSG91_AUTH_KEY[-10:] if MSG91_AUTH_KEY and len(MSG91_AUTH_KEY) > 20 else ''}")
        print(f"   - Template ID: {MSG91_TEMPLATE_ID if MSG91_TEMPLATE_ID else 'NOT SET'}")
        print(f"   - Sender ID: {MSG91_SENDER_ID}")
        print(f"   - Base URL: {MSG91_BASE_URL}")
        print(f"   - Namespace: {MSG91_NAMESPACE if MSG91_NAMESPACE else 'NOT SET'}")
        print(f"   - Integrated Number: {MSG91_INTEGRATED_NUMBER if MSG91_INTEGRATED_NUMBER else 'NOT SET'}")
        print(f"   - OTP Length: {MSG91_OTP_LENGTH}")
        print(f"   - OTP Expiry: {MSG91_OTP_EXPIRE_MINUTES} minutes")
        if not MSG91_AUTH_KEY:
            print(f"   - ⚠️  WARNING: MSG91_AUTH_KEY is not set!")
            print(f"   - 💡 Set this environment variable to enable WhatsApp OTP")

settings = Settings()

