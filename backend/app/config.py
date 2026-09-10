import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str | None = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY: str | None = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_JWT_SECRET: str | None = os.getenv("SUPABASE_JWT_SECRET")
ADMIN_EMAIL: str | None = os.getenv("ADMIN_EMAIL")
TURNSTILE_SECRET_KEY: str | None = os.getenv("TURNSTILE_SECRET_KEY")

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "admin-dev")
PLAN_MODE: str = os.getenv("PLAN_MODE", "manual")
UPI_ID: str = os.getenv("UPI_ID", "")
UPI_PAYEE_NAME: str = os.getenv("UPI_PAYEE_NAME", "")
UPI_PAYMENT_AMOUNT: int = int(os.getenv("UPI_PAYMENT_AMOUNT", "499"))
UPI_CURRENCY: str = os.getenv("UPI_CURRENCY", "INR")
SUBSCRIPTION_MONTHS: int = int(os.getenv("SUBSCRIPTION_MONTHS", "12"))
ENABLE_ENTITLEMENTS: str = os.getenv("ENABLE_ENTITLEMENTS", "true")
FREE_DAILY_LLM: int = int(os.getenv("FREE_DAILY_LLM", "25"))