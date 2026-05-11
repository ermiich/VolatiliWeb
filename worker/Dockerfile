FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev git curl \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/volatilityfoundation/volatility3.git /opt/volatility3 \
    && pip install --no-cache-dir -e /opt/volatility3

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
