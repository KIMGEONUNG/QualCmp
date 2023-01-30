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

The directory hierarchy must be like below

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

## Configuration

<span style="color:red">(WIP)</span>

## Features

- View for multiple type and contents
- Parallel zoom-in-out and translation
- Export every image at one time

## Todo

### New Features

- Export with predefined name
- Write script which creates config.json 
- Show measures like psnr


<figure>
<img src="srcs/ui_screenshot.gif" alt="fail" style="width:100%">
</figure>
