const headAsset = require('./models/royal-head');
const furAsset = require('./models/royal-fur');
const codec = require('./models/codec');

module.exports = function royal(T, helpers, options) {
  const { Geo, part, mergeParts, measure, addCostume } = helpers;
  const TAU = Math.PI * 2;
  const linear = hex => new T.Color(hex).convertSRGBToLinear();
  let sculpt;
  const templates = new Map();
  const references = new Map();
  const instances = new WeakMap();
  const furGeometries = new Map();
  const furUnits = new Map();
  const createOutfit = require('./outfits')(T, {Geo,mesh,merge,tube,gem});

  function retain(resources) {
    resources.forEach(resource => references.set(resource, (references.get(resource) || 0) + 1));
  }

  function releaseResource(resource) {
    const count = references.get(resource);
    if (!count) return false;
    if (count > 1) references.set(resource, count - 1);
    else { references.delete(resource); resource.dispose(); }
    return true;
  }

  function releaseObject(object) {
    const pooled = new Set();
    if (!object.traverse) return pooled;
    object.traverse(node => {
      const lease = instances.get(node);
      if (!lease) return;
      lease.resources.forEach(resource => {
        pooled.add(resource);
        if (!lease.released) releaseResource(resource);
      });
      lease.released = true;
    });
    return pooled;
  }

  function dispose() {
    templates.forEach(entry => entry.resources.forEach(releaseResource));
    templates.clear();
    furGeometries.clear();
    furUnits.forEach(geometry=>geometry.dispose());furUnits.clear();
    sculpt = null;
  }

  function instantiate(source) {
    const copies = new Map();
    const cloneNode = node => {
      const copy = node.isMesh ? new T.Mesh(node.geometry, node.material) : node.isGroup ? new T.Group() : new T.Object3D();
      copies.set(node, copy);
      copy.name = node.name;
      copy.rotation.order = node.rotation.order;
      copy.position.copy(node.position); copy.quaternion.copy(node.quaternion); copy.scale.copy(node.scale);
      copy.visible = node.visible; copy.castShadow = node.castShadow; copy.receiveShadow = node.receiveShadow;
      copy.frustumCulled = node.frustumCulled; copy.renderOrder = node.renderOrder; copy.layers.mask = node.layers.mask;
      node.children.forEach(child => copy.add(cloneNode(child)));
      return copy;
    };
    const root = cloneNode(source);
    // Object3D.clone JSON-serializes userData and breaks the animation anchors.
    const cloneData = value => {
      if (value && value.isObject3D) return copies.get(value);
      if (Array.isArray(value)) return value.map(cloneData);
      if (value && typeof value === 'object') {
        const copy = {}; Object.keys(value).forEach(key => { copy[key] = cloneData(value[key]); }); return copy;
      }
      return value;
    };
    copies.forEach((copy, node) => { copy.userData = cloneData(node.userData); });
    return root;
  }

  function makeFrog(route, scale, mats) {
    const key = mats.royalHead.uuid + ':' + route.costume + ':' + route.accent;
    let entry = templates.get(key);
    if (!entry) {
      const root = buildFrog(route, 1, mats), resources = new Set(), shared = new Set(Object.keys(mats).map(key => mats[key]));
      root.traverse(node => {
        if (node.geometry) resources.add(node.geometry);
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(material => { if (material && !shared.has(material)) resources.add(material); });
      });
      entry = { root, resources }; retain(resources);
    }
    templates.delete(key); templates.set(key, entry);
    const root = instantiate(entry.root), size = scale || 1;
    root.scale.setScalar(size); root.userData.baseScale = size; root.userData.route = route;
    retain(entry.resources);
    instances.set(root, { resources: entry.resources, released: false });
    // Keep only two costume templates; live instances retain their own references.
    if (templates.size > 2) {
      const oldest = templates.keys().next().value;
      templates.get(oldest).resources.forEach(releaseResource); templates.delete(oldest);
    }
    return root;
  }

  function texture(size, sample, color) {
    const pixels = new Uint8Array(size * size * 4);
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
      const value=sample(x/size,y/size,x,y),i=(y*size+x)*4;
      const rgb=Array.isArray(value)?value:[value,value,value];
      pixels[i]=rgb[0];pixels[i+1]=rgb[1];pixels[i+2]=rgb[2];pixels[i+3]=255;
    }
    const map=new T.DataTexture(pixels,size,size,T.RGBAFormat);
    map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;
    map.generateMipmaps=true;if(color)map.encoding=T.sRGBEncoding;map.needsUpdate=true;return map;
  }

  function materials() {
    const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
    const pores=texture(128,(u,v,x,y)=>125+noise(x,y)*30);
    pores.repeat.set(20,20);
    const velvet=texture(128,(u,v,x,y)=>115+noise(x,y)*25+Math.sin(x*TAU/4)*6+Math.sin(y*TAU/4)*6);
    velvet.repeat.set(5,5);
    const iris=texture(256,(u,v)=>{
      const x=(u-.5)*2,y=(v-.5)*2,r=Math.hypot(x,y),a=Math.atan2(y,x);
      const fibers=.76+.07*Math.sin(a*93+r*27)+.04*Math.sin(a*147-r*31);
      const green=(1-Math.min(1,Math.max(0,(r-.90)/.1)))*fibers;
      const pupil=1-Math.min(1,Math.max(0,(Math.hypot(x,y-.15)-.73)/.065));
      const bottom=.65+Math.max(0,-y)*.35;
      return [20+60*green*bottom,40+143*green*bottom,5+12*green].map((n,i)=>n*(1-pupil)+[8,12,6][i]*pupil);
    },true);
    const physical=(hex,roughness,extra)=>new T.MeshPhysicalMaterial(Object.assign({color:linear(hex),roughness,
      metalness:0,vertexColors:true},extra||{}));
    const body=physical(0x9dcb35,.63,{bumpMap:pores,bumpScale:.0025,clearcoat:.04,clearcoatRoughness:.4});
    body.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 toyPoint;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntoyPoint = position;');
      shader.fragmentShader='varying vec3 toyPoint;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\nfloat ellipse=length(vec2(toyPoint.x/.83,(toyPoint.y+.02)/.90));\nfloat bib=(1.0-smoothstep(.85,1.02,ellipse))*smoothstep(.05,.42,toyPoint.z);\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.68,.51,.29),bib);');
    };
    return {
      royalHead:physical(0xffffff,.63,{bumpMap:pores,bumpScale:.002,clearcoat:.04,clearcoatRoughness:.35}),
      royalSkin:physical(0x9dcb35,.63,{bumpMap:pores,bumpScale:.0025,clearcoat:.04}),
      royalBody:body,
      royalCream:physical(0xf8e4c2,.78,{bumpMap:velvet,bumpScale:.002}),
      royalVelvet:physical(0x8f0a23,.82,{bumpMap:velvet,bumpScale:.003,side:T.DoubleSide}),
      royalFur:physical(0xe6c8a7,.98,{bumpMap:velvet,bumpScale:.004}),
      royalFurSpot:physical(0x8b5a49,.96),
      royalGold:physical(0xffbd32,.23,{metalness:.86,clearcoat:.32,clearcoatRoughness:.15}),
      royalRuby:physical(0xc40732,.17,{metalness:.18,clearcoat:1,vertexColors:true}),
      royalMouth:physical(0x5b1715,.75,{vertexColors:false}),
      royalTongue:physical(0xf37b86,.5,{bumpMap:pores,bumpScale:.001,vertexColors:false}),
      royalEyeWhite:physical(0xfff0d9,.26,{clearcoat:.75,vertexColors:false}),
      royalIris:physical(0xffffff,.055,{map:iris,clearcoat:1,clearcoatRoughness:.03,vertexColors:false}),
      royalEyeRim:physical(0x4c2c20,.4),
      royalCatchlight:new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),
      royalLeather:physical(0x62402b,.72,{bumpMap:velvet,bumpScale:.005}),
      royalEmbroidery:physical(0xefb537,.45,{metalness:.32})
    };
  }

  function decode(text) {
    return codec.decode(text,headAsset.compressed);
  }

  function headGeometry() {
    if(!sculpt){
      const raw=decode(headAsset.positions),normalRaw=decode(headAsset.normals),colors=decode(headAsset.colors),indexRaw=decode(headAsset.indices);
      const posView=new DataView(raw.buffer),positions=new Float32Array(headAsset.vertexCount*3),normals=new Float32Array(positions.length),rgb=new Float32Array(positions.length),uv=new Float32Array(headAsset.vertexCount*2);
      for(let i=0;i<positions.length;i++){
        positions[i]=posView.getInt16(i*2,true)*headAsset.scale;
        normals[i]=(normalRaw[i]>127?normalRaw[i]-256:normalRaw[i])/127;rgb[i]=colors[i]/255;
      }
      for(let i=0;i<headAsset.vertexCount;i++){uv[i*2]=(positions[i*3]+1)/2;uv[i*2+1]=(positions[i*3+1]-.72)/1.43;}
      const index=new Uint16Array(indexRaw.length/2),view=new DataView(indexRaw.buffer);
      for(let i=0;i<index.length;i++)index[i]=view.getUint16(i*2,true);
      sculpt=new T.BufferGeometry();
      const set=(key,array,size)=>(sculpt.setAttribute||sculpt.addAttribute).call(sculpt,key,new T.Float32BufferAttribute(array,size));
      set('position',positions,3);set('normal',normals,3);set('color',rgb,3);set('uv',uv,2);
      sculpt.setIndex(new T.BufferAttribute(index,1));sculpt.addGroup(0,headAsset.skinCount,0);sculpt.addGroup(headAsset.skinCount,headAsset.mouthCount,1);
      sculpt.computeBoundingSphere();sculpt.computeBoundingBox();
    }
    return sculpt;
  }

  function mesh(parent,geometry,material,position,scale,rotation) {
    return part(parent,geometry,material,{p:position,s:scale,r:rotation,low:.93,high:1});
  }
  function merge(parent,parts,material,shade,keepSources) {
    const geometry=mergeParts(parts,shade||((x,y)=>.91+Math.min(.09,Math.max(0,y)*.04)));
    const p=geometry.attributes.position,uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)*.7+p.getZ(i)*.3;uv[i*2+1]=p.getY(i)*.8;}
    (geometry.setAttribute||geometry.addAttribute).call(geometry,'uv',new T.Float32BufferAttribute(uv,2));
    if(!keepSources)parts.forEach(item=>item.geometry.dispose());
    const result=new T.Mesh(geometry,material);result.castShadow=true;result.receiveShadow=true;parent.add(result);return result;
  }
  function tube(parent,points,radius,material,steps) {
    const curve=points instanceof T.Curve?points:new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    return mesh(parent,new Geo.Tube(curve,steps||40,radius,8,false),material);
  }

  function lensGeometry(radius) {
    const positions=[0,0,.085],uv=[.5,.5],indices=[],segments=48,rings=16;
    for(let row=1;row<=rings;row++)for(let j=0;j<=segments;j++){
      const r=row/rings,a=j/segments*TAU;
      positions.push(Math.cos(a)*radius*r,Math.sin(a)*radius*r,.085*Math.sqrt(Math.max(0,1-r*r)));
      uv.push(.5+Math.cos(a)*r*.5,.5+Math.sin(a)*r*.5);
      if(row===1&&j<segments)indices.push(0,1+j,2+j);
      if(row<rings&&j<segments){const n=1+(row-1)*(segments+1)+j;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}
    }
    const g=new T.BufferGeometry();(g.setAttribute||g.addAttribute).call(g,'position',new T.Float32BufferAttribute(positions,3));
    (g.setAttribute||g.addAttribute).call(g,'uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }

  function eyes(root,mats) {
    const eyes=[],lids=[];
    [-1,1].forEach(side=>{
      const eye=new T.Group();eye.position.set(side*.47,1.685,.305);eye.rotation.z=-side*.075;root.add(eye);
      const hood=[];for(let i=0;i<=64;i++){const a=i/64*TAU;hood.push([Math.cos(a)*.309,Math.sin(a)*.339,.14]);}
      tube(eye,hood,.055,mats.royalSkin,64);
      mesh(eye,new Geo.Sphere(.276,40,28),mats.royalEyeWhite,[0,0,0],[1,1.115,.71]);
      const rim=[];
      for(let i=0;i<=64;i++){const a=i/64*TAU;rim.push([Math.cos(a)*.270,Math.sin(a)*.302,.19]);}
      tube(eye,rim,.012,mats.royalEyeRim,64);
      const iris=new T.Mesh(lensGeometry(.235),mats.royalIris);iris.position.set(.006,-.009,.184);eye.add(iris);
      mesh(eye,new Geo.Sphere(.062,20,14),mats.royalCatchlight,[-.071,.105,.264],[1.08,.88,.16]);
      mesh(eye,new Geo.Sphere(.022,12,10),mats.royalCatchlight,[-.135,.02,.253],[1,1,.16]);
      mesh(eye,new Geo.Sphere(.013,10,8),mats.royalCatchlight,[.115,.045,.258],[1,1,.18]);
      const lid=new T.Group();lid.position.copy(eye.position);root.add(lid);
      mesh(lid,new Geo.Sphere(.301,30,16,0,TAU,0,Math.PI*.22),mats.royalSkin,null,[1,1.05,.78]);
      lid.rotation.x=-.22;eyes.push(eye);lids.push(lid);
    });
    root.userData.eyes=eyes;root.userData.eyelids=lids;
  }

  function gem(parent,position,size,mats,rotation) {
    const group=new T.Group();group.position.set(...position);if(rotation)group.rotation.z=rotation;parent.add(group);
    const diamond=(width,height)=>{const shape=new T.Shape();shape.moveTo(0,height);shape.lineTo(width,0);shape.lineTo(0,-height);shape.lineTo(-width,0);shape.closePath();return shape;};
    mesh(group,new Geo.Extrude(diamond(size*.72,size),{depth:size*.2,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:size*.09,bevelThickness:size*.06}),mats.royalGold);
    const vertices=[[0,size*.81,size*.35],[size*.56,0,size*.35],[0,-size*.81,size*.35],[-size*.56,0,size*.35],
      [0,size*.47,size*.68],[size*.29,0,size*.68],[0,-size*.47,size*.68],[-size*.29,0,size*.68]];
    const triangles=[[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
    const positions=[],colors=[],palette=[0xea1846,0xf54f71,0x8f0826,0xbb0a34,0xff7c92];
    triangles.forEach((face,i)=>{const color=linear(palette[i%palette.length]);face.slice().reverse().forEach(n=>{positions.push(...vertices[n]);colors.push(color.r,color.g,color.b);});});
    const geometry=new T.BufferGeometry();(geometry.setAttribute||geometry.addAttribute).call(geometry,'position',new T.Float32BufferAttribute(positions,3));
    (geometry.setAttribute||geometry.addAttribute).call(geometry,'color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
    const ruby=new T.Mesh(geometry,mats.royalRuby);group.add(ruby);return group;
  }

  function crown(root,mats) {
    const group=new T.Group();group.position.set(0,1.94,-.035);root.add(group);
    mesh(group,new Geo.Sphere(1,32,20),mats.royalVelvet,[0,.15,-.05],[.43,.24,.32]);
    const positions=[],uv=[],indices=[],steps=120;
    const peak=a=>.15+.36*Math.pow((1+Math.cos(a*5))/2,.85);
    for(let row=0;row<2;row++)for(let i=0;i<=steps;i++){
      const a=i/steps*TAU,r=row?.465:.44;
      positions.push(Math.sin(a)*r,row?peak(a):0,Math.cos(a)*r*.79);uv.push(i/steps,row);
      if(!row&&i<steps){const n=i;indices.push(n,n+1,n+steps+1,n+1,n+steps+2,n+steps+1);}
    }
    const shell=new T.BufferGeometry();(shell.setAttribute||shell.addAttribute).call(shell,'position',new T.Float32BufferAttribute(positions,3));
    (shell.setAttribute||shell.addAttribute).call(shell,'uv',new T.Float32BufferAttribute(uv,2));shell.setIndex(indices);shell.computeVertexNormals();
    const gold=mats.royalGold.clone();gold.side=T.DoubleSide;mesh(group,shell,gold);
    const edge=[];for(let i=0;i<=150;i++){const a=i/150*TAU;edge.push([Math.sin(a)*.465,peak(a),Math.cos(a)*.465*.79]);}
    tube(group,edge,.018,mats.royalGold,150);
    mesh(group,new Geo.Torus(.444,.025,10,80),mats.royalGold,[0,.012,0],[1,.79,1],[Math.PI/2,0,0]);
    for(let i=0;i<5;i++){const a=i/5*TAU;mesh(group,new Geo.Sphere(.087,24,18),mats.royalGold,[Math.sin(a)*.465,.535,Math.cos(a)*.465*.79]);}
    gem(group,[0,.205,.372],.115,mats,.10);
    group.name='jeweled-crown';return group;
  }

  function fur(parent,points,radius,mats,marks,key) {
    if (!(options && options.buildAssets) && furAsset.recipes && furAsset.recipes[key+'-tufts']) {
      let result;
      ['base','tufts','spots'].forEach(part=>{
        const name=key+'-'+part,asset=part==='base'?furAsset.meshes[name]:furAsset.recipes[name];if(!asset)return;
        if(!furGeometries.has(name)){
          if(part==='base')furGeometries.set(name,codec.geometry(T,asset));
          else{
            const parts=asset.parts.map(item=>{
              if(!furUnits.has(item.unit))furUnits.set(item.unit,codec.geometry(T,furAsset.units[item.unit]));
              return {geometry:furUnits.get(item.unit),p:item.p,s:item.s,r:item.r};
            });
            const temporary=new T.Group(),mesh=merge(temporary,parts,mats[asset.material],null,true);
            furGeometries.set(name,mesh.geometry);
          }
        }
        result=new T.Mesh(furGeometries.get(name),mats[asset.material]);result.name=name;result.receiveShadow=part!=='base';parent.add(result);
      });
      return result;
    }
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),parts=[],dark=[];
    const count=Math.ceil(curve.getLength()/(radius*.48));
    const base=tube(parent,curve,radius*.90,mats.royalFur,Math.max(48,count));base.castShadow=false;base.name=key+'-base';
    for(let i=0;i<=count;i++){
      const t=i/count,p=curve.getPointAt(t),jitter=Math.sin(i*2.399)*.01;
      parts.push({geometry:new Geo.Sphere(radius,10,8),p:p.toArray(),s:[1.03+Math.sin(i*1.9)*.08,.86,1.1],r:[i*.4,i*.6,jitter]});
      for(let j=0;j<2;j++){
        const a=(i*2.399+j*2.1)%TAU;
        parts.push({geometry:new Geo.Sphere(radius*.18,8,6),p:[p.x+Math.cos(a)*radius*.8,p.y+Math.sin(a)*radius*.75,p.z+radius*.55],s:[.6,1.8,.7],r:[0,0,a]});
      }
      if(marks&&i%14===7)dark.push({geometry:new Geo.Sphere(radius*.23,8,6),p:[p.x,p.y+radius*.18,p.z+radius*.92],s:[1,.8,.25]});
    }
    const recipe=parts=>parts.map(item=>({unit:item.geometry.parameters.widthSegments===10?'tuft':'small',
      p:item.p||[0,0,0],r:item.r||[0,0,0],s:(item.s||[1,1,1]).map(n=>n*item.geometry.parameters.radius)}));
    const tuftRecipe=options&&options.buildAssets?recipe(parts):null,spotRecipe=options&&options.buildAssets?recipe(dark):null;
    const result=merge(parent,parts,mats.royalFur);result.castShadow=false;result.name=key+'-tufts';
    if(tuftRecipe)result.userData.recipe=tuftRecipe;
    if(dark.length){const spots=merge(parent,dark,mats.royalFurSpot);spots.castShadow=false;spots.name=key+'-spots';if(spotRecipe)spots.userData.recipe=spotRecipe;}
    return result;
  }

  function cape(root,mats) {
    const positions=[],uv=[],indices=[],rows=28,columns=80;
    const surface=(u,v)=>{
      const angle=.70+u*(TAU-1.40),radius=.57+v*.49;
      const fold=Math.sin(angle*9+v*.7)*.035*Math.sin(v*Math.PI*.7);
      return [Math.sin(angle)*(radius+fold),1.005-v*.88,Math.cos(angle)*(radius*.65+fold)-.07];
    };
    for(let r=0;r<=rows;r++)for(let c=0;c<=columns;c++){
      positions.push(...surface(c/columns,r/rows));uv.push(c/columns,r/rows);
      if(r<rows&&c<columns){const n=r*(columns+1)+c;indices.push(n,n+columns+1,n+1,n+1,n+columns+1,n+columns+2);}
    }
    const g=new T.BufferGeometry();(g.setAttribute||g.addAttribute).call(g,'position',new T.Float32BufferAttribute(positions,3));
    (g.setAttribute||g.addAttribute).call(g,'uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const cloth=mesh(root,g,mats.royalVelvet);cloth.name='velvet-cape';
    const border=[];for(let i=0;i<=30;i++)border.push(surface(0,i/30));
    for(let i=1;i<=80;i++)border.push(surface(i/80,1));for(let i=29;i>=0;i--)border.push(surface(1,i/30));
    fur(root,border,.065,mats,true,'fur-border');
    fur(root,[[-.60,.91,.28],[-.37,.83,.41],[0,.82,.46],[.37,.83,.41],[.60,.91,.28]],.09,mats,true,'fur-collar');
    for(const side of[-1,1]){
      tube(root,[[side*.53,.87,.43],[side*.34,.77,.48],[side*.17,.81,.52]],.025,mats.royalGold);
      const pattern=new T.Shape();pattern.moveTo(0,0);pattern.bezierCurveTo(-.07,.03,-.08,.12,-.03,.14);pattern.quadraticCurveTo(0,.12,0,.05);
      pattern.bezierCurveTo(.02,.12,.07,.17,.09,.12);pattern.quadraticCurveTo(.12,.05,.04,.03);pattern.lineTo(.04,0);pattern.closePath();
      const emblem=mesh(root,new Geo.Extrude(pattern,{depth:.006,bevelEnabled:false,steps:1}),mats.royalEmbroidery,[side*.76,.28,.43],[side,1,1]);
      emblem.rotation.y=side*.55;
    }
    gem(root,[0,.81,.53],.115,mats,-.08);
  }

  function belt(root,mats) {
    const curve=[];for(let i=0;i<=80;i++){const a=i/80*TAU;curve.push([Math.sin(a)*.515,.54,Math.cos(a)*.375]);}
    tube(root,curve,.063,mats.royalLeather,80);
    const shape=new T.Shape(),w=.125,h=.09,r=.035;
    shape.moveTo(-w+r,-h);shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);
    shape.lineTo(-w+r,h);shape.quadraticCurveTo(-w,h,-w,h-r);shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
    const hole=new T.Path();hole.moveTo(-.082,-.055);hole.lineTo(-.082,.055);hole.lineTo(.082,.055);hole.lineTo(.082,-.055);hole.closePath();shape.holes.push(hole);
    mesh(root,new Geo.Extrude(shape,{depth:.025,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:3,steps:1}),mats.royalGold,[0,.54,.392]);
    const crownMark=new T.Shape();crownMark.moveTo(-.055,-.03);crownMark.lineTo(-.07,.033);crownMark.lineTo(-.025,.01);crownMark.lineTo(0,.055);crownMark.lineTo(.025,.01);crownMark.lineTo(.07,.033);crownMark.lineTo(.055,-.03);crownMark.closePath();
    mesh(root,new Geo.Extrude(crownMark,{depth:.008,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:2,steps:1}),mats.royalGold,[0,.54,.427]);
    for(const side of[-1,1])mesh(root,new Geo.Box(.045,.12,.04),mats.royalGold,[side*.28,.54,.33]);
  }

  function arm(root,side,mats,costume) {
    const group=new T.Group(),origin=[side*.43,.88,.015];group.position.set(...origin);root.add(group);
    const folded=['monk','saint'].includes(costume),laptop=['it','coder'].includes(costume);
    const hand=folded?[side*.14,.75,.53]:laptop?[side*.29,.70,.68]:['king','queen','empress'].includes(costume)?(side>0?[.65,.69,.42]:[-.41,.67,.39]):[side*.53,.70,.40];
    const local=p=>p.map((n,i)=>n-origin[i]);
    const parts=[{geometry:new Geo.Sphere(.14,20,14),p:local(hand),s:[1.05,1.0,.85]}];
    const points=[local([side*.43,.87,.02]),local([side*.53,.72,.16]),local(hand)];
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    parts.push({geometry:new Geo.Tube(curve,20,.085,10,false)});
    for(let i=0;i<3;i++)parts.push({geometry:new Geo.Sphere(.061,14,10),p:local([hand[0]+(i-1)*.068,hand[1]-.033,hand[2]+.076]),s:[1,1.15,.8]});
    merge(group,parts,mats.royalSkin);return group;
  }

  function foot(root,side,mats) {
    const group=new T.Group();group.position.set(side*.28,.13,.015);root.add(group);
    const parts=[{geometry:new Geo.Sphere(.21,24,16),p:[0,0,0],s:[1.05,.65,1.18]}];
    for(let i=0;i<3;i++)parts.push({geometry:new Geo.Sphere(.091,16,12),p:[(i-1)*.106,-.015,.16+(i===1?.025:0)],s:[1,.85,1.05]});
    merge(group,parts,mats.royalSkin);return group;
  }

  function scepter(parent,mats) {
    const from=new T.Vector3(.46,.24,.43),to=new T.Vector3(.91,1.45,.49),direction=to.clone().sub(from),group=new T.Group();parent.add(group);
    const shaft=mesh(group,new Geo.Cylinder(.044,.057,direction.length(),20),mats.royalLeather);
    shaft.position.copy(from).add(to).multiplyScalar(.5);shaft.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());
    const orb=new T.Group();orb.position.copy(to);orb.rotation.z=-.35;group.add(orb);
    mesh(orb,new Geo.Sphere(.142,32,24),mats.royalVelvet,[0,0,0],[1,1.05,1]);
    mesh(orb,new Geo.Torus(.145,.019,8,48),mats.royalGold,[0,0,0],null,[Math.PI/2,0,0]);
    for(const rotation of[0,Math.PI/2])mesh(orb,new Geo.Torus(.145,.019,8,48),mats.royalGold,[0,0,0],null,[0,rotation,0]);
    mesh(orb,new Geo.Box(.045,.14,.04),mats.royalGold,[0,.205,0]);mesh(orb,new Geo.Box(.12,.045,.04),mats.royalGold,[0,.22,0]);
    for(const y of[-.14,-.19])mesh(orb,new Geo.Torus(.083,.018,8,36),mats.royalGold,[0,y,0],null,[Math.PI/2,0,0]);
    gem(orb,[0,-.12,.105],.06,mats);
    mesh(group,new Geo.Sphere(.066,20,14),mats.royalGold,from.toArray(),[1,1.35,1]);
    group.name='royal-scepter';return group;
  }

  function buildFrog(route,scale,mats) {
    const root=new T.Group(),s=scale||1;root.scale.setScalar(s);root.userData.baseScale=s;root.userData.route=route;root.userData.style='royal-plush';
    const body=mesh(root,new Geo.Sphere(1,40,32),mats.royalBody,[0,.60,-.015],[.56,.58,.39]);body.name='body';
    const head=new T.Mesh(headGeometry(),[mats.royalHead,mats.royalMouth]);head.castShadow=true;head.receiveShadow=true;head.name='head';root.add(head);
    root.userData.head=head;
    const lipCurve=new T.CatmullRomCurve3(headAsset.lip.map(p=>new T.Vector3(...p)),true);
    const lipGeometry=new Geo.Tube(lipCurve,128,.016,10,true),p=lipGeometry.attributes.position,colors=new Float32Array(p.count*3);
    const green=linear(0x94c631),cream=linear(0xf2d5a6);
    for(let i=0;i<p.count;i++){const k=Math.max(0,Math.min(1,(1.24-p.getY(i))/.18)),color=green.clone().lerp(cream,k);colors.set([color.r,color.g,color.b],i*3);}
    (lipGeometry.setAttribute||lipGeometry.addAttribute).call(lipGeometry,'color',new T.Float32BufferAttribute(colors,3));
    const lip=new T.Mesh(lipGeometry,mats.royalHead);root.add(lip);
    eyes(root,mats);
    root.userData.innerTongue=mesh(root,new Geo.Sphere(.185,32,20),mats.royalTongue,[0,1.04,.36],[1,.54,.53]);
    root.userData.frontLegs=[-1,1].map(side=>arm(root,side,mats,route.costume));root.userData.hindLegs=[-1,1].map(side=>foot(root,side,mats));
    const wardrobe=new T.Group();root.add(wardrobe);root.userData.costume=wardrobe;
    if(['king','queen','empress'].indexOf(route.costume)>=0){
      cape(wardrobe,mats);crown(wardrobe,mats);belt(wardrobe,mats);
      if(route.costume!=='king'){
        const velvet=mats.royalVelvet.clone();velvet.color.copy(linear(route.costume==='queen'?0x9c174a:0x473174));
        wardrobe.traverse(child=>{if(child.isMesh&&child.material===mats.royalVelvet)child.material=velvet;});
      }
      const staffAnchor=new T.Group();staffAnchor.position.copy(root.userData.frontLegs[1].position).multiplyScalar(-1);root.userData.frontLegs[1].add(staffAnchor);scepter(staffAnchor,mats);
    }else{
      const accent=new T.MeshStandardMaterial({color:linear(route.accent),roughness:.72,vertexColors:true});
      const dark=new T.MeshStandardMaterial({color:linear(0x27351f),roughness:.7,vertexColors:true});
      root.userData.gesture=createOutfit(wardrobe,route,mats,accent,dark)||null;
    }
    const anchor=new T.Object3D();anchor.position.set(0,1.13,.515);root.add(anchor);root.userData.mouthAnchor=anchor;
    return measure(root,s);
  }

  return {materials,makeFrog,releaseObject,dispose};
};
