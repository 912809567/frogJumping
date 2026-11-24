module.exports = function outfits(T, tools) {
  const {Geo,mesh,merge,tube,gem}=tools,TAU=Math.PI*2;
  const shape=(points)=>{const s=new T.Shape();points.forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();return s;};
  const panel=(parent,points,material,position)=>mesh(parent,new Geo.Extrude(shape(points),{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1}),material,position);

  function robe(parent,material,top,bottom,height,y){
    const cloth=material.clone();cloth.side=T.DoubleSide;
    const geometry=new Geo.Cylinder(top,bottom,height,32,10,true),p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const worldY=p.getY(i)+y,bodyRadius=Math.sqrt(Math.max(0,1-Math.pow((worldY-.60)/.58,2)))*.56+.018;
      const radius=Math.hypot(p.getX(i),p.getZ(i)),factor=Math.max(1,bodyRadius/Math.max(radius,.001));
      p.setX(i,p.getX(i)*factor);p.setZ(i,p.getZ(i)*factor);
    }
    geometry.computeVertexNormals();
    return mesh(parent,geometry,cloth,[0,y,-.015],[1,1,.78]);
  }

  function smallCrown(parent,mats){
    const parts=[{geometry:new Geo.Torus(.30,.025,8,40),p:[0,2.02,-.025],r:[Math.PI/2,0,0],s:[1,.85,1]}];
    for(let i=0;i<3;i++)parts.push({geometry:new Geo.Cone(.067,i===1?.20:.14,6),p:[(i-1)*.20,2.10,-.025+Math.abs(i-1)*.035]});
    merge(parent,parts,mats.royalGold);
    gem(parent,[0,2.08,.25],.06,mats);
  }

  function hat(parent,material){
    mesh(parent,new Geo.Cylinder(.58,.62,.045,40),material,[0,2.07,-.03],[1,1,.86]);
    mesh(parent,new Geo.Cone(.40,.30,32),material,[0,2.23,-.05],[1,1,.86]);
    tube(parent,[[-.26,2.08,.31],[-.18,1.49,.42],[0,1.43,.44],[.18,1.49,.42],[.26,2.08,.31]],.009,material,32);
  }

  function cape(parent,material){
    const cloth=material.clone();cloth.side=T.DoubleSide;
    mesh(parent,new Geo.Cylinder(.47,.73,.80,32,1,true,Math.PI*.5,Math.PI),cloth,[0,.60,-.08],[1,1,.80]);
  }

  function bow(parent,material,y,z,size){
    mesh(parent,new Geo.Sphere(size,20,12),material,[-size*.8,y,z],[1.3,.65,.4], [0,0,-.3]);
    mesh(parent,new Geo.Sphere(size,20,12),material,[size*.8,y,z],[1.3,.65,.4],[0,0,.3]);
    mesh(parent,new Geo.Sphere(size*.48,16,12),material,[0,y,z+.035]);
  }

  function suit(parent,costume,mats,accent,dark){
    robe(parent,dark,.48,.54,.70,.57);
    mesh(parent,new Geo.Box(.30,.47,.035),mats.royalCream,[0,.71,.455]);
    [-1,1].forEach(side=>panel(parent,[[side*.04,0],[side*.29,.19],[side*.15,-.20]],accent,[0,.82,.482]));
    panel(parent,[[-.038,0],[.038,0],[.06,-.22],[0,-.30],[-.06,-.22]],mats.royalRuby,[0,.85,.52]);
    mesh(parent,new Geo.Box(.34,.27,.16),mats.royalLeather,[-.64,.45,.34]);
    mesh(parent,new Geo.Torus(.075,.017,8,20),mats.royalGold,[-.64,.63,.34],[1,.7,1]);
    if(costume==='bosslady')robe(parent,accent,.48,.62,.40,.29);
  }

  function armor(parent,mats,accent){
    const steel=mats.royalCream.clone();steel.color.copy(new T.Color(0xaabec5).convertSRGBToLinear());steel.metalness=.55;steel.roughness=.32;
    robe(parent,steel,.51,.52,.47,.67);
    [-1,1].forEach(side=>mesh(parent,new Geo.Sphere(.18,22,14),steel,[side*.48,.91,.06],[1.15,.6,1.2]));
    panel(parent,[[-.15,.15],[.15,.15],[.12,-.12],[0,-.20],[-.12,-.12]],accent,[0,.73,.48]);
    mesh(parent,new Geo.Sphere(.44,30,18,0,TAU,0,Math.PI*.45),steel,[0,1.96,-.05],[1.1,.65,.88]);
    const plume=[];for(let i=0;i<9;i++)plume.push({geometry:new Geo.Sphere(.055,10,8),p:[0,2.24+Math.sin(i/8*Math.PI)*.16,-.24+i*.065],s:[.7,1.5,1]});merge(parent,plume,accent);
    mesh(parent,new Geo.Cylinder(.025,.03,2.10,12),mats.royalLeather,[.83,1.18,.15]);
    mesh(parent,new Geo.Cone(.10,.29,4),steel,[.83,2.36,.15]);
    mesh(parent,new Geo.Sphere(.10,14,10),accent,[.83,2.13,.15],[.6,1.6,.6]);
    mesh(parent,new Geo.Torus(.49,.045,8,40),mats.royalGold,[0,.48,0],[1,.77,1],[Math.PI/2,0,0]);
  }

  function dress(parent,costume,mats,accent){
    const profile=[[.72,.13],[.77,.18],[.70,.31],[.58,.57],[.57,.75],[.51,.89]].map(p=>new T.Vector2(...p));
    mesh(parent,new Geo.Lathe(profile,48),accent,[0,0,-.03],[1,1,.84]);
    const trim=[];for(let i=0;i<24;i++){const a=i/24*TAU;trim.push({geometry:new Geo.Sphere(.078,12,8),p:[Math.sin(a)*.73,.17,Math.cos(a)*.61-.03],s:[1,.52,1]});}merge(parent,trim,mats.royalCream);
    [-1,1].forEach(side=>mesh(parent,new Geo.Sphere(.17,22,14),accent,[side*.47,.89,.04],[1.1,.85,1]));
    bow(parent,mats.royalCream,.70,.42,.11);
    if(costume==='princess')smallCrown(parent,mats);
    else bow(parent,accent,1.99,.03,.14);
  }

  function monk(parent,costume,mats,accent){
    robe(parent,accent,.47,.62,.88,.55);
    panel(parent,[[-.43,.16],[-.15,.22],[.43,-.43],[.20,-.50]],mats.royalCream,[0,.80,.48]);
    const beads=[];for(let i=0;i<28;i++){const a=i/28*TAU;beads.push({geometry:new Geo.Sphere(.039,10,8),p:[Math.sin(a)*.49,.94-Math.max(0,Math.cos(a))*.18,Math.cos(a)*.46]});}merge(parent,beads,mats.royalLeather);
    if(costume==='saint'){
      const petals=[];for(let i=0;i<7;i++){const a=i/7*TAU;petals.push({geometry:new Geo.Sphere(.09,14,10),p:[Math.sin(a)*.13,2.05,Math.cos(a)*.11],s:[.5,.3,1.2],r:[0,a,0]});}merge(parent,petals,mats.royalCream);
    }
  }

  function scholar(parent,costume,mats,accent,dark){
    robe(parent,accent,.47,.51,.55,.64);
    [-1,1].forEach(side=>mesh(parent,new Geo.Torus(.265,.014,8,40),dark,[side*.47,1.675,.595]));
    mesh(parent,new Geo.Box(.42,.018,.014),dark,[0,1.675,.60]);
    mesh(parent,new Geo.Box(.58,.035,.33),dark,[0,.68,.65]);
    mesh(parent,new Geo.Box(.58,.32,.025),dark,[0,.85,.54],null,[-.20,0,0]);
    mesh(parent,new Geo.Box(.49,.24,.008),mats.royalCream,[0,.86,.568],null,[-.20,0,0]);
    if(costume==='coder')bow(parent,accent,2.02,-.03,.10);
  }

  function wanderer(parent,costume,mats,accent,dark){
    hat(parent,accent);
    if(costume==='duke'){
      robe(parent,mats.royalCream,.48,.60,.78,.55);
      const fan=new T.Group();parent.add(fan);fan.position.set(-.60,.74,.50);fan.rotation.z=-.5;
      mesh(fan,new Geo.Circle(.27,24,0,Math.PI),mats.royalCream);
      const ribs=[];for(let i=0;i<9;i++){const a=i/8*Math.PI;ribs.push({geometry:new Geo.Cylinder(.006,.009,.25,6),p:[Math.cos(a)*.125,Math.sin(a)*.125,0],r:[0,0,a-Math.PI/2]});}merge(fan,ribs,mats.royalGold);
      return fan;
    }
    cape(parent,accent);robe(parent,dark,.47,.51,.55,.63);
    const sword=new T.Group();parent.add(sword);sword.position.set(-.64,.69,-.12);sword.rotation.z=-.30;
    mesh(sword,new Geo.Box(.07,1.12,.045),mats.royalCream,[0,0,0]);
    mesh(sword,new Geo.Box(.28,.045,.10),mats.royalGold,[0,.34,0]);
    mesh(sword,new Geo.Cylinder(.035,.035,.22,10),mats.royalLeather,[0,.46,0]);
  }

  function create(parent,route,mats,accent,dark){
    const costume=route.costume;parent.name='outfit-'+costume;
    if(['general','commander'].includes(costume))armor(parent,mats,accent);
    else if(['ceo','bosslady'].includes(costume))suit(parent,costume,mats,accent,dark);
    else if(['princess','sweetheart'].includes(costume))dress(parent,costume,mats,accent);
    else if(['monk','saint'].includes(costume))monk(parent,costume,mats,accent);
    else if(['it','coder'].includes(costume))scholar(parent,costume,mats,accent,dark);
    else if(['hero','swordswoman','duke'].includes(costume))return wanderer(parent,costume,mats,accent,dark);
    else if(costume==='prince'){
      robe(parent,mats.royalCream,.48,.55,.65,.61);cape(parent,accent);smallCrown(parent,mats);
      panel(parent,[[-.34,.22],[-.20,.28],[.34,-.22],[.20,-.28]],accent,[0,.72,.40]);gem(parent,[0,.82,.44],.065,mats);
    }else if(costume==='college'){
      robe(parent,accent,.50,.54,.60,.62);mesh(parent,new Geo.Torus(.30,.075,10,32),mats.royalCream,[0,.98,-.10],[1,.85,1],[Math.PI/2,0,0]);
      mesh(parent,new Geo.Sphere(.36,24,16),dark,[0,.65,-.36],[1,.95,.55]);
      [-1,1].forEach(side=>tube(parent,[[side*.28,.94,-.12],[side*.34,.75,.32],[side*.29,.44,.32]],.035,mats.royalCream,18));
      mesh(parent,new Geo.Box(.24,.16,.03),mats.royalCream,[0,.55,.415]);
    }else if(costume==='artist'){
      robe(parent,mats.royalCream,.46,.54,.60,.60);
      mesh(parent,new Geo.Sphere(.36,28,16),accent,[-.05,2.08,-.03],[1.25,.25,.95], [0,0,-.12]);
      mesh(parent,new Geo.Cylinder(.023,.023,.45,10),mats.royalLeather,[.67,.92,.42],null,[0,0,-.3]);
      mesh(parent,new Geo.Cone(.045,.12,12),accent,[.74,1.17,.42],null,[0,0,-.3]);
      mesh(parent,new Geo.Sphere(.21,24,16),mats.royalLeather,[-.56,.70,.45],[1.2,.65,.18]);
      [mats.royalRuby,mats.royalGold,mats.royalSkin].forEach((material,i)=>mesh(parent,new Geo.Sphere(.035,12,8),material,[-.68+i*.10,.73,.49],[1,1,.3]));
    }
  }
  return create;
};
