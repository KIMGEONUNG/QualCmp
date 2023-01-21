#!/usr/bin/env python

import socketserver
import http.server

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_my_headers()
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def send_my_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    print("Server started at localhost:" + str(PORT))
    httpd.serve_forever()

