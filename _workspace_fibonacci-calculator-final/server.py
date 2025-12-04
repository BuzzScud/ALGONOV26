from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import ssl
from urllib.error import HTTPError, URLError

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # Handle API proxy requests
        if self.path.startswith('/api/quote/'):
            self.handle_api_request()
        else:
            # Serve static files
            super().do_GET()

    def handle_api_request(self):
        try:
            # Extract symbol and period from path
            # Format: /api/quote/AAPL?period=1d
            path_parts = self.path.split('?')
            symbol = path_parts[0].replace('/api/quote/', '')
            
            # Parse query parameters
            params = {}
            if len(path_parts) > 1:
                params = urllib.parse.parse_qs(path_parts[1])
                period = params.get('period', ['1d'])[0]
            else:
                period = '1d'
            
            # Determine interval based on period
            interval_map = {
                '1d': '5m',
                '5d': '15m',
                '1mo': '1d',
                '3mo': '1d',
                '6mo': '1d',
                '1y': '1wk'
            }
            interval = interval_map.get(period, '1d')
            
            # Make request to Yahoo Finance
            url = f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={period}'
            
            # Create SSL context that doesn't verify certificates (for development)
            context = ssl._create_unverified_context()
            
            # Add headers to mimic a browser request
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            req = urllib.request.Request(url, headers=headers)
            
            with urllib.request.urlopen(req, context=context, timeout=10) as response:
                data = response.read()
                
                # Send successful response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
                
        except HTTPError as e:
            self.send_error(e.code, f'API Error: {e.reason}')
        except URLError as e:
            self.send_error(500, f'Connection Error: {str(e.reason)}')
        except Exception as e:
            self.send_error(500, f'Server Error: {str(e)}')

def run_server(port=8080):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f'Server running on port {port}...')
    print(f'Access the app at: http://localhost:{port}')
    httpd.serve_forever()

if __name__ == '__main__':
    run_server(8080)