"""Static local server: always revalidate HTML/modules during development."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

os.chdir(Path(__file__).resolve().parents[1])


class DevelopmentHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


if __name__ == '__main__':
    print('Game: http://127.0.0.1:5173/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 5173), DevelopmentHandler).serve_forever()
