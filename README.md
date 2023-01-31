## Motivation

Qualitative comparisons for multiple results is so tiresome in image restoration domain.

## Install

```sh
pip install git+https://github.com/KIMGEONUNG/QualCmp
```

## Quick Start

```sh
QualCmp -d /path/for/images
```

The image directory hierarchy must be like below.

```sh
srcs
├── gt
│   ├── 0.jpg
│   └── 10000.jpg
├── n1
│   ├── 0.jpg
│   └── 10000.jpg
├── n2
│   ├── 0.jpg
│   └── 10000.jpg
├── n3
│   ├── 0.jpg
│   └── 10000.jpg
├── n4
│   ├── 0.jpg
│   └── 10000.jpg
└── n5
    ├── 0.jpg
    └── 10000.jpg
```

The export path is `$HOME/Downloads`


## Features

- View for multiple type and contents in a way of parallel zoom-in-out and translation
- Export all images at one time

<figure>
<img src="docs/animation.gif" alt="fail" style="width:100%">
</figure>
