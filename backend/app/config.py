import os
import urllib.parse
from dotenv import load_dotenv

# Load env variables from .env if present
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set! Please configure it in your .env file.")

# Automatically URL-encode password if using postgres to handle special characters
if DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgresql+psycopg2://"):
    try:
        scheme, rest = DATABASE_URL.split("://", 1)
        if "@" in rest:
            creds, host_part = rest.rsplit("@", 1)
            if ":" in creds:
                user, passwd = creds.split(":", 1)
                quoted_passwd = urllib.parse.quote_plus(passwd)
                DATABASE_URL = f"{scheme}://{user}:{quoted_passwd}@{host_part}"
    except Exception:
        # Fallback to original if parsing fails
        pass

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")

# Allowed origins for CORS (e.g. your frontend location)
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", 
    "http://localhost:3000,http://localhost:5173,http://localhost:5174"
).split(",")

