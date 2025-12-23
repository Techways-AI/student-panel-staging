from dotenv import load_dotenv
from redis.exceptions import RedisError
import os
import sys
import redis

def main() -> int:
    load_dotenv()
    url = os.environ.get("REDIS_URL")
    print(f"Using Redis URL: {url}")
    if not url:
        print("Redis URL is not set")
        return 1

    client = redis.from_url(url)
    try:
        client.ping()
    except RedisError as exc:
        print(f"Redis not available: {exc}")
        return 1
    else:
        print("Connected to Redis successfully")
        return 0

if __name__ == "__main__":
    sys.exit(main())

