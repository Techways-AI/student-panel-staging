import requests
import os
import jwt
import datetime

def test_api():
    # We need a valid token. Let's try to find one or generate one if we have the secret.
    # The config says: JWT_SECRET_KEY = "your_jwt_secret_key_here_development_only"
    # Wait, the logs say: ✅ Using JWT_SECRET_KEY from environment
    
    # Let's try to just hit the endpoint without auth first to see if it even responds (it should 401)
    url = "http://127.0.0.1:8000/api/student/topic-content?topic=Benzene&file_type=video"
    print(f"Testing {url}")
    try:
        # We'll try to generate a token for user 6 (shiva)
        secret = os.getenv("JWT_SECRET_KEY")
        if not secret:
            # Try the default one from config.py if env is not set
            secret = "your_jwt_secret_key_here_development_only"
            
        token = jwt.encode({
            "sub": "9392289626", # shiva's mobile
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        }, secret, algorithm="HS256")
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(url, headers=headers)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
