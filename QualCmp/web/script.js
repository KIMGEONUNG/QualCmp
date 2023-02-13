// INIT
var pane = document.getElementById("pane");
var btn_next = document.getElementById("btn_next");
var btn_previous = document.getElementById("btn_previous");
var btn_export = document.getElementById("btn_export");
var input_width = document.getElementById("input_width");
var input_height = document.getElementById("input_height");
var input_scale = document.getElementById("input_scale");
var input_idx = document.getElementById("input_idx");
var input_smooth = document.getElementById("input_smooth");
var input_autoresize_image = document.getElementById("input_autoresize_image");
var input_autoresize_canvas = document.getElementById("input_autoresize_canvas");

var idx = 0;
var size = 500;
var len = 0;
var config_obj;
var imgs = {};
var ctxs = {};
var cnvs = {};

var img_w = 0;
var img_h = 0;

// SMOOTH ON OFF
input_smooth.addEventListener("change", () => {
  for (const key in cnvs) {
    if (cnvs.hasOwnProperty(key)) {
      redraw_which(imgs[key], cnvs[key]);
    }
  }
})

// AUTORESIZE(IMAGE) ON OFF
input_autoresize_image.addEventListener("change", () => {
  for (const key in cnvs) {
    if (cnvs.hasOwnProperty(key)) {
      redraw_which(imgs[key], cnvs[key]);
    }
  }
})

// AUTORESIZE(CANVAS) ON OFF
input_autoresize_canvas.addEventListener("change", () => {
  input_width.value = img_w
  input_height.value = img_h
  update_size()
})

// CHANGE CANVAS SIZE
function update_size() {
  for (const key in cnvs) {
    if (cnvs.hasOwnProperty(key)) {
      const cnv = cnvs[key];
      cnv.width = Number(input_width.value) * Number(input_scale.value)
      cnv.height = Number(input_height.value) * Number(input_scale.value)
      let ctx = cnv.getContext('2d');
      trackTransforms(ctx);
      redraw_which(imgs[key], cnv)
    }
  }
}

input_width.addEventListener("change", update_size)
input_height.addEventListener("change", update_size)
input_scale.addEventListener("change", update_size)

function update_image(idx) {
  let i = 0
  for (const key in config_obj) {
    if (config_obj.hasOwnProperty(key)) {
      const element = config_obj[key][idx];
      // ADD IMAGE
      let canvas = cnvs[key]
      let img = imgs[key]
      img.src = element;
      img.onload = () => {
        if (i == 0) {
          i = 1
          img_w = img.width
          img_h = img.height

          // AUTO CANVAS RESIZING
          if (input_autoresize_canvas.checked) {
            input_width.value = img_w
            input_height.value = img_h
            update_size()
          }
        }
        redraw_which(img, canvas);
      }
    }
  }

}

event_move = (logic) => {
  return () => {
    idx = logic(idx)
    input_idx.value = idx
    update_image(idx)
  }
}

// CHANGE INDEX
input_idx.addEventListener("change", () => {
  console.log("Out of range");
  if (input_idx.value > len - 1) {
    input_idx.value = len - 1;
  }
  if (input_idx.value < 0) {
    input_idx.value = 0;
  }
  update_image(input_idx.value);
})
btn_next.addEventListener("click", () => {
  input_idx.value = Math.min(Number(input_idx.value) + 1, len - 1)
  update_image(input_idx.value);
})
btn_previous.addEventListener("click", () => {
  input_idx.value = Math.max(0, Number(input_idx.value) - 1);
  update_image(input_idx.value)
})

btn_export.addEventListener("click", function() {
  let r = (Math.random() + 1).toString(36).substring(7);
  let idx = input_idx.value
  for (const key in config_obj) {
    if (config_obj.hasOwnProperty(key)) {
      let cnv = cnvs[key]
      let dataURL = cnv.toDataURL("image/png", 1.0);
      let path = 'zoom_I' + idx + "_" + r + "_" + key + ".png"
      downloadImage(dataURL, path);
    }
  }
})

function downloadImage(data, filename = 'untitled.jpeg') {
  var a = document.createElement('a');
  a.href = data;
  a.download = filename;
  a.click();
  a.remove();
}

function set2pixelated(ctx) {
  ctx.mozImageSmoothingEnabled = input_smooth.checked;
  ctx.oImageSmoothingEnabled = input_smooth.checked;
  ctx.webkitImageSmoothingEnabled = input_smooth.checked;
  ctx.msImageSmoothingEnabled = input_smooth.checked;
  ctx.imageSmoothingEnabled = input_smooth.checked;
}

