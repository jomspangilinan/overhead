/* Overhead — structure module.
   Containers nest (external | cloud | region | vpc | az | subnet | asg) and carry AWS semantics.
   Sections are user-made, free-form, renameable, collapsible — they replace fixed lanes.
   Everything is SVG; zoom scales coordinates. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  function el(t, a, k) { var e = document.createElementNS(NS, t); if (a) for (var x in a) if (a[x] != null) e.setAttribute(x, a[x]);
    (k || []).forEach(function (c) { if (c == null) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
  var MONO = "'JetBrains Mono',monospace", SANS = "Archivo,sans-serif";
  var ICON = 52, CARD_W = 196, CARD_H = 72;

  // ---- container kinds: colour, border, whether AWS draws it dashed ----
  var KIND = {
    external: { c: '#7D8998', dash: '', icon: 'aws-group-dc',      label: 'On-premises' },
    cloud:    { c: '#8B97A8', dash: '', icon: 'aws-group-cloud',   label: 'AWS Cloud' },
    account:  { c: '#E7157B', dash: '', icon: 'aws-group-account', label: 'Account' },
    region:   { c: '#00A4A6', dash: '5 4', icon: 'aws-group-region', label: 'Region' },
    vpc:      { c: '#8C4FFF', dash: '', icon: 'aws-group-vpc',     label: 'VPC' },
    az:       { c: '#00A4A6', dash: '5 4', icon: null,             label: 'Availability Zone' },
    subnetpub:{ c: '#7AA116', dash: '', icon: 'aws-group-public',  label: 'Public subnet' },
    subnetpri:{ c: '#00A4A6', dash: '', icon: 'aws-group-private', label: 'Private subnet' },
    asg:      { c: '#ED7100', dash: '5 4', icon: 'aws-group-asg',  label: 'Auto Scaling group' }
  };

  // ---- the scene ----
  var C = [
    { id:'ext',    kind:'external',  name:'corp-dc · Manila',        x:20,   y:250, w:186, h:230, parent:null },
    { id:'cloud',  kind:'cloud',     name:'AWS Cloud',               x:240,  y:26,  w:1180,h:718, parent:null },
    { id:'region', kind:'region',    name:'ap-southeast-1',          x:262,  y:62,  w:1142,h:664, parent:'cloud' },
    { id:'vpc',    kind:'vpc',       name:'prod-vpc · 10.0.0.0/16',  x:286,  y:270, w:1096,h:434, parent:'region' },
    { id:'aza',    kind:'az',        name:'ap-southeast-1a',         x:308,  y:318, w:518, h:366, parent:'vpc' },
    { id:'azb',    kind:'az',        name:'ap-southeast-1b',         x:848,  y:318, w:512, h:366, parent:'vpc' },
    { id:'puba',   kind:'subnetpub', name:'public-a · 10.0.1.0/24',  x:328,  y:362, w:216, h:142, parent:'aza' },
    { id:'pria',   kind:'subnetpri', name:'private-a · 10.0.10.0/24',x:566,  y:362, w:238, h:298, parent:'aza' },
    { id:'pubb',   kind:'subnetpub', name:'public-b · 10.0.2.0/24',  x:868,  y:362, w:216, h:142, parent:'azb' },
    { id:'prib',   kind:'subnetpri', name:'private-b · 10.0.11.0/24',x:1106, y:362, w:232, h:298, parent:'azb' }
  ];
  var N = [
    { id:'onprem', icon:'aws-group-dc',    term:'Corporate data center', name:'erp-legacy',   set:'Direct Connect · 1 Gbps', cost:'$0.00',  x:113, y:372, in:'ext' },
    { id:'cf',     icon:'aws-cloudfront',  term:'Amazon CloudFront',     name:'edge-cdn',     set:'PriceClass_100 · 40 GB',  cost:'$3.60',  x:352, y:170, in:'region' },
    { id:'apigw',  icon:'aws-apigateway',  term:'Amazon API Gateway',    name:'orders-http',  set:'HTTP API · 5M req',       cost:'$5.00',  x:548, y:170, in:'region' },
    { id:'fn',     icon:'aws-lambda',      term:'AWS Lambda',            name:'orders-api',   set:'arm64 · 512 MB · 120 ms', cost:'$4.98',  x:744, y:170, in:'region' },
    { id:'ddb',    icon:'aws-dynamodb',    term:'Amazon DynamoDB',       name:'orders',       set:'On-demand · 40 GB',       cost:'$63.75', x:940, y:170, in:'region', warn:true },
    { id:'s3',     icon:'aws-s3',          term:'Amazon S3',             name:'uploads',      set:'120 GB · 90d → IA',       cost:'$2.76',  x:1136,y:170, in:'region' },
    { id:'alb',    icon:'aws-elb',         term:'Elastic Load Balancing',name:'prod-alb',     set:'ALB · 1.2M LCU-h',        cost:'$22.27', x:436, y:432, in:'puba' },
    { id:'nat',    icon:'aws-nat',         term:'NAT Gateway',           name:'nat-a',        set:'1.2 TB processed',        cost:'$77.85', x:976, y:432, in:'pubb', warn:true, res:'#8C4FFF' },
    { id:'ecs',    icon:'aws-ecs',         term:'Amazon ECS',            name:'api-service',  set:'Fargate · 2 × 0.5 vCPU',  cost:'$71.10', x:685, y:432, in:'pria', stack:true },
    { id:'rds',    icon:'aws-rds',         term:'Amazon RDS',            name:'orders-db',    set:'db.r6g.large · Multi-AZ', cost:'$118.26',x:685, y:580, in:'pria', sec:'primary' },
    { id:'rdsb',   icon:'aws-rds',         term:'Amazon RDS',            name:'orders-db',    set:'standby',                 cost:'—',      x:1222,y:432, in:'prib', sec:'standby', ghost:true }
  ];
  var E = [
    { f:'onprem', t:'alb',  k:'sync',  l:'Direct Connect', w:1.4 },
    { f:'cf',     t:'s3',   k:'sync',  l:'origin · 0.3M', w:1.2, arch:true },
    { f:'apigw',  t:'fn',   k:'sync',  l:'5M req/mo',     w:3.2 },
    { f:'fn',     t:'ddb',  k:'data',  l:'4.8M',          w:2.4 },
    { f:'alb',    t:'ecs',  k:'sync',  l:'target group',  w:2.4 },
    { f:'ecs',    t:'rds',  k:'data',  l:'reads / writes',w:2.0 },
    { f:'ecs',    t:'nat',  k:'sync',  l:'egress · 1.2 TB', w:1.6 },
    { f:'rds',    t:'rdsb', k:'async', l:'sync replication', w:1.4 }
  ];
  // user-made sections — free-form, renameable, NOT a fixed taxonomy
  var S = [
    { id:'s1', name:'Checkout flow',  x:520,  y:120, w:480, h:118, color:'#3B82F6' },
    { id:'s2', name:'Owned by Payments', x:300, y:336, w:520, h:356, color:'#E7157B' },
    { id:'s3', name:'Legacy — migrating Q4', x:8, y:236, w:210, h:258, color:'#F0B34E' }
  ];

  var svg = document.getElementById('cv'); if (!svg) return;
  var state = { zoom: 1, sections: true, collapsed: {}, sel: 'ddb', showCost: false, showSec: false, grid: true, mode: 'icon' };
  var byC = {}, byN = {};

  function kindOf(c) { return KIND[c.kind]; }
  function isHidden(o) { // inside a collapsed container?
    var p = o.parent || o.in;
    while (p) { if (state.collapsed[p]) return true; p = byC[p] ? byC[p].parent : null; }
    return false;
  }
  function collapsedHost(id) { // nearest collapsed ancestor
    var p = byN[id] ? byN[id].in : (byC[id] ? byC[id].parent : null), last = null;
    while (p) { if (state.collapsed[p]) last = p; p = byC[p] ? byC[p].parent : null; }
    return last;
  }
  function nodeBox(n) {
    if (state.mode === 'card') return { l:n.x-CARD_W/2, r:n.x+CARD_W/2, t:n.y-CARD_H/2, b:n.y+CARD_H/2, x:n.x, y:n.y };
    return { l:n.x-ICON/2, r:n.x+ICON/2, t:n.y-ICON/2, b:n.y+ICON/2, x:n.x, y:n.y };
  }
  function boxOf(id) {
    var h = collapsedHost(id);
    if (h) { var c = byC[h]; return { l:c.x, r:c.x+220, t:c.y, b:c.y+84, x:c.x+110, y:c.y+42, host:h }; }
    return nodeBox(byN[id]);
  }
  function path(e) {
    var A = boxOf(e.f), B = boxOf(e.t);
    if (A.host && A.host === B.host) return null;
    if (Math.abs(A.x - B.x) < 8) { var k = -1, r = 46;
      var s = { x:A.l, y:A.y }, t = { x:B.l, y:B.y };
      return { d:'M'+s.x+','+s.y+' C'+(s.x+k*r)+','+s.y+' '+(t.x+k*r)+','+t.y+' '+t.x+','+t.y, s:s, t:t, lx:s.x+k*r*.8, ly:(s.y+t.y)/2, rot:-90 };
    }
    if (e.arch) { var lift = 52, s2 = { x:A.x, y:A.t }, t2 = { x:B.x, y:B.t };
      return { d:'M'+s2.x+','+s2.y+' C'+s2.x+','+(s2.y-lift)+' '+t2.x+','+(t2.y-lift)+' '+t2.x+','+t2.y, s:s2, t:t2, lx:(s2.x+t2.x)/2, ly:Math.min(s2.y,t2.y)-lift*.72, rot:0 };
    }
    var rev = B.x < A.x;
    var s3 = { x: rev ? A.l : A.r, y:A.y }, t3 = { x: rev ? B.r : B.l, y:B.y }, dx = Math.max(28, Math.abs(t3.x - s3.x));
    return { d:'M'+s3.x+','+s3.y+' C'+(s3.x+(rev?-1:1)*dx*.5)+','+s3.y+' '+(t3.x+(rev?1:-1)*dx*.5)+','+t3.y+' '+t3.x+','+t3.y,
             s:s3, t:t3, lx:(s3.x+t3.x)/2, ly:(s3.y+t3.y)/2-9, rot:0 };
  }
  function sum(cid) {
    var tot = 0;
    N.forEach(function (n) { var p = n.in; while (p) { if (p === cid) { tot += parseFloat(n.cost.replace(/[$,—]/g,'')) || 0; break; } p = byC[p] ? byC[p].parent : null; } });
    return tot;
  }
  function count(cid) { var k = 0; N.forEach(function (n) { var p = n.in; while (p) { if (p === cid) { k++; break; } p = byC[p] ? byC[p].parent : null; } }); return k; }

  function gear(x, y) { return el('g', { 'class':'gear', transform:'translate('+x+','+y+')', stroke:'currentColor', 'stroke-width':1.2, fill:'none' },
    [el('circle',{r:5}), el('circle',{r:1.5,fill:'currentColor',stroke:'none'}), el('line',{x1:0,y1:-8,x2:0,y2:-5.5}),
     el('line',{x1:0,y1:5.5,x2:0,y2:8}), el('line',{x1:-8,y1:0,x2:-5.5,y2:0}), el('line',{x1:5.5,y1:0,x2:8,y2:0})]); }

  function drawContainer(c) {
    var k = kindOf(c), g = el('g', { 'class':'cont'+(state.collapsed[c.id]?' cl':''), 'data-id':c.id });
    if (state.collapsed[c.id]) {
      g.appendChild(el('rect', { x:c.x, y:c.y, width:220, height:84, rx:10, fill:'#111620', stroke:k.c, 'stroke-width':1.6 }));
      if (k.icon) g.appendChild(el('use', { href:'#'+k.icon, x:c.x+12, y:c.y+12, width:26, height:26 }));
      g.appendChild(el('text', { x:c.x+(k.icon?46:14), y:c.y+22, 'font-family':SANS, 'font-size':9.5, 'font-weight':600, 'letter-spacing':.9, fill:k.c }, [k.label.toUpperCase()]));
      g.appendChild(el('text', { x:c.x+14, y:c.y+48, 'font-family':SANS, 'font-size':13, 'font-weight':500, fill:'#E8ECF2' }, [c.name]));
      g.appendChild(el('text', { x:c.x+14, y:c.y+66, 'font-family':MONO, 'font-size':10, fill:'#7C8CA0' }, [count(c.id)+' resources · $'+sum(c.id).toFixed(2)+'/mo']));
      g.appendChild(el('text', { 'class':'exp', x:c.x+206, y:c.y+68, 'font-family':MONO, 'font-size':13, fill:'#66738A', 'text-anchor':'end' }, ['⤢']));
      return g;
    }
    g.appendChild(el('rect', { x:c.x, y:c.y, width:c.w, height:c.h, rx:8, fill:k.c, 'fill-opacity':.045, stroke:k.c, 'stroke-width':1.3, 'stroke-dasharray':k.dash || null }));
    if (k.icon) g.appendChild(el('use', { href:'#'+k.icon, x:c.x+7, y:c.y+7, width:24, height:24 }));
    var tx = c.x + (k.icon ? 37 : 12);
    g.appendChild(el('text', { x:tx, y:c.y+16, 'font-family':SANS, 'font-size':8.5, 'font-weight':600, 'letter-spacing':.9, fill:k.c, opacity:.85 }, [k.label.toUpperCase()]));
    g.appendChild(el('text', { x:tx, y:c.y+28, 'font-family':SANS, 'font-size':11.5, 'font-weight':500, fill:'#C7D0DC' }, [c.name]));
    if (state.showCost) g.appendChild(el('text', { 'class':'ccost', x:c.x+c.w-10, y:c.y+21, 'font-family':MONO, 'font-size':10, 'font-weight':600, fill:k.c, 'text-anchor':'end' }, [count(c.id)+' · $'+sum(c.id).toFixed(2)+'/mo']));
    g.appendChild(el('text', { 'class':'col', x:c.x+c.w-10, y:c.y+c.h-9, 'font-family':MONO, 'font-size':12, fill:'#4E5A6B', 'text-anchor':'end' }, ['⤡']));
    return g;
  }

  function drawNode(n) {
    var g = el('g', { 'class':'node'+(state.mode==='card'?' card':'')+(n.ghost?' ghost':''), 'data-id':n.id, transform:'translate('+n.x+','+n.y+')' });
    if (state.mode === 'card') {
      if (n.stack) g.appendChild(el('rect', { x:-CARD_W/2+6, y:-CARD_H/2-6, width:CARD_W, height:CARD_H, rx:9, fill:'#111620', stroke:'#2A3341', opacity:.6 }));
      g.appendChild(el('rect', { 'class':'frame', x:-CARD_W/2, y:-CARD_H/2, width:CARD_W, height:CARD_H, rx:9, fill:'#111620', stroke:'#2A3341', 'stroke-width':1.2 }));
      if (n.warn) g.appendChild(el('line', { x1:-CARD_W/2+1.6, y1:-CARD_H/2+11, x2:-CARD_W/2+1.6, y2:CARD_H/2-11, stroke:'#F0B34E', 'stroke-width':3, 'stroke-linecap':'round' }));
      g.appendChild(el('use', { href:'#'+n.icon, x:-CARD_W/2+11, y:-22, width:44, height:44 }));
      var tx = -CARD_W/2+64;
      g.appendChild(el('text', { x:tx, y:-18, 'font-family':SANS, 'font-size':9, 'font-weight':600, fill:'#7C8CA0' }, [n.term]));
      g.appendChild(el('text', { x:tx, y:-3, 'font-family':SANS, 'font-size':12, 'font-weight':500, fill:'#E8ECF2' }, [n.name]));
      g.appendChild(el('text', { x:tx, y:11, 'font-family':MONO, 'font-size':9, fill:'#7C8CA0' }, [n.set]));
      g.appendChild(el('text', { 'class':'cost', x:CARD_W/2-10, y:28, 'font-family':MONO, 'font-size':11, 'font-weight':600, fill:'#E8ECF2', 'text-anchor':'end' }, [n.cost]));
      g.appendChild(gear(CARD_W/2-14, -CARD_H/2+14));
    } else {
      if (n.stack) g.appendChild(el('use', { href:'#'+n.icon, x:-ICON/2+6, y:-ICON/2-6, width:ICON, height:ICON, opacity:.4 }));
      g.appendChild(el('rect', { 'class':'ring'+(n.warn?' warn':''), x:-31, y:-31, width:62, height:62, rx:11 }));
      if (n.res) { g.appendChild(el('rect', { x:-ICON/2, y:-ICON/2, width:ICON, height:ICON, rx:7, fill:'#111620', stroke:n.res, 'stroke-width':1.5 }));
        g.appendChild(el('use', { href:'#'+n.icon, x:-20, y:-20, width:40, height:40 })); }
      else g.appendChild(el('use', { href:'#'+n.icon, x:-ICON/2, y:-ICON/2, width:ICON, height:ICON }));
      g.appendChild(gear(36, -21));
      g.appendChild(el('text', { y:ICON/2+17, 'font-family':SANS, 'font-size':11.5, 'font-weight':500, fill:'#E8ECF2', 'text-anchor':'middle' }, [n.name]));
      if (n.sec) g.appendChild(el('text', { 'class':'sec', y:ICON/2+30, 'font-family':MONO, 'font-size':9, fill:'#7C8CA0', 'text-anchor':'middle' }, [n.sec]));
      if (state.showCost) g.appendChild(el('text', { 'class':'cost', y:ICON/2+(n.sec?43:30), 'font-family':MONO, 'font-size':10.5, 'font-weight':600, fill:'#6FE3B0', 'text-anchor':'middle' }, [n.cost]));
    }
    return g;
  }

  function drawSection(s) {
    var g = el('g', { 'class':'sect', 'data-id':s.id });
    g.appendChild(el('rect', { x:s.x, y:s.y, width:s.w, height:s.h, rx:12, fill:s.color, 'fill-opacity':.05, stroke:s.color, 'stroke-width':1.4, 'stroke-dasharray':'2 5', 'stroke-linecap':'round' }));
    var w = s.name.length * 6.4 + 34;
    g.appendChild(el('rect', { x:s.x, y:s.y-23, width:w, height:20, rx:6, fill:s.color, 'fill-opacity':.16, stroke:s.color, 'stroke-width':1 }));
    g.appendChild(el('text', { x:s.x+10, y:s.y-9, 'font-family':SANS, 'font-size':10.5, 'font-weight':600, fill:s.color }, [s.name]));
    g.appendChild(el('text', { x:s.x+w-11, y:s.y-9, 'font-family':MONO, 'font-size':10, fill:s.color, 'text-anchor':'end', opacity:.7 }, ['⤡']));
    return g;
  }

  function build() {
    byC = {}; C.forEach(function (c) { byC[c.id] = c; });
    byN = {}; N.forEach(function (n) { byN[n.id] = n; });
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(el('defs', null, [el('marker', { id:'ah', viewBox:'0 0 10 10', refX:9, refY:5, markerWidth:6, markerHeight:6, orient:'auto-start-reverse' }, [el('path', { d:'M0,0 L10,5 L0,10 z', fill:'#5C6B7F' })])]));
    // containers, parents first
    var order = [], seen = {};
    (function walk(p) { C.forEach(function (c) { if (c.parent === p && !seen[c.id]) { seen[c.id] = 1; order.push(c); walk(c.id); } }); })(null);
    var cg = el('g', { 'class':'conts' });
    order.forEach(function (c) { if (!isHidden(c)) cg.appendChild(drawContainer(c)); });
    svg.appendChild(cg);
    // sections sit above containers, below nodes
    if (state.sections) { var sg = el('g', { 'class':'sects' }); S.forEach(function (s) { sg.appendChild(drawSection(s)); }); svg.appendChild(sg); }
    // edges
    var eg = el('g', { 'class':'edges' });
    E.forEach(function (e) {
      var p = path(e); if (!p) return;
      var g = el('g', { 'class':'edge', 'data-from':e.f, 'data-to':e.t, 'data-kind':e.k, fill:'none', stroke:'#5C6B7F' });
      var a = { d:p.d, 'stroke-width':e.w, 'stroke-linecap':'round' };
      if (e.k === 'async') { a['stroke-dasharray'] = '7 5'; a['marker-end'] = 'url(#ah)'; }
      else if (e.k === 'data') a['stroke-dasharray'] = '2 5';
      else a['marker-end'] = 'url(#ah)';
      g.appendChild(el('path', a));
      var ta = { 'font-family':SANS, 'font-size':9.5, fill:'#7C8CA0', stroke:'none', 'text-anchor':'middle' };
      if (p.rot) ta.transform = 'translate('+p.lx+','+p.ly+') rotate('+p.rot+')'; else { ta.x = p.lx; ta.y = p.ly; }
      g.appendChild(el('text', ta, [e.l]));
      eg.appendChild(g);
    });
    svg.appendChild(eg);
    var ng = el('g', { 'class':'nodes' });
    N.forEach(function (n) { if (!isHidden(n)) ng.appendChild(drawNode(n)); });
    svg.appendChild(ng);
    svg.classList.toggle('l-cost', state.showCost);
    svg.classList.toggle('l-sec', state.showSec);
    mark();
    wire();
    tree();
  }
  function mark() { svg.querySelectorAll('.node').forEach(function (n) { n.classList.toggle('sel', n.dataset.id === state.sel); }); }

  // ---- interaction ----
  function wire() {
    svg.querySelectorAll('.cont .col, .cont.cl .exp').forEach(function (t) {
      t.style.cursor = 'pointer';
      t.addEventListener('click', function (e) { e.stopPropagation(); var id = t.closest('.cont').dataset.id; state.collapsed[id] = !state.collapsed[id]; build(); });
    });
    svg.querySelectorAll('.node').forEach(function (g) {
      g.style.cursor = 'pointer';
      g.addEventListener('click', function () { state.sel = g.dataset.id; mark(); document.dispatchEvent(new CustomEvent('oh:sel', { detail:g.dataset.id })); });
      g.addEventListener('mouseenter', function () { if (svg.dataset.busy) return; svg.classList.add('hover'); g.classList.add('lit');
        svg.querySelectorAll('.edge').forEach(function (e) { if (e.dataset.from === g.dataset.id || e.dataset.to === g.dataset.id) { e.classList.add('lit');
          var o = svg.querySelector('.node[data-id="'+(e.dataset.from === g.dataset.id ? e.dataset.to : e.dataset.from)+'"]'); if (o) o.classList.add('lit'); } }); });
      g.addEventListener('mouseleave', clear);
      drag(g, byN[g.dataset.id]);
    });
    svg.querySelectorAll('.sect').forEach(function (g) { drag(g, S.filter(function (s) { return s.id === g.dataset.id; })[0]); g.style.cursor = 'grab'; });
  }
  function clear() { if (svg.dataset.busy) return; svg.classList.remove('hover'); svg.querySelectorAll('.lit').forEach(function (x) { x.classList.remove('lit'); }); }
  function drag(g, o) {
    if (!o) return;
    g.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return; var m = svg.getScreenCTM();
      svg._d = { o:o, sx:e.clientX, sy:e.clientY, ox:o.x, oy:o.y, k:1/m.a, moved:false };
      svg.setPointerCapture(e.pointerId); svg.dataset.busy = '1'; e.preventDefault(); e.stopPropagation();
    });
  }
  if (!svg._dw) { svg._dw = 1;
    svg.addEventListener('pointermove', function (e) { var d = svg._d; if (!d) return;
      var dx = (e.clientX - d.sx) * d.k, dy = (e.clientY - d.sy) * d.k;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return; d.moved = true;
      d.o.x = d.ox + dx; d.o.y = d.oy + dy; build(); });
    var end = function () { if (!svg._d) return; svg._d = null; delete svg.dataset.busy; clear(); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  }

  // ---- structure tree panel ----
  function tree() {
    var host = document.getElementById('tree'); if (!host) return;
    var h = '';
    function kidsOf(p) { return C.filter(function (c) { return c.parent === p; }); }
    function nodesIn(cid) { return N.filter(function (n) { return n.in === cid; }); }
    function row(depth, id, icon, colour, label, meta, kind) {
      var pad = 8 + depth * 13;
      return '<div class="tr'+(state.sel===id?' on':'')+'" data-id="'+id+'" data-kind="'+kind+'" style="padding-left:'+pad+'px">'
        + (icon ? '<svg class="ti"><use href="#'+icon+'"/></svg>' : '<span class="tdot" style="background:'+colour+'"></span>')
        + '<span class="tl">'+label+'</span>'
        + (meta ? '<span class="tm">'+meta+'</span>' : '')
        + (kind==='c' ? '<span class="tc">'+(state.collapsed[id]?'⤢':'⤡')+'</span>' : '') + '</div>';
    }
    function walk(p, d) {
      kidsOf(p).forEach(function (c) {
        var k = kindOf(c);
        h += row(d, c.id, k.icon, k.c, c.name, state.showCost ? '$'+sum(c.id).toFixed(0) : count(c.id)+'', 'c');
        if (!state.collapsed[c.id]) { walk(c.id, d + 1); nodesIn(c.id).forEach(function (n) { h += row(d + 1, n.id, n.icon, null, n.name, state.showCost ? n.cost : '', 'n'); }); }
      });
    }
    h += '<div class="th">Structure</div>'; walk(null, 0);
    h += '<div class="th" style="margin-top:8px">Sections <span class="add">+</span></div>';
    S.forEach(function (s) { h += '<div class="tr" data-id="'+s.id+'" data-kind="s" style="padding-left:8px"><span class="tdot" style="background:'+s.color+'"></span><span class="tl">'+s.name+'</span><span class="tc">⤡</span></div>'; });
    host.innerHTML = h;
    host.querySelectorAll('.tr').forEach(function (r) {
      r.addEventListener('click', function () {
        if (r.dataset.kind === 'n') { state.sel = r.dataset.id; mark(); tree(); document.dispatchEvent(new CustomEvent('oh:sel', { detail:r.dataset.id })); }
        else if (r.dataset.kind === 'c') { state.collapsed[r.dataset.id] = !state.collapsed[r.dataset.id]; build(); }
      });
    });
  }

  // ---- chrome wiring ----
  function apply() { var vp = svg.parentElement, base = vp.clientWidth || 1000; svg.style.width = Math.round(base * state.zoom) + 'px'; }
  function zoomTo(z) { state.zoom = Math.max(.5, Math.min(1.8, Math.round(z * 20) / 20));
    var r = document.getElementById('zoom'), v = document.getElementById('zoomv');
    if (r) r.value = Math.round(state.zoom * 100); if (v) v.textContent = Math.round(state.zoom * 100) + '%';
    var want = state.zoom >= 1.3 ? 'card' : 'icon'; if (want !== state.mode && !state.force) { state.mode = want; build(); } apply(); }
  window.OH = { build:build, state:state, zoomTo:zoomTo, apply:apply, tree:tree, N:N, C:C, S:S };
  build(); apply();
  window.addEventListener('resize', apply);
})();
