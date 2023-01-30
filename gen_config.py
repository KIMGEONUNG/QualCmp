import json
from glob import glob
from os.path import join

if __name__ == "__main__":
    a = {}
    dirs = sorted(glob('imgs/*'))
    for d in dirs:
        files = sorted(glob(join(d, "*")))
        a[d] = files
    with open('config.json', 'w', encoding='utf-8') as f:
        json.dump(a, f, ensure_ascii=False, indent=4)