window.onload = async function() {
  let config = await fetch("config.json")
    .then(response => response.json());

  config_obj = config;
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      const element = config[key];
      len = element.length

      // CREATE CANVAS
      let div = document.createElement('div');
      div.style.margin = "8px"
      let label = document.createElement('p');
      label.textContent = key
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');

      ctxs[key] = ctx;
      cnvs[key] = canvas;
      trackTransforms(ctx);

      canvas.width = input_width.value
      canvas.height = input_height.value
      canvas.id = key
      div.appendChild(canvas)
      div.appendChild(label)
      pane.appendChild(div);

      // ADD IMAGE
      let img = new Image;
      imgs[key] = img

      // ENROLL EVENT
      var lastX = canvas.width / 2, lastY = canvas.height / 2;
      var dragStart, dragged;
      canvas.addEventListener('mousedown', function(evt) {
        document.body.style.mozUserSelect = document.body.style.userSelect = 'none';
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragStart = ctx.transformedPoint(lastX, lastY);
        dragged = false;
      }, false);

      canvas.addEventListener('mousemove', function(evt) {
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragged = true;
        if (dragStart) {
          for (const key in config) {
            if (config.hasOwnProperty(key)) {
              var pt = ctxs[key].transformedPoint(lastX, lastY);
              ctxs[key].translate(pt.x - dragStart.x, pt.y - dragStart.y);
              redraw_which(imgs[key], cnvs[key]);
            }
          }
        }
      }, false);

      canvas.addEventListener('mouseup', function(evt) {
        dragStart = null;
        if (!dragged) zoom(evt.shiftKey ? -1 : 1);
      }, false);

      // ENROLL ZOOM
      var scaleFactor = 1.05;
      var zoom = function(clicks) {
        var factor = Math.pow(scaleFactor, clicks);
        for (const key in config) {
          if (config.hasOwnProperty(key)) {
            var pt = ctxs[key].transformedPoint(lastX, lastY);
            ctxs[key].translate(pt.x, pt.y);
            ctxs[key].scale(factor, factor);
            ctxs[key].translate(-pt.x, -pt.y);
            redraw_which(imgs[key], cnvs[key]);
          }
        }
      }

      var handleScroll = function(evt) {
        var delta = evt.wheelDelta ? evt.wheelDelta / 40 : evt.detail ? -evt.detail : 0;
        if (delta) zoom(delta);
        return evt.preventDefault() && false;
      };
      canvas.addEventListener('DOMMouseScroll', handleScroll, false);
      canvas.addEventListener('mousewheel', handleScroll, false);
    }
  }
  update_image(idx)
}

function redraw_which(img, cnv) {
  if (input_autoresize_image.checked) {
    redraw(img, cnv, img_w, img_h)
  }
  else {
    redraw(img, cnv, img.width, img.height)
  }
}

function redraw(img, cnv, w, h) {
  var ctx = cnv.getContext('2d')
  set2pixelated(ctx)
  var p1 = ctx.transformedPoint(0, 0);
  var p2 = ctx.transformedPoint(cnv.width, cnv.height);
  ctx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
  ctx.drawImage(img, 0, 0, w, h);
}

function trackTransforms(ctx) {
  var svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
  var xform = svg.createSVGMatrix();
  ctx.getTransform = function() { return xform; };

  var savedTransforms = [];
  var save = ctx.save;
  ctx.save = function() {
    savedTransforms.push(xform.translate(0, 0));
    return save.call(ctx);
  };
  var restore = ctx.restore;
  ctx.restore = function() {
    xform = savedTransforms.pop();
    return restore.call(ctx);
  };

  var scale = ctx.scale;
  ctx.scale = function(sx, sy) {
    xform = xform.scaleNonUniform(sx, sy);
    return scale.call(ctx, sx, sy);
  };
  var rotate = ctx.rotate;
  ctx.rotate = function(radians) {
    xform = xform.rotate(radians * 180 / Math.PI);
    return rotate.call(ctx, radians);
  };
  var translate = ctx.translate;
  ctx.translate = function(dx, dy) {
    xform = xform.translate(dx, dy);
    return translate.call(ctx, dx, dy);
  };
  var transform = ctx.transform;
  ctx.transform = function(a, b, c, d, e, f) {
    var m2 = svg.createSVGMatrix();
    m2.a = a; m2.b = b; m2.c = c; m2.d = d; m2.e = e; m2.f = f;
    xform = xform.multiply(m2);
    return transform.call(ctx, a, b, c, d, e, f);
  };
  var setTransform = ctx.setTransform;
  ctx.setTransform = function(a, b, c, d, e, f) {
    xform.a = a;
    xform.b = b;
    xform.c = c;
    xform.d = d;
    xform.e = e;
    xform.f = f;
    return setTransform.call(ctx, a, b, c, d, e, f);
  };
  var pt = svg.createSVGPoint();
  ctx.transformedPoint = function(x, y) {
    pt.x = x; pt.y = y;
    return pt.matrixTransform(xform.inverse());
  }
}
