# Backend Server

Python HTTP server with CORS support for API proxy requests.

## Setup

No external dependencies required - uses Python standard library only.

## Running the Server

```bash
python server.py
```

The server will start on port 8080 by default.

## API Endpoints

- `GET /api/quote/{symbol}?period={period}` - Proxy requests to Yahoo Finance API
  - `symbol`: Stock ticker symbol (e.g., AAPL, GOOGL)
  - `period`: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y)

## Features

- CORS enabled for cross-origin requests
- SSL certificate verification disabled for development
- Automatic timeout handling (10 seconds)
- Error handling for API failures



