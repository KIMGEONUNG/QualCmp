#!/usr/bin/env python

import socketserver
import http.server
import argparse
import os
from glob import glob
import json

def parse():
    p = argparse.ArgumentParser()
    p.add_argument('-p', '--port', type=int, default=8080)
    p.add_argument('-d', '--dir', type=str, required=True)
    return p.parse_args()

def gen_config(path):
    a = {}
    dirs = sorted(glob('imgs/*'))
    for d in dirs:
        files = sorted(glob(join(d, "*")))
        a[d] = files
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(a, f, ensure_ascii=False, indent=4)

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="web", **kwargs)

    def end_headers(self):
        self.send_my_headers()
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def send_my_headers(self):
        self.send_header("Cache-Control",
                         "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")


if __name__ == "__main__":
    args = parse()
    with socketserver.TCPServer(("localhost", args.port),
                                MyHTTPRequestHandler) as httpd:
        print("Server started at localhost:" + str(args.port))
        httpd.serve_forever()
