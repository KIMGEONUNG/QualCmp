// INIT
var pane = document.getElementById("pane");
var btn_next = document.getElementById("btn_next");
var btn_previous = document.getElementById("btn_previous");
var btn_export = document.getElementById("btn_export");

var idx = 0;
var size = 500;
var len = 0;
var config_obj;
var imgs = {};
var ctxs = {};
var cnvs = {};

event_move = (logic) => {
  return () => {
    idx = logic(idx)

    for (const key in config_obj) {
      if (config_obj.hasOwnProperty(key)) {
        const element = config_obj[key][idx];
        // ADD IMAGE
        let canvas = document.getElementById(key)
        let ctx = canvas.getContext('2d');
        let img = imgs[key]
        img.src = element;
        img.onload = () => {
          redraw(img, ctx, size, size);
        }
      }
    }
  }
}

btn_next.addEventListener("click", event_move((a) => { return Math.min(a + 1, len - 1) }))
btn_previous.addEventListener("click", event_move((a) => { return Math.max(0, a - 1) }))
btn_export.addEventListener("click", function() {
  for (const key in config_obj) {
    if (config_obj.hasOwnProperty(key)) {
      let cnv = cnvs[key]
      let dataURL = cnv.toDataURL("image/png", 1.0);
      let path = 'outputs_' + key + ".png"
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
  ctx.mozImageSmoothingEnabled = false;
  ctx.oImageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
}

window.onload = async function() {
  let config = await fetch("srcs/config.json")
    .then(response => response.json());

  config_obj = config;
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      const element = config[key];
      len = element.length

      // CREATE CANVAS
      let div = document.createElement('div');
      let label = document.createElement('p');
      label.textContent = key
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');

      ctxs[key] = ctx;
      cnvs[key] = canvas;
      trackTransforms(ctx);

      canvas.width = size
      canvas.height = size
      canvas.id = key
      div.appendChild(canvas)
      div.appendChild(label)
      pane.appendChild(div);

      // ADD IMAGE
      let img = new Image;
      imgs[key] = img
      img.src = element[idx];
      img.onload = () => {
        redraw(img, ctx, size, size);
      }

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
              redraw(imgs[key], ctxs[key], size, size);
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
            redraw(imgs[key], ctxs[key], size, size);
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
}

function redraw(img, ctx, width, height) {
  set2pixelated(ctx)
  var p1 = ctx.transformedPoint(0, 0);
  var p2 = ctx.transformedPoint(width, height);
  ctx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
  ctx.drawImage(img, 0, 0);
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
