# Prime Tetration Trading Application

A web application for financial market analysis and projections using advanced mathematical models.

## Project Structure

```
/
├── backend/              # Python backend server
│   ├── server.py        # HTTP server with API proxy
│   └── requirements.txt  # Python dependencies
├── src/                 # React frontend application
│   ├── components/      # React components
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── layouts/        # Layout components
│   └── utils/          # Utility functions
├── docs/               # Documentation
│   ├── integration/     # Integration guides
│   └── *.md            # Documentation files
├── public/             # Static assets
├── archive/            # Archived old workspace files
└── dist/               # Build output (gitignored)
```

## Features

- Real-time stock market data monitoring
- Prime tetration-based price projections
- Fibonacci retracement tools
- News aggregation from multiple sources
- API monitoring dashboard
- Trading interface
- Data visualization and charts

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.7+

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Run the server (no dependencies required)
python server.py
```

The backend will be available at `http://localhost:8080`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Documentation

See the `docs/` directory for detailed documentation:
- Integration guides
- Formula references
- API setup instructions
- Projection improvements

## License

See LICENSE file for details.
