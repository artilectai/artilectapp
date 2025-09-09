import os, re
from .supabase_link import sb, ensure_default_account
from .utils import parse_money, normalize_category_hint

DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY","UZS")

def map_category_name(s: str) -> str:
    s = (s or "").strip().lower()
    mapping = {
        "food": "Groceries",
        "groceries": "Groceries",
        "transport": "Transport",
        "bus": "Transport",
        "taxi": "Transport",
        "dining": "Dining",
        "meal": "Dining",
        "salary": "Salary",
        "bonus": "Bonus",
    }
    return mapping.get(s, s.title() if s else None)

def find_or_create_category(user_id: str, cat_name: str, tx_type: str) -> str | None:
    if not cat_name:
        return None
    s = sb()
    q = s.table("finance_categories").select("id").eq("user_id", user_id).eq("name", cat_name).limit(1).execute()
    if q.data:
        return q.data[0]["id"]
    ins = s.table("finance_categories").insert({
        "user_id": user_id,
        "name": cat_name,
        "type": "income" if tx_type=="income" else "expense",
        "color": "#ef4444" if tx_type=="expense" else "#16a34a"
    }).execute()
    return ins.data[0]["id"]

def insert_transaction(user_id: str, text: str) -> dict:
    amount = parse_money(text)
    if amount is None:
        return {"ok": False, "reason": "amount_not_found"}

    lower = text.lower()
    tx_type = "expense"
    if re.search(r'\b(income|salary|bonus|earned|получил|доход)\b', lower):
        tx_type = "income"

    cat_hint = normalize_category_hint(text)
    cat_mapped = map_category_name(cat_hint)
    cat_id = find_or_create_category(user_id, cat_mapped, tx_type) if cat_mapped else None

    s = sb()
    account_id = ensure_default_account(user_id)

    ins = s.table("finance_transactions").insert({
        "user_id": user_id,
        "account_id": account_id,
        "category_id": cat_id,
        "type": tx_type,
        "amount": amount,
        "currency": DEFAULT_CURRENCY,
        "description": text,
    }).execute()
    return {"ok": True, "id": ins.data[0]["id"], "type": tx_type, "amount": amount, "category": cat_mapped}
