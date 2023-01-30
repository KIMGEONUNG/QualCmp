#!/usr/bin/env python

import socketserver
import http.server
import argparse

def parse():
    p = argparse.ArgumentParser()
    p.add_argument('-p', '--port', type=int, default=8080)
    return p.parse_args()
    pass

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_my_headers()
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def send_my_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")

if __name__ == "__main__":
    args = parse()
    with socketserver.TCPServer(("localhost", args.port), MyHTTPRequestHandler) as httpd:
        print("Server started at localhost:" + str(args.port))
        httpd.serve_forever()

