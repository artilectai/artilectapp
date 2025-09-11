# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# Install system deps for popular wheels if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY bot ./bot

ENV PORT=8080
EXPOSE 8080

# Run webhook server; expects env vars (BOT_TOKEN, WEBHOOK_URL, etc.) set by platform
CMD ["uvicorn", "bot.server:app", "--host", "0.0.0.0", "--port", "8080"]
