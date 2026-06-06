import os
import argparse
import http.server
import json
import socketserver
from glob import glob
from os import chdir, getcwd, symlink
from os.path import basename, dirname, islink, join


def parse():
    p = argparse.ArgumentParser()
    p.add_argument('-p', '--port', type=int, default=8080)
    p.add_argument('-d', '--dir', type=str, default=None)
    p.add_argument('--gen_config', action='store_true')
    p.add_argument('-f', '--focus_first', action='store_true')
    return p.parse_args()


def gen_config(path='srcs', focus_first=False, output_path='config.json'):
    a = {}
    dirs = sorted(glob(join(path, '*/')))
    files_first = None
    for i, d in enumerate(dirs):
        files = sorted(glob(join(d, "*")))
        if i == 0:
            files_first = files
        if focus_first:
            a[d] = [join(d, basename(k)) for k in files_first]
        else:
            a[d] = files
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(a, f, ensure_ascii=False, indent=4)


def is_port_in_use(port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0


class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_my_headers()
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def send_my_headers(self):
        self.send_header("Cache-Control",
                         "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def remove_generated_runtime_files(web_root):
    config_path = join(web_root, "config.json")
    srcs_path = join(web_root, "srcs")

    if os.path.exists(config_path):
        os.remove(config_path)
    if islink(srcs_path):
        os.remove(srcs_path)


def run_qualcmp():
    args = parse()
    port = args.port
    web_root = join(dirname(__file__), "web")

    if args.gen_config:
        if not args.dir:
            raise SystemExit("--gen_config requires --dir")
        print('Create config file on %s' % args.dir)
        gen_config(args.dir, args.focus_first)
        return 0

    if args.dir:
        # CREATE SYMLINK
        path_from = join(getcwd(), args.dir)
        path_to = join(web_root, "srcs")

        if islink(path_to):
            os.remove(path_to)
        elif os.path.exists(path_to):
            raise RuntimeError("%s exists and is not a symlink" % path_to)
        symlink(path_from, path_to)
    else:
        remove_generated_runtime_files(web_root)

    # MOVE TO SERVER ROOT
    chdir(web_root)

    if args.dir:
        # MAKE CONFIG
        gen_config(focus_first=args.focus_first)

    # CHANGE PORT NUMBER IF USED
    for _ in range(100):
        if is_port_in_use(port):
            port = port + 1
            continue
        break

    # START SERVER
    with ReusableTCPServer(("localhost", port),
                           MyHTTPRequestHandler) as httpd:
        print("Server started at http://localhost:" + str(port))
        httpd.serve_forever()


if __name__ == "__main__":
    run_qualcmp()
