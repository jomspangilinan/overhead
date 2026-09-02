
// Overhead — diagram module for the plan page.
// Data-driven: nodes, typed edges, groups. Renders two figures (#after, #groups),
// smooth bezier edges, icon/card node modes, semantic zoom, layer toggles,
// hover isolation, group collapse, and the request trace.
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, kids) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c == null) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var MONO = "'IBM Plex Mono', monospace", SANS = "'IBM Plex Sans', sans-serif", HEAD = 'Archivo, sans-serif';
  var ICON = 56, CARD_W = 200, CARD_H = 76;

  // ---------- shared renderers ----------
  function gear(x, y) {
    return el('g', { 'class': 'gear', transform: 'translate(' + x + ',' + y + ')', stroke: 'currentColor', 'stroke-width': 1.2, fill: 'none' }, [
      el('circle', { r: 5 }), el('circle', { r: 1.5, fill: 'currentColor', stroke: 'none' }),
      el('line', { x1: 0, y1: -8, x2: 0, y2: -5.5 }), el('line', { x1: 0, y1: 5.5, x2: 0, y2: 8 }),
      el('line', { x1: -8, y1: 0, x2: -5.5, y2: 0 }), el('line', { x1: 5.5, y1: 0, x2: 8, y2: 0 })]);
  }
  function badge(x, y, text) {
    var w = text.length * 5.6 + 10;
    return el('g', { 'class': 'sec' }, [
      el('rect', { x: x, y: y, width: w, height: 12, rx: 3, fill: 'var(--surface)', stroke: 'currentColor', 'stroke-width': .8 }),
      el('text', { x: x + w / 2, y: y + 9, 'font-family': MONO, 'font-size': 8.5, 'font-weight': 600, fill: 'currentColor', 'text-anchor': 'middle' }, [text])]);
  }
  function bounds(n, mode) {
    if (mode === 'card') return { l: n.cx - CARD_W / 2, r: n.cx + CARD_W / 2, t: n.cy - CARD_H / 2, b: n.cy + CARD_H / 2 };
    return { l: n.cx - ICON / 2, r: n.cx + ICON / 2, t: n.cy - ICON / 2, b: n.cy + ICON / 2 };
  }
  function renderNode(n, mode) {
    var g = el('g', { 'class': 'node' + (mode === 'card' ? ' card' : ''), 'data-id': n.id, transform: 'translate(' + n.cx + ',' + n.cy + ')' });
    if (mode === 'card') {
      if (n.stacked) g.appendChild(el('rect', { x: -CARD_W / 2 + 6, y: -CARD_H / 2 - 6, width: CARD_W, height: CARD_H, rx: 8, fill: 'var(--surface)', stroke: 'currentColor', 'stroke-width': 1, opacity: .5 }));
      g.appendChild(el('rect', { 'class': 'frame', x: -CARD_W / 2, y: -CARD_H / 2, width: CARD_W, height: CARD_H, rx: 8, fill: 'var(--surface)', stroke: 'currentColor', 'stroke-width': 1 }));
      if (n.warn) g.appendChild(el('line', { 'class': 'stripe', x1: -CARD_W / 2 + 1.5, y1: -CARD_H / 2 + 10, x2: -CARD_W / 2 + 1.5, y2: CARD_H / 2 - 10, stroke: 'var(--finding)', 'stroke-width': 3, 'stroke-linecap': 'round' }));
      if (n.cluster) { n.cluster.slice(0, 4).forEach(function (ic, i) { g.appendChild(el('use', { href: '#' + ic, x: -CARD_W / 2 + 12 + (i % 2) * 25, y: -24 + Math.floor(i / 2) * 25, width: 23, height: 23 })); }); }
      else g.appendChild(el('use', { href: '#' + n.icon, x: -CARD_W / 2 + 12, y: -24, width: 48, height: 48 }));
      var tx = -CARD_W / 2 + 70;
      g.appendChild(el('text', { x: tx, y: -20, 'font-family': HEAD, 'font-size': 9.5, 'font-weight': 600, fill: 'currentColor', opacity: .65 }, [n.term]));
      g.appendChild(el('text', { x: tx, y: -4, 'font-family': SANS, 'font-size': 12.5, 'font-weight': 500, fill: 'currentColor' }, [n.name]));
      g.appendChild(el('text', { x: tx, y: 11, 'font-family': MONO, 'font-size': 9.5, fill: 'currentColor', opacity: .7 }, [n.settings]));
      if (n.sec) g.appendChild(badge(tx, 19, n.sec));
      g.appendChild(el('text', { 'class': 'cost', x: CARD_W / 2 - 10, y: 30, 'font-family': MONO, 'font-size': 11, 'font-weight': 600, fill: 'currentColor', 'text-anchor': 'end' }, [n.cost]));
      g.appendChild(gear(CARD_W / 2 - 14, -CARD_H / 2 + 14));
    } else {
      if (n.stacked) g.appendChild(el('use', { href: '#' + n.icon, x: -ICON / 2 + 6, y: -ICON / 2 - 6, width: ICON, height: ICON, opacity: .45 }));
      g.appendChild(el('rect', { 'class': 'ring' + (n.warn ? ' warn' : ''), x: -33, y: -33, width: 66, height: 66, rx: 11 }));
      if (n.res) { g.appendChild(el('rect', { x: -ICON / 2, y: -ICON / 2, width: ICON, height: ICON, rx: 6, fill: 'var(--surface)', stroke: n.res, 'stroke-width': 1.5 })); g.appendChild(el('use', { href: '#' + n.icon, x: -22, y: -22, width: 44, height: 44 })); }
      else g.appendChild(el('use', { href: '#' + n.icon, x: -ICON / 2, y: -ICON / 2, width: ICON, height: ICON }));
      g.appendChild(gear(38, -22));
      if (n.sec) g.appendChild(badge(4, 14, n.sec));
      g.appendChild(el('text', { y: 46, 'font-family': SANS, 'font-size': 12, 'font-weight': 500, fill: 'currentColor', 'text-anchor': 'middle' }, [n.name]));
    }
    return g;
  }
  // smooth edge geometry between two node bounds
  function edgePath(e, a, b, ca, cb) {
    var s, t, d, lab;
    if (e.side) {                       // same column: bracket out one side
      var k = e.side === 'left' ? -1 : 1, reach = 60;
      s = { x: k < 0 ? a.l : a.r, y: ca.y }; t = { x: k < 0 ? b.l : b.r, y: cb.y };
      d = 'M' + s.x + ',' + s.y + ' C' + (s.x + k * reach) + ',' + s.y + ' ' + (t.x + k * reach) + ',' + t.y + ' ' + t.x + ',' + t.y;
      lab = { x: s.x + k * (reach * .78), y: (s.y + t.y) / 2, rot: -90 };
    } else if (e.arch) {                // long hop over intermediate nodes: arch above
      var lift = 34;
      s = { x: ca.x, y: a.t }; t = { x: cb.x, y: b.t };
      d = 'M' + s.x + ',' + s.y + ' C' + s.x + ',' + (s.y - lift) + ' ' + t.x + ',' + (t.y - lift) + ' ' + t.x + ',' + t.y;
      lab = { x: (s.x + t.x) / 2 + 150, y: Math.min(s.y, t.y) - lift * .75 - 6 };
    } else {                            // left → right
      s = { x: a.r, y: ca.y }; t = { x: b.l, y: cb.y };
      var dx = Math.max(24, t.x - s.x);
      d = 'M' + s.x + ',' + s.y + ' C' + (s.x + dx * .5) + ',' + s.y + ' ' + (t.x - dx * .5) + ',' + t.y + ' ' + t.x + ',' + t.y;
      lab = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 - 9 };
    }
    return { d: d, s: s, t: t, lab: lab };
  }
  function renderEdge(e, geo, markerId) {
    var g = el('g', { 'class': 'edge', 'data-layer': e.layer, 'data-from': e.from, 'data-to': e.to, fill: 'none', stroke: 'currentColor' });
    var attrs = { d: geo.d, 'stroke-width': e.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    if (e.kind === 'async') { attrs['stroke-dasharray'] = '7 5'; attrs['marker-end'] = 'url(#' + markerId + ')'; }
    else if (e.kind === 'data') { attrs['stroke-dasharray'] = '2 5'; }
    else { attrs['marker-end'] = 'url(#' + markerId + ')'; }
    g.appendChild(el('path', attrs));
    if (e.badge) {
      g.appendChild(el('rect', { x: geo.lab.x - 13, y: geo.lab.y - 3, width: 26, height: 14, rx: 7, fill: 'currentColor', stroke: 'none', opacity: .85 }));
      g.appendChild(el('text', { x: geo.lab.x, y: geo.lab.y + 7.5, 'font-family': SANS, 'font-size': 9.5, 'font-weight': 600, fill: 'var(--surface)', stroke: 'none', 'text-anchor': 'middle' }, [e.badge]));
    } else if (e.label) {
      var ta = { 'font-family': SANS, 'font-size': 10, fill: 'currentColor', stroke: 'none', 'text-anchor': 'middle', opacity: .72 };
      if (geo.lab.rot) ta.transform = 'translate(' + geo.lab.x + ',' + geo.lab.y + ') rotate(' + geo.lab.rot + ')'; else { ta.x = geo.lab.x; ta.y = geo.lab.y; }
      g.appendChild(el('text', ta, [e.label]));
    }
    return g;
  }
  function marker(id) {
    return el('marker', { id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, [el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'currentColor' })]);
  }
  function wireHover(svg) {
    var nodes = svg.querySelectorAll('.node'), edges = svg.querySelectorAll('.edge');
    function clear() { svg.classList.remove('hover'); nodes.forEach(function (n) { n.classList.remove('lit'); }); edges.forEach(function (e) { e.classList.remove('lit'); }); svg._hoverId = null; }
    function light(id) {
      clear(); svg.classList.add('hover'); svg._hoverId = id;
      var n = svg.querySelector('.node[data-id="' + id + '"]'); if (n) n.classList.add('lit');
      edges.forEach(function (e) { if (e.dataset.from === id || e.dataset.to === id) { e.classList.add('lit'); var o = svg.querySelector('.node[data-id="' + (e.dataset.from === id ? e.dataset.to : e.dataset.from) + '"]'); if (o) o.classList.add('lit'); } });
    }
    // delegated, so nodes replaced by a rebuild never strand the hover state
    if (!svg._hoverWired) {
      svg._hoverWired = true;
      svg.addEventListener('mousemove', function (e) {
        if (svg.dataset.busy) return; var g = e.target.closest ? e.target.closest('.node') : null; var id = g ? g.dataset.id : null;
        if (id !== svg._hoverId) { if (id) svg._light(id); else svg._clear(); }
      });
      svg.addEventListener('mouseleave', function () { if (!svg.dataset.busy) svg._clear(); });
    }
    svg._light = light; svg._clear = clear; svg._hoverId = null;
    nodes.forEach(function (n) { n.style.cursor = 'grab'; });
    return clear;
  }

  // ---------- Figure 1: the serverless system, lanes ----------
  var LANES = ['INGRESS', 'HANDLERS', 'MESSAGING', 'WORKERS', 'DATA'];
  var ROWS = [88, 228, 368];
  var N = [
    { id: 'cdn', lane: 0, row: 0, icon: 'aws-cloudfront', term: 'Amazon CloudFront', name: 'static-site-cdn', settings: 'PriceClass_100 · 40 GB out', cost: '$3.60' },
    { id: 'pool', lane: 0, row: 1, icon: 'aws-cognito', term: 'Amazon Cognito', name: 'user-pool', settings: '12k MAU · JWT', cost: '$0.00' },
    { id: 'http', lane: 0, row: 2, icon: 'aws-apigateway', term: 'Amazon API Gateway', name: 'orders-http', settings: 'HTTP API · 5M req', cost: '$5.00' },
    { id: 'api', lane: 1, row: 2, icon: 'aws-lambda', term: 'AWS Lambda', name: 'orders-api', settings: 'arm64 · 512 MB · 120 ms', cost: '$4.98', sec: 'IAM role' },
    { id: 'sqs', lane: 2, row: 1, icon: 'aws-sqs', term: 'Amazon SQS', name: 'thumbnail-queue', settings: 'Standard · DLQ · 0.4M', cost: '$0.16' },
    { id: 'sns', lane: 2, row: 2, icon: 'aws-sns', term: 'Amazon SNS', name: 'order-events', settings: 'Standard · 1.2M publishes', cost: '$0.60' },
    { id: 'thumb', lane: 3, row: 1, icon: 'aws-lambda', term: 'AWS Lambda', name: 'thumbnail-worker', settings: 'arm64 · 1024 MB · 3 s', cost: '$16.10', sec: 'IAM role' },
    { id: 'notify', lane: 3, row: 2, icon: 'aws-lambda', term: 'AWS Lambda', name: 'notify · analytics', settings: 'arm64 · 256 MB · 80 ms', cost: '$0.40', sec: 'IAM role', stacked: true },
    { id: 'static', lane: 4, row: 0, icon: 'aws-s3', term: 'Amazon S3', name: 'static-site', settings: 'Standard · 2 GB', cost: '$0.05', sec: 'SSE-S3' },
    { id: 'uploads', lane: 4, row: 1, icon: 'aws-s3', term: 'Amazon S3', name: 'uploads', settings: '120 GB · 90d → IA', cost: '$2.76', sec: 'SSE-KMS' },
    { id: 'orders', lane: 4, row: 2, icon: 'aws-dynamodb', term: 'Amazon DynamoDB', name: 'orders', settings: 'On-demand · 40 GB · PITR', cost: '$63.75', sec: 'SSE-KMS', warn: true }
  ];
  var E = [
    { from: 'cdn', to: 'static', kind: 'sync', layer: 'request', w: 1.2, label: 'origin fetch · 0.3M' },
    { from: 'pool', to: 'http', kind: 'sync', layer: 'request', w: 1.2, label: 'JWT authorizer', side: 'left' },
    { from: 'http', to: 'api', kind: 'sync', layer: 'request', w: 3.5, label: '5M req/mo' },
    { from: 'api', to: 'orders', kind: 'data', layer: 'data', w: 2.6, label: 'reads / writes · 4.8M', arch: true },
    { from: 'api', to: 'sns', kind: 'async', layer: 'events', w: 2.2, label: 'publish · 1.2M' },
    { from: 'sns', to: 'notify', kind: 'async', layer: 'events', w: 2.2, badge: '×2' },
    { from: 'sns', to: 'sqs', kind: 'async', layer: 'events', w: 1.6, label: 'fan-out', side: 'right' },
    { from: 'sqs', to: 'thumb', kind: 'async', layer: 'events', w: 1.6, label: 'poll' },
    { from: 'thumb', to: 'uploads', kind: 'data', layer: 'data', w: 1.6, label: 'put · 0.4M' }
  ];
  var after = document.getElementById('after');
  if (after) {
    var mode = 'icon', zoom = 1, forceCards = false, clearAfter = function () {};
    var byId = {};
    var GROUP = { id: 'pipeline', label: 'order pipeline', members: ['sqs', 'sns', 'thumb', 'notify'], dx: 0, dy: 0 };
    var groupOn = false, groupCollapsed = false;
    // drag: nodes move in SVG units; edges re-route on every move (the model is the source of truth)
    function wireDrag(svg, byId) {
      svg._byId = byId;
      svg.querySelectorAll('.node').forEach(function (g) {
        g.addEventListener('pointerdown', function (e) {
          if (e.button !== 0) return; var n = svg._byId[g.dataset.id]; if (!n) return;
          var m = svg.getScreenCTM();
          svg._drag = { n: n, sx: e.clientX, sy: e.clientY, dx: n.group ? GROUP.dx : (n.dx || 0), dy: n.group ? GROUP.dy : (n.dy || 0), k: 1 / m.a, moved: false };
          svg.setPointerCapture(e.pointerId); svg.dataset.busy = '1'; e.preventDefault();
        });
      });
      if (svg._dragWired) return; svg._dragWired = true;
      svg.addEventListener('pointermove', function (e) {
        var d = svg._drag; if (!d) return; var ddx = (e.clientX - d.sx) * d.k, ddy = (e.clientY - d.sy) * d.k;
        if (!d.moved && Math.abs(ddx) + Math.abs(ddy) < 3) return; d.moved = true;
        if (d.n.group) { GROUP.dx = d.dx + ddx; GROUP.dy = d.dy + ddy; } else { d.n.dx = d.dx + ddx; d.n.dy = d.dy + ddy; }
        build(); svg.classList.add('hover'); var g2 = svg.querySelector('.node[data-id="' + d.n.id + '"]'); if (g2) g2.classList.add('lit');
      });
      function end() { var d = svg._drag; if (!d) return; svg._drag = null; delete svg.dataset.busy; svg._clear(); if (!d.moved) svg.dispatchEvent(new CustomEvent('overhead:select', { detail: d.n.id, bubbles: true })); }
      svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    }
    function build() {
      var gap = mode === 'card' ? 262 : 210, x0 = mode === 'card' ? 175 : 115, W = x0 * 2 + gap * 4, H = 456;
      after.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      while (after.firstChild) after.removeChild(after.firstChild);
      after.appendChild(el('defs', null, [marker('ah')]));
      var laneW = mode === 'card' ? 220 : 170;
      var lanes = el('g', { 'font-family': HEAD, 'font-size': 10, 'font-weight': 600, 'letter-spacing': 1.4, fill: 'currentColor', opacity: .55, 'text-anchor': 'middle' });
      LANES.forEach(function (name, i) {
        var cx = x0 + i * gap;
        if (i % 2 === 0) lanes.appendChild(el('rect', { x: cx - laneW / 2, y: 14, width: laneW, height: H - 24, rx: 6, fill: 'currentColor', opacity: .04, stroke: 'none' }));
        lanes.appendChild(el('text', { x: cx, y: 34 }, [name]));
      });
      after.appendChild(lanes);
      N.forEach(function (n) { n.cx = x0 + n.lane * gap + (n.dx || 0); n.cy = ROWS[n.row] + (n.dy || 0); byId[n.id] = n; });
      // ---- logical group: frame around members, or collapsed to one card
      var nodes = N.slice(), edgesNow = E.slice();
      var members = GROUP.members, inG = function (id) { return members.indexOf(id) >= 0; };
      var gsum = members.reduce(function (a, id) { return a + parseFloat(byId[id].cost.replace(/[$,]/g, '')); }, 0);
      if (groupOn && groupCollapsed) {
        var gm = members.map(function (id) { return byId[id]; });
        var gn = { id: GROUP.id, cx: gm.reduce(function (a, n) { return a + n.cx; }, 0) / gm.length + (GROUP.dx || 0), cy: gm.reduce(function (a, n) { return a + n.cy; }, 0) / gm.length + (GROUP.dy || 0),
                   icon: gm[0].icon, cluster: gm.map(function (n) { return n.icon; }), term: 'Group', name: GROUP.label, settings: gm.length + ' resources', cost: '$' + gsum.toFixed(2), group: true };
        nodes = N.filter(function (n) { return !inG(n.id); }).concat([gn]); byId[gn.id] = gn;
        var seen = {}; edgesNow = [];
        E.forEach(function (e) {
          var f = inG(e.from) ? GROUP.id : e.from, t = inG(e.to) ? GROUP.id : e.to; if (f === t) return;
          var k = f + '>' + t; if (seen[k]) return; seen[k] = 1;
          var c = {}; for (var key in e) c[key] = e[key]; c.from = f; c.to = t; var touched = (f !== e.from || t !== e.to); if (touched) { c.side = null; c.arch = false; c.badge = null; } edgesNow.push(c);
        });
      } else if (groupOn) {
        var bx = members.map(function (id) { return bounds(byId[id], mode); });
        var gx = Math.min.apply(null, bx.map(function (b) { return b.l; })) - 22, gy = Math.min.apply(null, bx.map(function (b) { return b.t; })) - 30;
        var gr = Math.max.apply(null, bx.map(function (b) { return b.r; })) + 22, gb = Math.max.apply(null, bx.map(function (b) { return b.b; })) + (mode === 'card' ? 22 : 62);
        var fr = el('g', { 'class': 'gframe' }, [
          el('rect', { x: gx, y: gy, width: gr - gx, height: gb - gy, rx: 10, fill: 'var(--accent)', 'fill-opacity': .05, stroke: 'var(--accent)', 'stroke-width': 1.2, 'stroke-dasharray': '6 4' }),
          el('text', { x: gx + 12, y: gy + 17, 'font-family': HEAD, 'font-size': 10, 'font-weight': 600, 'letter-spacing': .8, fill: 'var(--accent)' }, [GROUP.label.toUpperCase()]),
          el('text', { 'class': 'cost', x: gr - 12, y: gy + 17, 'font-family': MONO, 'font-size': 10, 'font-weight': 600, fill: 'var(--accent)', 'text-anchor': 'end' }, [members.length + ' resources · $' + gsum.toFixed(2) + '/mo'])]);
        after.appendChild(fr);
      }
      var eg = el('g', { 'class': 'edges' });
      edgesNow.forEach(function (e) { var a = byId[e.from], b = byId[e.to]; e.geo = edgePath(e, bounds(a, a.group ? 'card' : mode), bounds(b, b.group ? 'card' : mode), { x: a.cx, y: a.cy }, { x: b.cx, y: b.cy }); eg.appendChild(renderEdge(e, e.geo, 'ah')); });
      after.appendChild(eg);
      after.appendChild(el('g', { id: 'trace' }, [el('path', { id: 'tp1', fill: 'none', stroke: 'none' }), el('path', { id: 'tp2', fill: 'none', stroke: 'none' }), el('circle', { id: 'dot1', r: 6, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 2, style: 'display:none' }), el('circle', { id: 'dot2', r: 6, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 2, style: 'display:none' })]));
      var ng = el('g', { 'class': 'nodes' });
      nodes.forEach(function (n) { ng.appendChild(renderNode(n, n.group ? 'card' : mode)); });
      after.appendChild(ng);
      clearAfter = wireHover(after);
      wireDrag(after, byId);
      // trace geometry: hop paths joined by straight runs through the nodes they pass
      function hop(f, t) { var e = edgesNow.filter(function (e) { return e.from === f && e.to === t; })[0]; return e ? e.geo : null; }
      var h1 = hop('http', 'api'), h2 = hop('api', 'sns'), h3 = hop('sns', 'notify'), h4 = hop('api', 'orders');
      var pb = document.getElementById('play'); if (pb) pb.disabled = !(h1 && h2 && h3 && h4);
      if (h1 && h2 && h3) document.getElementById('tp1').setAttribute('d', h1.d + ' L' + h2.s.x + ',' + h2.s.y + ' ' + h2.d.replace(/^M[^C]+/, '') + ' L' + h3.s.x + ',' + h3.s.y + ' ' + h3.d.replace(/^M[^C]+/, ''));
      if (h4) document.getElementById('tp2').setAttribute('d', h4.d);
      applyZoom();
    }
    function setMode(m) { if (m !== mode) { mode = m; build(); } var cb = document.getElementById('cards'); if (cb) cb.setAttribute('aria-pressed', mode === 'card' ? 'true' : 'false'); }
    function zoomTo(z) { zoom = z; var ze = document.getElementById('zoom'), zv = document.getElementById('zoomv'); if (ze) ze.value = Math.round(z * 100); if (zv) zv.textContent = Math.round(z * 100) + '%'; applyZoom(); }
    function applyZoom() { var vp = after.parentElement; var base = vp.clientWidth || 1000; after.style.width = Math.round(base * zoom) + 'px'; after.style.height = 'auto'; }
    build();
    // layer toggles
    document.querySelectorAll('button.tg[data-layer]').forEach(function (b) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); after.classList.toggle('l-' + b.dataset.layer, on);
        if (on && b.dataset.layer === 'cost' && mode !== 'card') { forceCards = true; setMode('card'); if (zoom < 1.4) zoomTo(1.4); }
      });
    });
    var cardsBtn = document.getElementById('cards');
    if (cardsBtn) cardsBtn.addEventListener('click', function () { forceCards = mode !== 'card'; setMode(forceCards ? 'card' : 'icon'); if (forceCards && zoom < 1.4) zoomTo(1.4); if (!forceCards && zoom > 1) zoomTo(1); });
    var zoomEl = document.getElementById('zoom'), zoomOut = document.getElementById('zoomv');
    if (zoomEl) zoomEl.addEventListener('input', function () {
      zoom = zoomEl.value / 100; if (zoomOut) zoomOut.textContent = zoomEl.value + '%';
      if (!forceCards) setMode(zoom >= 1.25 ? 'card' : 'icon'); applyZoom();
    });
    window.addEventListener('resize', applyZoom);
    // zoom buttons, fit, and ctrl/cmd + wheel (pinch on a trackpad) over the canvas
    function clampZ(z) { return Math.max(.6, Math.min(1.6, Math.round(z * 20) / 20)); }
    var zi = document.getElementById('zoomin'), zo = document.getElementById('zoomout'), zf = document.getElementById('zoomfit');
    function afterZoom() { if (!forceCards) setMode(zoom >= 1.25 ? 'card' : 'icon'); }
    if (zi) zi.addEventListener('click', function () { zoomTo(clampZ(zoom + .2)); afterZoom(); });
    if (zo) zo.addEventListener('click', function () { zoomTo(clampZ(zoom - .2)); afterZoom(); });
    if (zf) zf.addEventListener('click', function () { forceCards = false; zoomTo(1); setMode('icon'); });
    var vp = after.parentElement;
    if (vp) vp.addEventListener('wheel', function (e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomTo(clampZ(zoom * (e.deltaY < 0 ? 1.1 : .9))); afterZoom(); }, { passive: false });
    // group: frame the order pipeline, or collapse it to one card
    var gb = document.getElementById('group'), gcb = document.getElementById('gcollapse');
    if (gb) gb.addEventListener('click', function () { groupOn = !groupOn; if (!groupOn) groupCollapsed = false; gb.setAttribute('aria-pressed', groupOn ? 'true' : 'false'); if (gcb) { gcb.disabled = !groupOn; gcb.setAttribute('aria-pressed', 'false'); } build(); });
    if (gcb) gcb.addEventListener('click', function () { if (!groupOn) return; groupCollapsed = !groupCollapsed; gcb.setAttribute('aria-pressed', groupCollapsed ? 'true' : 'false'); build(); });

    // Play a request — what trace_request does
    var play = document.getElementById('play'), stepsEl = document.getElementById('steps');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var raf = null, running = false;
    var steps = [[0, 'http', 'api', 'API Gateway receives the request'], [450, 'api', null, 'Lambda orders-api handles it'], [700, 'api', 'orders', 'writes the order to DynamoDB'], [1400, 'api', 'sns', 'publishes order-created to SNS'], [2400, 'sns', 'notify', 'two workers consume it — notify, analytics']];
    function lit(sel) { after.querySelectorAll(sel).forEach(function (x) { x.classList.add('lit'); }); }
    function renderSteps(upto) { if (stepsEl) stepsEl.innerHTML = upto < 0 ? '' : steps.map(function (s, i) { return '<span class="' + (i <= upto ? 'on' : '') + '">' + (i + 1) + ' · ' + s[3] + '</span>'; }).join(''); }
    function stop() { running = false; delete after.dataset.busy; if (raf) cancelAnimationFrame(raf); ['dot1', 'dot2'].forEach(function (i) { var d = document.getElementById(i); if (d) d.style.display = 'none'; }); play.setAttribute('aria-pressed', 'false'); clearAfter(); renderSteps(-1); }
    function place(dot, path, f) { var L = path.getTotalLength(); var p = path.getPointAtLength(Math.max(0, Math.min(1, f)) * L); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); }
    function run() {
      running = true; after.dataset.busy = '1'; clearAfter(); after.classList.add('hover'); play.setAttribute('aria-pressed', 'true');
      var p1 = document.getElementById('tp1'), p2 = document.getElementById('tp2'), d1 = document.getElementById('dot1'), d2 = document.getElementById('dot2');
      function stepLit(s) { lit('.node[data-id="' + s[1] + '"]'); if (s[2]) { lit('.edge[data-from="' + s[1] + '"][data-to="' + s[2] + '"]'); lit('.node[data-id="' + s[2] + '"]'); } }
      if (reduce) { steps.forEach(stepLit); renderSteps(steps.length - 1); running = false; delete after.dataset.busy; play.setAttribute('aria-pressed', 'false'); return; }
      var T1 = 2600, T2s = 700, T2 = 1500, total = 3400, t0 = performance.now(), done = -1;
      d1.style.display = ''; place(d1, p1, 0);
      (function frame(now) {
        if (!running) return; var t = now - t0;
        place(d1, p1, t / T1);
        if (t >= T2s) { d2.style.display = ''; place(d2, p2, (t - T2s) / T2); }
        if (t > T2s + T2) d2.style.display = 'none'; if (t > T1) d1.style.display = 'none';
        for (var i = 0; i < steps.length; i++) if (t >= steps[i][0] && i > done) { done = i; stepLit(steps[i]); renderSteps(done); }
        if (t < total) raf = requestAnimationFrame(frame); else setTimeout(stop, 900);
      })(t0);
    }
    if (play) { play.addEventListener('click', function () { running ? stop() : run(); }); renderSteps(-1); }
  }

  // ---------- Figure 2: groups (VPC / subnets) and collapse ----------
  var gsvg = document.getElementById('groups');
  if (gsvg) {
    var GN = [
      { id: 'cf', cx: 110, cy: 215, icon: 'aws-cloudfront', name: 'edge-cdn', cost: 12.4 },
      { id: 'alb', cx: 400, cy: 180, icon: 'aws-elb', name: 'prod-alb', cost: 22.27, group: 'pub' },
      { id: 'nat', cx: 400, cy: 320, icon: 'aws-nat', name: 'nat-a', cost: 77.85, group: 'pub', warn: true, res: '#8C4FFF' },
      { id: 'ecs', cx: 700, cy: 250, icon: 'aws-ecs', name: 'api-service ×2', cost: 71.10, group: 'priv', stacked: true },
      { id: 'rds', cx: 900, cy: 250, icon: 'aws-rds', name: 'orders-db', cost: 118.26, group: 'priv', sec: 'Multi-AZ' }
    ];
    var GE = [
      { from: 'cf', to: 'alb', kind: 'sync', w: 2.6, label: '1.2M req' },
      { from: 'alb', to: 'ecs', kind: 'sync', w: 2.6, label: 'target group' },
      { from: 'ecs', to: 'rds', kind: 'data', w: 2, label: 'reads / writes' },
      { from: 'ecs', to: 'nat', kind: 'sync', w: 1.6, label: 'egress · 1.2 TB', back: true }
    ];
    var GROUPS = [
      { id: 'cloud', x: 24, y: 24, w: 1032, h: 392, color: '#242F3E', icon: 'aws-group-cloud', label: 'AWS Cloud' },
      { id: 'vpc', x: 250, y: 60, w: 780, h: 336, color: '#8C4FFF', icon: 'aws-group-vpc', label: 'prod-vpc · 10.0.0.0/16', collapsible: true },
      { id: 'pub', x: 290, y: 108, w: 240, h: 262, color: '#7AA116', icon: 'aws-group-public', label: 'public-a · 10.0.1.0/24' },
      { id: 'priv', x: 580, y: 108, w: 420, h: 262, color: '#00A4A6', icon: 'aws-group-private', label: 'private-a · 10.0.10.0/24' }
    ];
    var collapsed = false, showCost = false;
    function money(v) { return '$' + v.toFixed(2); }
    function groupFrame(gr, members) {
      var g = el('g', { 'class': 'group', 'data-id': gr.id });
      g.appendChild(el('rect', { x: gr.x, y: gr.y, width: gr.w, height: gr.h, rx: 4, fill: gr.color, 'fill-opacity': .035, stroke: gr.color, 'stroke-width': 1.4 }));
      g.appendChild(el('use', { href: '#' + gr.icon, x: gr.x, y: gr.y, width: 28, height: 28 }));
      g.appendChild(el('text', { x: gr.x + 36, y: gr.y + 19, 'font-family': SANS, 'font-size': 12, 'font-weight': 500, fill: 'currentColor' }, [gr.label]));
      if (showCost && members.length) {
        var sum = members.reduce(function (a, n) { return a + n.cost; }, 0);
        g.appendChild(el('text', { 'class': 'gcost', x: gr.x + gr.w - 10, y: gr.y + 36, 'font-family': MONO, 'font-size': 10.5, 'font-weight': 600, fill: 'currentColor', 'text-anchor': 'end' }, [members.length + ' resources · ' + money(sum) + '/mo']));
      }
      return g;
    }
    function inGroup(n, gid) { if (gid === 'cloud') return true; if (gid === 'vpc') return n.group === 'pub' || n.group === 'priv'; return n.group === gid; }
    function buildGroups() {
      while (gsvg.firstChild) gsvg.removeChild(gsvg.firstChild);
      gsvg.appendChild(el('defs', null, [marker('gh')]));
      var nodes = GN.slice(), edges = GE.slice(), groups = GROUPS.slice();
      if (collapsed) {
        var vpcMembers = GN.filter(function (n) { return inGroup(n, 'vpc'); });
        var sum = vpcMembers.reduce(function (a, n) { return a + n.cost; }, 0);
        nodes = GN.filter(function (n) { return !inGroup(n, 'vpc'); }).concat([{ id: 'vpcnode', cx: 640, cy: 215, icon: 'aws-group-vpc', term: 'Amazon VPC', name: 'prod-vpc', settings: '2 subnets · ' + vpcMembers.length + ' resources', cost: money(sum), warn: true, collapsedGroup: true }]);
        edges = [{ from: 'cf', to: 'vpcnode', kind: 'sync', w: 2.6, label: '1.2M req' }];
        groups = groups.filter(function (g) { return g.id === 'cloud'; });
      }
      var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
      groups.forEach(function (gr) { gsvg.appendChild(groupFrame(gr, GN.filter(function (n) { return inGroup(n, gr.id); }))); });
      var eg = el('g', { 'class': 'edges' });
      edges.forEach(function (e) {
        var a = byId[e.from], b = byId[e.to], ma = a.collapsedGroup ? 'card' : 'icon', mb = b.collapsedGroup ? 'card' : 'icon';
        var geo;
        if (e.back) { // ecs → nat: leaves left, arrives right, one smooth S-curve
          var A = bounds(a, ma), B = bounds(b, mb), s = { x: A.l, y: a.cy }, t = { x: B.r, y: b.cy };
          geo = { d: 'M' + s.x + ',' + s.y + ' C' + (s.x - 110) + ',' + s.y + ' ' + (t.x + 110) + ',' + t.y + ' ' + t.x + ',' + t.y, s: s, t: t, lab: { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 - 9 } };
        } else geo = edgePath(e, bounds(a, ma), bounds(b, mb), { x: a.cx, y: a.cy }, { x: b.cx, y: b.cy });
        e.layer = 'request'; eg.appendChild(renderEdge(e, geo, 'gh'));
      });
      gsvg.appendChild(eg);
      var ng = el('g', { 'class': 'nodes' });
      nodes.forEach(function (n) { var node = renderNode(n, n.collapsedGroup ? 'card' : 'icon'); if (!n.collapsedGroup && showCost) node.appendChild(el('text', { 'class': 'cost', y: 61, 'font-family': MONO, 'font-size': 10.5, 'font-weight': 600, fill: 'currentColor', 'text-anchor': 'middle' }, [money(n.cost)])); ng.appendChild(node); });
      gsvg.appendChild(ng);
      wireHover(gsvg);
    }
    buildGroups();
    var cb = document.getElementById('collapse'); if (cb) cb.addEventListener('click', function () { collapsed = !collapsed; cb.setAttribute('aria-pressed', collapsed ? 'true' : 'false'); buildGroups(); });
    var gc = document.getElementById('gcost'); if (gc) gc.addEventListener('click', function () { showCost = !showCost; gc.setAttribute('aria-pressed', showCost ? 'true' : 'false'); buildGroups(); });
  }
})();

