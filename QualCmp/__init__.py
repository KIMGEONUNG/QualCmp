import socketserver
import http.server
import os
from os.path import join, dirname, islink
from os import symlink, getcwd, chdir
import argparse
import json
from glob import glob


def parse():
    p = argparse.ArgumentParser()
    p.add_argument('-p', '--port', type=int, default=8080)
    p.add_argument('-d', '--dir', type=str, required=True)
    return p.parse_args()


def gen_config():
    a = {}
    dirs = sorted(glob('srcs/*'))
    for d in dirs:
        files = sorted(glob(join(d, "*")))
        a[d] = files
    with open("config.json", 'w', encoding='utf-8') as f:
        json.dump(a, f, ensure_ascii=False, indent=4)


class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_my_headers()
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def send_my_headers(self):
        self.send_header("Cache-Control",
                         "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")


def run_qualcmp():
    args = parse()
    port = args.port

    # CREATE SYMLINK
    path_from = join(getcwd(), args.dir)
    path_to = join(dirname(__file__), "web", "srcs")

    if islink(path_to):
        os.remove(path_to)
    symlink(path_from, path_to)

    # /home/comar/anaconda3/lib/python3.8/site-packages/QualCmp/web
    path = join(dirname(__file__), "web")

    # MOVE TO SERVER ROOT
    chdir(path)

    # MAKE CONFIG
    gen_config()

    # START SERVER
    with socketserver.TCPServer(("localhost", port),
                                MyHTTPRequestHandler) as httpd:
        print("Server started at localhost:" + str(port))
        httpd.serve_forever()
