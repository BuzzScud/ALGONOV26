# UptimeKit Integration Setup

The API page is integrated with [UptimeKit](https://github.com/abhixdd/UptimeKit), a simple uptime monitoring dashboard.

## Features

- Real-time monitoring (checks every minute)
- Multiple monitor types: HTTP/HTTPS, DNS, ICMP Ping
- Individual charts for each monitor
- Track response times (avg, min, max)
- Status indicators:
  - 🟢 **Operational** - Response time < 1000ms
  - 🟡 **Degraded** - Response time 1000-5000ms
  - 🔴 **Down** - Service unavailable or response time > 5000ms
- Auto-refreshes every 30 seconds

## Setup Instructions

### Option 1: Using Docker (Recommended)

1. Clone the UptimeKit repository:
```bash
git clone https://github.com/abhixdd/UptimeKit.git
cd UptimeKit
```

2. Start the backend and frontend:
```bash
docker-compose up --build
```

3. The backend API will be available at `http://localhost:3000`

### Option 2: Using Node.js

1. Clone the UptimeKit repository:
```bash
git clone https://github.com/abhixdd/UptimeKit.git
cd UptimeKit
```

2. Install dependencies:
```bash
npm run install:all
```

3. Start the backend:
```bash
cd backend
npm run dev
```

The backend API will be available at `http://localhost:3000`

## Configuration

The API URL is configured via environment variable. Create a `.env` file in the project root:

```
VITE_API_URL=http://localhost:3000
```

If not set, it defaults to `http://localhost:3000`.

## API Endpoints

The integration uses the following UptimeKit API endpoints:

- `GET /api/monitors` - Get all monitors
- `POST /api/monitors` - Create monitor
- `PUT /api/monitors/:id` - Update monitor
- `DELETE /api/monitors/:id` - Delete monitor
- `PATCH /api/monitors/:id/pause` - Toggle pause
- `GET /api/monitors/:id/chart/uptime` - Uptime chart data
- `GET /api/monitors/:id/chart/response-time` - Response time chart data
- `GET /api/monitors/:id/history` - Last 30 checks
- `GET /api/monitors/:id/downtime` - Latest downtime period info

## Usage

1. Ensure the UptimeKit backend is running
2. Navigate to the API page in the web application
3. Click "Add Monitor" to add a new website/API to monitor
4. Choose monitor type (HTTP/HTTPS, DNS, or ICMP Ping)
5. Enter a name and URL
6. Monitor status updates automatically every minute
7. View charts, pause, edit, or delete monitors from the interface

## Connection Status

The API page displays a connection status indicator:
- 🟢 **Connected** - Backend API is reachable
- 🔴 **Disconnected** - Backend API is not available

If disconnected, check that the UptimeKit backend is running on port 3000.





