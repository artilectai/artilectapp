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

def _apply_ampm(hh: int, ampm: str) -> int:
    ampm = (ampm or '').lower()
    if ampm == 'pm' and hh < 12:
        return hh + 12
    if ampm == 'am' and hh == 12:
        return 0
    return hh

def parse_time_tomorrow(text: str):
    """Legacy helper kept for compatibility: only matches explicit 'tomorrow ... at HH[:MM] am/pm?'."""
    t = None
    m = re.search(r'(?:tomorrow|завтра|эртага)[^\d]{0,20}(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text, re.IGNORECASE)
    if m:
        hh = _apply_ampm(int(m.group(1)), m.group(3) or '')
        mm = int(m.group(2) or 0)
        tomorrow = now_tz().date() + timedelta(days=1)
        t = tz.localize(datetime(tomorrow.year, tomorrow.month, tomorrow.day, hh, mm))
    return t

def parse_time_today_or_tomorrow(text: str):
    """Parse phrases like:
    - 'today at 9pm', 'today 21:00', 'сегодня в 9'
    - 'tomorrow at 9', 'завтра 21:00', 'эртага 9'
    - bare 'at 9pm' → today at 9pm
    Returns timezone-aware datetime or None.
    """
    # 1) today/tomorrow explicit
    m = re.search(r'\b(today|сегодня)\b[^\d]{0,20}(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text, re.IGNORECASE)
    if m:
        day = now_tz().date()
        hh = _apply_ampm(int(m.group(2)), m.group(4) or '')
        mm = int(m.group(3) or 0)
        return tz.localize(datetime(day.year, day.month, day.day, hh, mm))
    m = re.search(r'\b(tomorrow|завтра|эртага)\b[^\d]{0,20}(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text, re.IGNORECASE)
    if m:
        day = now_tz().date() + timedelta(days=1)
        hh = _apply_ampm(int(m.group(2)), m.group(4) or '')
        mm = int(m.group(3) or 0)
        return tz.localize(datetime(day.year, day.month, day.day, hh, mm))

    # 2) bare 'at 9pm/21:00' → default to today
    m = re.search(r'\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text, re.IGNORECASE)
    if m:
        day = now_tz().date()
        hh = _apply_ampm(int(m.group(1)), m.group(3) or '')
        mm = int(m.group(2) or 0)
        return tz.localize(datetime(day.year, day.month, day.day, hh, mm))

    return None

def normalize_category_hint(text: str):
    # extract last word after 'on'/'for' etc. fallback None
    m = re.search(r'(?:on|for|на|для)\s+([\w\- ]{3,30})$', text.strip(), re.IGNORECASE)
    if m:
        return m.group(1).strip().title()
    # try simple nouns like 'food', 'transport', 'salary'
    m2 = re.search(r'\b(food|grocer|transport|bus|taxi|dining|meal|salary|bonus)\w*', text, re.IGNORECASE)
    return m2.group(1).title() if m2 else None
