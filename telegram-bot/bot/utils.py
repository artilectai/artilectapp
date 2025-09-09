import os
from datetime import datetime, timedelta
from dateutil import parser as dateparser
import pytz
import re

TZ = os.getenv("TZ", "Europe/Warsaw")
tz = pytz.timezone(TZ)

def now_tz():
    return datetime.now(tz)

def parse_money(text: str):
    # returns amount as float or None
    m = re.search(r'(?<!\d)(\d{1,3}(?:[\s,._]\d{3})+|\d+)(?:\s?([kк]))?', text, re.IGNORECASE)
    if not m:
        return None
    raw = m.group(1)
    raw = raw.replace(" ", "").replace(",", "").replace(".", "").replace("_","")
    amount = float(raw)
    if m.group(2):
        amount *= 1000.0
    return amount

def parse_time_tomorrow(text: str):
    # very small heuristic: "tomorrow ... at HH(:MM)?(am|pm)?"
    t = None
    m = re.search(r'(?:tomorrow|завтра|эртага)[^\d]{0,20}(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text, re.IGNORECASE)
    if m:
        hh = int(m.group(1))
        mm = int(m.group(2) or 0)
        ampm = (m.group(3) or '').lower()
        if ampm == 'pm' and hh < 12: hh += 12
        if ampm == 'am' and hh == 12: hh = 0
        tomorrow = now_tz().date() + timedelta(days=1)
        t = tz.localize(datetime(tomorrow.year, tomorrow.month, tomorrow.day, hh, mm))
    return t

def normalize_category_hint(text: str):
    # extract last word after 'on'/'for' etc. fallback None
    m = re.search(r'(?:on|for|на|для)\s+([\w\- ]{3,30})$', text.strip(), re.IGNORECASE)
    if m:
        return m.group(1).strip().title()
    # try simple nouns like 'food', 'transport', 'salary'
    m2 = re.search(r'\b(food|grocer|transport|bus|taxi|dining|meal|salary|bonus)\w*', text, re.IGNORECASE)
    return m2.group(1).title() if m2 else None
