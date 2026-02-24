import jwt
import time

secret = "sb_secret_30g7oQNYbt619RXNEZNgbw_9RRhG3Qx"
payload = {
    "role": "anon",
    "iss": "supabase",
    "iat": int(time.time()),
    "exp": int(time.time()) + 315360000000 # Expires in 10,000 years
}

token = jwt.encode(payload, secret, algorithm="HS256")
print(token)
