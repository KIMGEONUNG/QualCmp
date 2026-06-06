## QualCmp

QualCmp is a local browser workspace for qualitative image comparison. It keeps
pan, zoom, fitting, and export synchronized across image panes so restoration or
generation results can be inspected side by side.

## Install

```sh
pip install git+https://github.com/KIMGEONUNG/QualCmp
```

## Quick Start

```sh
QualCmp
```

Open the printed local URL and drop image files into the workspace. Each drop
adds panes to the current comparison stack. Dropping multiple files creates
parallel panes for the current comparison set. Dropping a folder tree with
repeated filenames groups panes by folder and enables frame navigation.

The previous directory workflow is still supported:

```sh
QualCmp -d /path/for/images
```

The image directory hierarchy can be:

```sh
srcs
├── gt
│   ├── 0.jpg
│   └── 10000.jpg
├── n1
│   ├── 0.jpg
│   └── 10000.jpg
└── n2
    ├── 0.jpg
    └── 10000.jpg
```

## Features

- Drag-and-drop image intake from files or folders, stacked across drops
- Parallel pan, zoom, fit, and 1:1 inspection across panes
- Optional normalization to align images with different source dimensions
- Per-frame navigation for folder-backed comparison sets
- Export of the current visible crop for each pane
