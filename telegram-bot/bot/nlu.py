import re

def classify_intent(text: str) -> str:
    t = text.lower().strip()
    if re.search(r'\b(spent|потратил|расход|оплатил)\b', t):
        return "add_expense"
    if re.search(r'\b(add income|income|salary|bonus|заработал|доход)\b', t):
        return "add_income"
    if re.search(r'\b(meeting|встреча|task|задача|todo)\b', t) or re.search(r'\btomorrow\b', t):
        return "add_task"
    return "unknown"
