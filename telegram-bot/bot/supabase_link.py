import os, time, hmac, hashlib, urllib.parse
from dotenv import load_dotenv
from supabase import create_client, Client

# Ensure .env is loaded for local runs
load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
# Prefer ANON key if you don't want to use the service role. Note: RLS must permit the operations the bot performs.
SUPABASE_KEY = (
    os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
)
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.")

def sb() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Linking helpers ---
def get_user_by_telegram(telegram_user_id: int):
    try:
        s = sb()
        res = s.table("telegram_links").select("user_id").eq("telegram_user_id", telegram_user_id).limit(1).execute()
        if getattr(res, "error", None):
            # RLS or table missing: treat as not linked
            return None
        if res.data:
            return res.data[0]["user_id"]
    except Exception:
        # Misconfig or network: treat as not linked so /start still replies
        return None
    return None

def ensure_default_account(user_id: str) -> str:
    s = sb()
    res = s.table("finance_accounts").select("id").eq("user_id", user_id).eq("is_default", True).limit(1).execute()
    if getattr(res, "error", None):
        raise RuntimeError(f"RLS blocked reading finance_accounts: {res.error}")
    if res.data:
        return res.data[0]["id"]
    ins = s.table("finance_accounts").insert({
        "user_id": user_id,
        "name": "Cash",
        "type": "cash",
        "is_default": True
    }).execute()
    if getattr(ins, "error", None):
        raise RuntimeError(f"RLS blocked creating default account: {ins.error}")
    return ins.data[0]["id"]

def create_link_code(code: str, telegram_user_id: int):
    s = sb()
    res = s.table("telegram_link_codes").upsert({
        "code": code,
        "telegram_user_id": telegram_user_id,
    }).execute()
    if getattr(res, "error", None):
        # Not fatal for /link UX, just ignore
        return False
    return True

def consume_link_code(code: str, user_id: str) -> bool:
    s = sb()
    res = s.table("telegram_link_codes").select("*").eq("code", code).limit(1).execute()
    if getattr(res, "error", None) or not res.data:
        return False
    up = s.table("telegram_links").upsert({
        "user_id": user_id,
        "telegram_user_id": res.data[0]["telegram_user_id"]
    }).execute()
    if getattr(up, "error", None):
        return False
    s.table("telegram_link_codes").update({"consumed_by": user_id}).eq("code", code).execute()
    return True

# Validate WebApp initData (per Telegram docs)
def validate_init_data(init_data: str, bot_token: str) -> dict | None:
    # init_data is an URL-encoded query string
    params = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    if "hash" not in params:
        return None
    data_check_arr = []
    for k in sorted([k for k in params.keys() if k != "hash"]):
        data_check_arr.append(f"{k}={params[k]}")
    data_check_string = "\n".join(data_check_arr)

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calc_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if calc_hash != params["hash"]:
        return None
    # success
    return params
