let CANNON;
// 小游戏里 Cannon.js 位于 physics 分包，由 page.physicsEngine() 提供；小程序页面与 Node 检查直接 require。
const physics = page => CANNON || (CANNON = page.physicsEngine ? page.physicsEngine() : require('cannon'));

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const ease = t => t * t * (3 - 2 * t);
const MODES = ['boat', 'plane', 'sling'];

class ReturnJourney {
  constructor(page) {
    this.page = page;
    this.T = page.THREE;
    this.Geo = page.geo;
    this.active = false;
  }

  material(color, roughness) {
    const key = color + ':' + roughness;
    if (!this.materials[key]) this.materials[key] = new this.T.MeshStandardMaterial({ color:new this.T.Color(color).convertSRGBToLinear(), roughness: roughness === undefined ? .65 : roughness });
    return this.materials[key];
  }

  mesh(geometry, material, position, scale, parent) {
    const mesh = new this.T.Mesh(geometry, material);
    if (position) mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true;
    (parent || this.stage).add(mesh);
    return mesh;
  }

  rod(parent, from, to, radius, material) {
    const T = this.T, a = new T.Vector3(...from), b = new T.Vector3(...to), delta = b.clone().sub(a);
    const mesh = this.mesh(new this.Geo.Cylinder(radius, radius * 1.2, delta.length(), 12), material, null, null, parent);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }

  setup(mode) {
    this.dispose();
    this.active = true; this.mode = mode; this.materials = {};
    this.startedAt = Date.now(); this.blur = 0; this.elapsed = 0;
    this.physicsElapsed=0;this.impactAt=null;this.fortressHit=false;
    this.stage = new this.T.Group(); this.page.scene.add(this.stage);
    this.page.pondGroup.visible = false;
    this.page.setData({ returnMode: mode, returnProgress: 0, returnOutcome: '', returnResultReady: false,
      slingPower: 0, slingReady: false, fortressDamage: 0, transition: false, gameOver: false });
    const water = new this.T.MeshPhysicalMaterial({ color: new this.T.Color(0x376f58).convertSRGBToLinear(), roughness: .09, metalness: .1,
      clearcoat: 1, envMap: this.page.materials.water.envMap || null });
    const plane = this.mesh(new this.Geo.Plane(90, 90, 32, 32), water, [0, -.18, -5]);
    plane.rotation.x = -Math.PI / 2;
    this.water = plane;
    this.page.scene.fog.color.setHex(0xc5dae0);
    this.page.scene.fog.near = 28; this.page.scene.fog.far = 85;
    for (let i = 0; i < 9; i++) {
      const flower = this.page.art.makeLotusCluster(this.page.materials, .6 + i % 3 * .18);
      flower.position.set((i % 2 ? 1 : -1) * (3.8 + i * .28), -.08, -8 + i * 2.3);
      this.stage.add(flower);
    }
  }

  frog(scale) {
    const frog = this.page.art.makeFrog(this.page.getSelectedRoute() || this.page.getRouteById('king'), scale, this.page.materials);
    this.stage.add(frog); return frog;
  }

  pointCamera(position, target) {
    this.page.camera.position.set(...position);
    this.page.camera.lookAt(new this.T.Vector3(...target)); this.page.camera.updateMatrixWorld(true);
  }

  frameResult(objects, direction) {
    const T=this.T,box=new T.Box3();
    this.stage.updateMatrixWorld(true);
    objects.forEach(object=>box.union(new T.Box3().setFromObject(object)));
    const center=box.getCenter(new T.Vector3()),view=new T.Vector3(...direction).normalize();
    const right=new T.Vector3(0,1,0).cross(view).normalize(),up=view.clone().cross(right);
    const tanV=Math.tan(this.page.camera.fov*Math.PI/360),tanH=tanV*this.page.camera.aspect;
    let distance=3;
    // Fit all eight corners, including the final enlarged pose, in both axes.
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const corner=new T.Vector3(x,y,z).sub(center),depth=corner.dot(view);
      distance=Math.max(distance,depth+Math.abs(corner.dot(right))/(tanH*.86),depth+Math.abs(corner.dot(up))/(tanV*.72));
    }
    this.pointCamera(view.multiplyScalar(distance).add(center).toArray(),center.toArray());
  }

  showChoice() {
    this.setup('choice');
    this.page.setData({ phase: 'returnChoice', chapter: '满载而归', returnTitle: '今天，怎么回家？' });
    const leaf = this.page.art.makeLeaf(this.page.materials, 1.3);
    leaf.position.set(0, .02, .5); this.stage.add(leaf);
    this.hero = this.frog(1.0); this.hero.position.set(0, .08, .5);
    this.vehicle = this.makeBoat(); this.vehicle.position.set(-1.8, .03, -2.5); this.vehicle.scale.setScalar(.48);
    this.previewPlane = this.makePlane(); this.previewPlane.position.set(1.4, 1.8, -3.2); this.previewPlane.scale.setScalar(.38);
    this.previewFork = this.makeFork(); this.previewFork.position.set(1.25, -.02, 1.8); this.previewFork.scale.setScalar(.55);
    const distance = Math.max(9.5, 4.9 / this.page.camera.aspect);
    this.pointCamera([distance*.18, distance*.40, distance*.88], [0, .7, .2]);
  }

  makeBoat() {
    const T = this.T, group = new T.Group(); this.stage.add(group);
    const wood = this.material(0x6b482b, .86); wood.side = T.DoubleSide;
    const hull = this.mesh(new this.Geo.Sphere(1, 36, 20, 0, Math.PI*2, Math.PI/2, Math.PI/2), wood,
      [0,.30,0], [.70,.42,1.65], group);
    const rim = this.mesh(new this.Geo.Torus(1,.045,8,60), this.material(0xb58b53,.75), [0,.30,0], [.70,1.65,1],group);
    rim.rotation.x = Math.PI/2;
    [-.65,.6].forEach(z => this.mesh(new this.Geo.Box(1.14,.07,.26), this.material(0x9a7448,.8), [0,.17,z], null, group));
    const oars=[];
    [-1,1].forEach(side=>{
      const pivot=new T.Group();pivot.position.set(side*.62,.30,.20);group.add(pivot);
      this.rod(pivot,[0,0,0],[side*.9,-.33,.55],.028,this.material(0x785536,.8));
      this.mesh(new this.Geo.Box(.15,.045,.46),this.material(0xb5915d,.8),[side*.9,-.33,.62],null,pivot);
      oars.push(pivot);
    });
    group.userData.oars=oars;group.userData.hull=hull;return group;
  }

  makePlane() {
    const T=this.T, group=new T.Group();this.stage.add(group);
    const paint=this.material(0xb64231,.38), ivory=this.material(0xe6dcc0,.6), metal=this.material(0x404640,.3);
    this.mesh(new this.Geo.Sphere(1,32,20),paint,[0,0,0],[.38,.38,1.45],group);
    this.mesh(new this.Geo.Box(3.8,.085,.65),ivory,[0,-.05,-.06],null,group);
    this.mesh(new this.Geo.Box(1.3,.06,.45),ivory,[0,.05,1.13],null,group);
    this.mesh(new this.Geo.Box(.06,.65,.60),paint,[0,.30,1.10],null,group);
    const cockpit=this.mesh(new this.Geo.Torus(.29,.045,10,32),metal,[0,.30,.12],null,group);cockpit.rotation.x=Math.PI/2;
    const prop=new T.Group();prop.position.set(0,0,-1.51);group.add(prop);
    this.mesh(new this.Geo.Box(.10,1.25,.05),metal,null,null,prop);
    this.mesh(new this.Geo.Sphere(.1,16,10),ivory,[0,0,-.04],null,prop);
    group.userData.propeller=prop;return group;
  }

  makeFork() {
    const fork=new this.T.Group();this.stage.add(fork);
    const wood=this.material(0x654326,.9);
    this.rod(fork,[0,0,0],[0,1.10,0],.13,wood);
    this.rod(fork,[0,.75,0],[-.43,1.87,0],.105,wood);
    this.rod(fork,[0,.75,0],[.43,1.87,0],.105,wood);
    [-1,1].forEach(side=>this.mesh(new this.Geo.Cylinder(.115,.115,.22,16),this.material(0xb9aa83,.85),[side*.43,1.80,0],null,fork));
    return fork;
  }

  begin(mode) {
    if (MODES.indexOf(mode)<0) return;
    if (mode==='sling' && this.page.ensurePhysics) {
      const phase=this.page.data.phase;
      // 物理分包未就绪时先下载，完成后仍停留在原阶段才继续搭建弹弓。
      if (!this.page.ensurePhysics(error => { if (!error && this.page.data.phase===phase) this.begin(mode); })) return;
    }
    this.setup(mode);
    if (mode==='sling') { this.buildSling(); return; }
    this.page.setData({ phase:'returnTravel', chapter:mode==='boat'?'荷风送归舟':'乘风归去',
      returnTitle:mode==='boat'?'一叶小舟，划向家':'飞越荷塘，回家啦' });
    this.vehicle=mode==='boat'?this.makeBoat():this.makePlane();
    this.hero=this.frog(mode==='boat'?.61:.43);
    this.vehicle.add(this.hero);this.hero.position.set(0,mode==='boat'?.20:.31,mode==='boat'?.18:.12);
    this.hero.rotation.y=Math.PI;this.hero.rotation.x=.12;
    this.vehicle.updateMatrixWorld(true);
    const bounds=new this.T.Box3().setFromObject(this.vehicle);
    this.vehicleCenter=bounds.getCenter(new this.T.Vector3());
    this.vehicleRadius=bounds.getBoundingSphere(new this.T.Sphere()).radius;
    this.rowPower=0;this.rowPhase=0;
    this.steer=0;this.targetLane=0;this.savedBand=-1;
    this.page.setData({returnLane:0,travelFeedback:'',travelCollected:this.page.currentRun?this.page.currentRun.ledger[mode].length:0});
    this.duration=mode==='boat'?9000:8000;
    this.path=new this.T.CatmullRomCurve3([
      new this.T.Vector3(-1.4,.20,5),new this.T.Vector3(1,mode==='boat'?.20:3.0,1),
      new this.T.Vector3(-.6,mode==='boat'?.20:4.0,-4),new this.T.Vector3(0,.25,-8)
    ]);
    const dock=this.mesh(new this.Geo.Box(3,.15,2.2),this.material(0x896c43,.85),[0,-.04,-10]);
    dock.receiveShadow=true;
    this.makeTravelEvents();
  }

  travelPoint(t,lane) {
    const at=ease(t),direction=this.path.getTangent(at),point=this.path.getPoint(at);
    const right=new this.T.Vector3(-direction.z,0,direction.x).normalize();
    return {point:point.addScaledVector(right,lane*1.7),direction};
  }

  makeTravelEvents() {
    const T=this.T,mode=this.mode;
    this.events=[.22,.48,.73].map((at,i)=>({id:mode+'-'+i,at,lane:(i%2?-1:1)*(mode==='boat'?-1:1),kind:'pickup',passed:false}));
    if(mode==='boat')this.events.push({id:'reed-0',at:.35,lane:1,kind:'reed',passed:false},{id:'reed-1',at:.62,lane:-1,kind:'reed',passed:false});
    this.events.forEach(event=>{
      const root=new T.Group(),sample=this.travelPoint(event.at,event.lane);root.position.copy(sample.point);this.stage.add(root);event.mesh=root;
      if(event.kind==='reed'){
        for(let i=0;i<5;i++){
          const x=(i-2)*.12;
          this.rod(root,[x,-.35,0],[x+.08,.7+(i%2)*.3,0],.027,this.material(0x477445,.8));
          this.mesh(new this.Geo.Cylinder(.065,.07,.28,8),this.material(0x8e7046,.9),[x+.08,.72+(i%2)*.3,0],null,root);
        }
      }else if(mode==='boat'){
        root.position.y+=.38;
        this.mesh(new this.Geo.Sphere(.19,16,12),this.material(0xedcf67,.32),[0,0,0],[.85,1.25,.85],root);
        const ring=this.mesh(new this.Geo.Torus(.34,.025,6,24),this.material(0xf7e5a2,.4),[0,-.20,0],null,root);ring.rotation.x=Math.PI/2;
      }else{
        root.position.y+=.7;
        this.mesh(new this.Geo.Torus(1.95,.085,8,40),this.material(0xf0ce68,.38),null,null,root);
        root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),sample.direction);
      }
    });
  }

  steerTo(lane) {
    if(this.page.data.phase!=='returnTravel')return;
    const target=clamp(Math.round(lane),-1,1);if(target===this.targetLane)return;
    this.targetLane=target;this.page.setData({returnLane:this.targetLane});this.page.saveAdventure();
  }

  restoreTravel(saved) {
    this.elapsed=clamp(saved.elapsed/1000,0,this.duration/1000);
    this.steer=saved.steer;this.targetLane=saved.lane;
    this.events.forEach(event=>{event.passed=saved.passed.includes(event.id);event.mesh.visible=!event.passed;});
    this.page.setData({returnLane:this.targetLane});this.update(Date.now(),0);
  }

  updateTravelEvents(t,dt) {
    this.steer+=(this.targetLane-this.steer)*(1-Math.exp(-dt*8));
    this.events.forEach(event=>{
      if(event.passed)return;
      if(event.kind==='pickup'&&this.mode==='boat')event.mesh.rotation.y=this.elapsed*1.6;
      if(t<event.at)return;
      event.passed=true;event.mesh.visible=false;
      const hit=Math.abs(this.steer-event.lane)<.45;
      if(hit&&event.kind==='pickup'){
        const added=this.page.noteReturnPickup(this.mode,event.id);
        this.page.setData({travelFeedback:added?(this.mode==='boat'?'接到莲子 +1':'穿环成功 +1'):'这一颗已经收好啦'});
      }else if(hit){
        this.rowPower=0;this.wobbleUntil=this.elapsed+.65;this.page.vibrate('light');
        this.page.setData({travelFeedback:'轻轻碰到芦苇，继续前进'});
      }
      this.page.saveAdventure();
    });
    const band=Math.floor(t*5);
    if(band!==this.savedBand){this.savedBand=band;this.page.saveAdventure();}
  }

  paddle() {
    if(this.mode!=='boat'||this.page.data.phase!=='returnTravel')return;
    this.rowPower=1;this.rowPhase+=.8;this.page.vibrate('light');
  }

  buildSling() {
    const T=this.T;
    this.page.setData({ phase:'sling',chapter:'弹弓归途 · 害虫堡垒',returnTitle:'荷塘堡垒',slingReady:true,slingPower:65,
      fortressName:['木石门楼','双层风塔','护城矮堡'][this.page.data.fortressLayout] });
    this.mesh(new this.Geo.Cylinder(5.6,6.1,.6,64),this.material(0x576643,.95),[0,-.36,-1.4],[1,1,1.55]);
    this.mesh(new this.Geo.Box(2.7,.06,2.3),this.material(0xb0a185,.94),[0,-.04,-4.4]);
    this.fork=this.makeFork();this.fork.position.set(0,0,4.8);
    this.hero=this.frog(.57);this.hero.position.set(0,1.62,4.8);this.hero.rotation.y=Math.PI;
    this.launchOrigin=new T.Vector3(0,1.62,4.8);
    this.pull={x:0,power:.65};
    this.bands=[-1,1].map(side=>this.rod(this.stage,[side*.43,1.85,4.8],[0,1.7,4.8],.027,this.material(0x30231d,.8)));
    const dots=new T.BufferGeometry();
    (dots.setAttribute||dots.addAttribute).call(dots,'position',new T.Float32BufferAttribute(new Float32Array(16*3),3));
    this.trajectory=new T.Points(dots,new T.PointsMaterial({color:0xffefbc,size:.075,transparent:true,opacity:.75}));
    this.stage.add(this.trajectory);
    this.makePhysics();this.updateBands();this.updateTrajectory();
    const fit=Math.max(18.5,9.4/this.page.camera.aspect);
    this.pointCamera([fit*.28,fit*.57,fit*.73],[0,.65,.1]);
  }

  makePhysics() {
    const C=physics(this.page);
    this.world=new C.World();this.world.gravity.set(0,-9.82,0);this.world.allowSleep=true;
    this.world.broadphase=new C.NaiveBroadphase();this.world.solver.iterations=12;
    const ground=new C.Body({mass:0});ground.addShape(new C.Plane());ground.quaternion.setFromEuler(-Math.PI/2,0,0);ground.position.y=-.06;
    this.world.addBody(ground);this.blocks=[];
    const blockMaterial=new C.Material('wood');
    this.world.addContactMaterial(new C.ContactMaterial(blockMaterial,blockMaterial,{friction:.65,restitution:.02}));
    const add=(position,size,color,mass)=>{
      const body=new C.Body({mass:mass||.8,material:blockMaterial,position:new C.Vec3(...position),linearDamping:.14,angularDamping:.2});
      body.addShape(new C.Box(new C.Vec3(size[0]/2,size[1]/2,size[2]/2)));
      body.sleepSpeedLimit=.15;body.sleepTimeLimit=.5;this.world.addBody(body);
      const mesh=this.mesh(new this.Geo.Box(...size),this.material(color,.83),position);
      const part={body,mesh,initial:body.position.clone()};this.blocks.push(part);
      body.returnBlock=true;return part;
    };
    const layout=this.page.data.fortressLayout;
    if(layout===0){
    [-1,1].forEach(x=>[-3.9,-4.9].forEach(z=>{
      for(let y=0;y<3;y++)add([x,.23+y*.49,z],[.75,.46,.68],y%2?0x9d8060:0xb39d78);
    }));
    add([0,1.58,-4.4],[2.85,.20,1.80],0x745537,1.4);
    [-.98,-.33,.33,.98].forEach(x=>add([x,1.89,-4.12],[.48,.39,.48],0x9e8766,.45));
    }else if(layout===1){
      [-1.12,1.12].forEach(x=>{
        for(let y=0;y<5;y++)add([x,.22+y*.44,-4.4],[.62,.44,1.05],y%2?0x8b7869:0xb6aba0);
      });
      add([0,2.30,-4.4],[3.0,.20,1.25],0x64584e,.8);
      [-1.12,1.12].forEach(x=>add([x,2.65,-4.4],[.62,.50,.75],0x917859,.45));
    }else{
      [-1.55,-.78,0,.78,1.55].forEach(x=>{
        add([x,.22,-4.65],[.74,.42,.9],0x929b85);
        add([x,.66,-4.65],[.72,.42,.9],0xaab29b);
      });
      [-1.55,1.55].forEach(x=>add([x,1.13,-4.65],[.8,.48,1],0x727e67));
      [-.78,0,.78].forEach(x=>add([x,1.15,-4.4],[.72,.5,.74],0x937753));
      add([0,1.54,-4.4],[2.35,.23,1.3],0x786341,1);
      add([0,1.92,-4.12],[.65,.54,.55],0xc4ad7b,.4);
    }
    this.enemy=this.makeGrasshopper(false);this.enemy.position.set(0,1.75,-4.4);
    this.enemyBody=new C.Body({mass:.6,position:new C.Vec3(0,layout===1?2.72:2.10,-4.4),linearDamping:.1});
    this.enemyBody.addShape(new C.Sphere(.31));this.world.addBody(this.enemyBody);
    for(let i=0;i<90;i++)this.world.step(1/60);
    this.blocks.forEach(part=>{part.initial.copy(part.body.position);part.initialRotation=part.body.quaternion.clone();});
    this.enemyInitial=this.enemyBody.position.clone();
    this.syncPhysics();
  }

  scatterFortress() {
    this.blocks.forEach((part,i)=>{
      part.body.position.set((i%5-2)*.65,.15,-4.3+Math.floor(i/5)*.48);
      part.body.quaternion.setFromEuler(.5+(i%3)*.4,0,.6);part.body.velocity.set(0,0,0);
    });
    this.enemyBody.position.set(1.7,.24,-3.9);this.enemyBody.quaternion.setFromEuler(0,0,1.5);this.syncPhysics();
  }

  makeGrasshopper(club) {
    const T=this.T,group=new T.Group();this.stage.add(group);
    const green=this.material(0x69833e,.68),dark=this.material(0x253b1c,.7),ivory=this.material(0xe0d7b5,.5);
    this.mesh(new this.Geo.Sphere(.3,24,16),green,[0,.26,0],[.72,.7,1.8],group);
    this.mesh(new this.Geo.Sphere(.24,24,16),green,[0,.40,.43],[1,.95,.9],group);
    [-1,1].forEach(side=>{
      this.mesh(new this.Geo.Sphere(.10,16,12),dark,[side*.18,.49,.53],null,group);
      this.rod(group,[side*.10,.56,.48],[side*.25,.94,.62],.012,dark);
      for(let i=0;i<3;i++){
        const z=-.3+i*.28;
        this.rod(group,[side*.16,.30,z],[side*(i===0?.6:.4),i===0?.64:.18,z-.15],i===0?.055:.025,green);
        this.rod(group,[side*(i===0?.6:.4),i===0?.64:.18,z-.15],[side*.56,.04,z+.15],.022,dark);
      }
    });
    if(club){
      const arm=new T.Group();arm.position.set(-.25,.37,.28);group.add(arm);
      this.rod(arm,[0,0,0],[-.18,.48,0],.045,this.material(0x775134,.9));
      this.mesh(new this.Geo.Cylinder(.16,.16,.38,16),ivory,[-.18,.55,0],null,arm);
      group.userData.club=arm;
    }
    return group;
  }

  launchVelocity() {
    return new this.T.Vector3(this.pull.x*3.7,4+this.pull.power*4,-(5+this.pull.power*3));
  }

  updateBands() {
    if(!this.bands)return;
    const T=this.T;
    this.bands.forEach((band,i)=>{
      const from=new T.Vector3((i?1:-1)*.43,1.85,4.8),to=this.hero.position.clone().add(new T.Vector3(0,.13,0));
      const direction=to.clone().sub(from),length=Math.max(.01,direction.length());
      // Geometry was created at its initial length; retain that length while aiming.
      if(!band.userData.restLength)band.userData.restLength=band.geometry.parameters.height;
      band.position.copy(from).lerp(to,.5);band.scale.y=length/band.userData.restLength;
      band.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());
      band.visible=!this.projectile;
    });
  }

  updateTrajectory() {
    if(!this.trajectory)return;
    const velocity=this.launchVelocity(),position=this.trajectory.geometry.attributes.position;
    for(let i=0;i<16;i++){
      const t=i*.1;
      position.setXYZ(i,this.launchOrigin.x+velocity.x*t,this.launchOrigin.y+velocity.y*t-4.91*t*t,this.launchOrigin.z+velocity.z*t);
    }
    position.needsUpdate=true;this.trajectory.visible=!!this.drag;
  }

  touch(event) {
    return (event.touches&&event.touches[0])||(event.changedTouches&&event.changedTouches[0]);
  }

  touchStart(event) {
    if(this.page.data.phase==='returnTravel'){const t=this.touch(event);if(t)this.travelDrag={x:t.x,lane:this.targetLane};this.paddle();return;}
    if(this.page.data.phase!=='sling'||this.projectile)return;
    const t=this.touch(event);if(!t)return;
    this.drag={x:t.x,y:t.y};this.pull={x:0,power:0};this.page.setData({slingPower:0});this.updateTrajectory();
  }

  touchMove(event) {
    if(this.travelDrag&&this.page.data.phase==='returnTravel'){
      const t=this.touch(event);if(t)this.steerTo(this.travelDrag.lane+(t.x-this.travelDrag.x)/(this.page.width*.23));return;
    }
    if(!this.drag||this.projectile)return;
    const t=this.touch(event);if(!t)return;
    const dy=Math.max(0,t.y-this.drag.y),dx=t.x-this.drag.x;
    this.pull={x:clamp(-dx/(this.page.width*.34),-1,1),power:clamp(dy/(this.page.height*.22),0,1)};
    this.hero.position.copy(this.launchOrigin).add(new this.T.Vector3(dx/this.page.width*.9,-this.pull.power*.24,this.pull.power*.65));
    this.page.setData({slingPower:Math.round(this.pull.power*100)});
    this.updateBands();this.updateTrajectory();
  }

  touchEnd() {
    if(this.travelDrag){this.travelDrag=null;this.page.saveAdventure();return;}
    if(!this.drag||this.projectile)return;
    this.drag=null;
    if(this.pull.power<.08){this.hero.position.copy(this.launchOrigin);this.updateBands();this.updateTrajectory();return;}
    this.fire();
  }

  cancelTouch() {
    this.drag=null;this.travelDrag=null;
    if(this.hero&&this.launchOrigin&&!this.projectile)this.hero.position.copy(this.launchOrigin);
    this.updateBands();if(this.trajectory)this.trajectory.visible=false;
  }

  fire() {
    if(this.projectile||this.page.data.phase!=='sling')return;
    const velocity=this.launchVelocity();
    const body=new CANNON.Body({mass:3.2,position:new CANNON.Vec3(...this.launchOrigin.toArray()),linearDamping:.015,angularDamping:.12});
    body.addShape(new CANNON.Sphere(.32));body.velocity.set(velocity.x,velocity.y,velocity.z);
    body.quaternion.setFromEuler(0,Math.PI,0);
    body.addEventListener('collide',event=>{
      if(event.body.returnBlock&&Math.abs(event.contact.getImpactVelocityAlongNormal())>1.4)this.fortressHit=true;
      if(event.body===this.enemyBody)this.fortressHit=true;
      if(this.fortressHit&&this.impactAt===null)this.impactAt=this.physicsElapsed;
    });
    this.world.addBody(body);this.projectile=body;this.shotAt=Date.now();
    this.page.setData({slingReady:false,returnTitle:'飞向害虫堡垒'});
    this.trajectory.visible=false;this.updateBands();this.page.vibrate('heavy');
    this.page.saveAdventure();
  }

  syncPhysics() {
    this.blocks.forEach(part=>{part.mesh.position.copy(part.body.position);part.mesh.quaternion.copy(part.body.quaternion);});
    this.enemy.position.copy(this.enemyBody.position);this.enemy.position.y-=.3;
    this.enemy.quaternion.copy(this.enemyBody.quaternion);
    if(this.projectile){this.hero.position.copy(this.projectile.position);this.hero.quaternion.copy(this.projectile.quaternion);}
  }

  finishShot(won) {
    if(this.page.data.phase!=='sling')return;
    this.resultAt=Date.now();this.won=won;
    this.fork.visible=false;
    (this.bands||[]).forEach(band=>{band.visible=false;});
    if(this.projectile)this.world.removeBody(this.projectile);
    this.projectile=null;
    this.page.setData({phase:'returnResult',returnOutcome:won?'win':'lose',returnTitle:won?'堡垒倒啦！':'被大蝗虫拦住了',returnResultReady:false});
    this.hero.position.set(0,won?1.1:.56,1);
    this.hero.rotation.set(won?-Math.PI/2:Math.PI/2,0,0);
    this.hero.scale.setScalar(won?.65:.85);
    (this.hero.userData.frontLegs||[]).forEach((leg,i)=>{leg.rotation.z=(i?1:-1)*.85;});
    (this.hero.userData.hindLegs||[]).forEach((leg,i)=>{leg.rotation.z=(i?1:-1)*.75;});
    if(!won){
      this.bully=this.makeGrasshopper(true);this.bully.position.set(1.3,.1,2.3);this.bully.scale.setScalar(1.65);this.bully.rotation.y=-.6;
      this.hero.updateMatrixWorld(true);
      this.resultHead=this.hero.localToWorld(new this.T.Vector3(0,1.65,0));
      this.stars=new this.T.Group();this.stage.add(this.stars);
      for(let i=0;i<5;i++){
        const shape=new this.T.Shape();
        for(let k=0;k<10;k++){const a=k*Math.PI/5,r=k%2?.045:.10;if(!k)shape.moveTo(Math.sin(a)*r,Math.cos(a)*r);else shape.lineTo(Math.sin(a)*r,Math.cos(a)*r);}
        shape.closePath();this.mesh(new this.Geo.Shape(shape),this.material(0xf2d76d,.3),null,null,this.stars);
      }
    }
    if(won){
      this.hero.scale.setScalar(1.45);this.frameResult([this.hero],[.05,1,.60]);
      this.hero.scale.setScalar(.65);
    }
    else {
      this.frameResult([this.hero,this.bully],[.12,.72,1]);
    }
    this.page.saveAdventure();
  }

  update(now,dt) {
    if(!this.active)return;
    this.elapsed+=dt;
    if(this.mode==='choice'){
      this.hero.rotation.y=Math.sin(this.elapsed*.6)*.16;
      this.vehicle.rotation.z=Math.sin(this.elapsed*1.6)*.025;
      this.previewPlane.position.y=1.8+Math.sin(this.elapsed*.9)*.16;
      this.previewPlane.userData.propeller.rotation.z+=dt*35;
      return;
    }
    if(this.page.data.phase==='returnTravel'){
      this.rowPower=Math.max(0,this.rowPower-dt*.45);
      this.elapsed+=this.mode==='boat'?dt*this.rowPower*.6:0;
      const t=clamp(this.elapsed*1000/this.duration,0,1);
      this.updateTravelEvents(t,dt);
      const {point,direction}=this.travelPoint(t,this.steer);
      this.vehicle.position.copy(point);this.vehicle.rotation.y=Math.atan2(-direction.x,-direction.z);
      this.vehicle.rotation.z=Math.sin(this.elapsed*1.9)*(this.mode==='boat'?.04:.10);
      this.vehicle.rotation.z-=this.steer*(this.mode==='boat'?.035:.15);
      if(this.wobbleUntil>this.elapsed)this.vehicle.rotation.z+=Math.sin(this.elapsed*32)*.13;
      if(this.mode==='boat'){
        this.vehicle.position.y+=Math.sin(this.elapsed*2)*.045;
        this.rowPhase+=dt*(2+this.rowPower*3);
        this.vehicle.userData.oars.forEach((oar,i)=>{oar.rotation.y=Math.sin(this.rowPhase)*(i?-.6:.6);});
        (this.hero.userData.frontLegs||[]).forEach(leg=>{leg.rotation.x=Math.sin(this.rowPhase)*.22;});
      }else this.vehicle.userData.propeller.rotation.z+=dt*55;
      this.vehicle.updateMatrixWorld(true);
      const center=this.vehicle.localToWorld(this.vehicleCenter.clone());
      const half=Math.atan(Math.tan(this.page.camera.fov*Math.PI/360)*this.page.camera.aspect);
      const distance=Math.max(8.5,this.vehicleRadius/Math.sin(half)*1.12);
      const view=new this.T.Vector3(.45,.43,.75).normalize().multiplyScalar(distance).add(center);
      this.pointCamera(view.toArray(),center.toArray());
      const percent=Math.round(t*100);if(percent!==this.page.data.returnProgress)this.page.setData({returnProgress:percent});
      if(t>=1){this.page.setData({returnResultReady:true});this.page.showFinal();}return;
    }
    if(this.page.data.phase==='sling'){
      this.physicsElapsed+=dt;
      this.world.step(1/60,dt,4);this.syncPhysics();
      if(this.projectile){
        const toppled=this.blocks.filter(part=>{
          const q=part.body.quaternion,r=part.initialRotation;
          const dot=Math.abs(q.x*r.x+q.y*r.y+q.z*r.z+q.w*r.w);
          return part.body.position.distanceTo(part.initial)>.24||2*Math.acos(clamp(dot,0,1))>.3;
        }).length;
        const damage=Math.round(toppled/this.blocks.length*100);
        if(damage!==this.page.data.fortressDamage)this.page.setData({fortressDamage:damage});
        const enemyMoved=this.enemyBody.position.distanceTo(this.enemyInitial)>.45;
        if(this.fortressHit&&this.impactAt!==null&&this.physicsElapsed-this.impactAt>.8&&(toppled>=2||enemyMoved)){this.finishShot(true);return;}
        if(now-this.shotAt>5200||this.projectile.position.y<-.6||Math.abs(this.projectile.position.x)>8||this.projectile.position.z<-12)this.finishShot(false);
      }return;
    }
    if(this.page.data.phase==='returnResult'){
      if(this.world){this.world.step(1/60,dt,4);this.syncPhysics();}
      const t=clamp((now-this.resultAt)/(this.won?2200:3500),0,1);
      if(this.won){
        this.hero.scale.setScalar(.65+ease(t)*.8);
        this.hero.position.y=1.1+Math.sin(t*Math.PI)*.14;
        this.hero.rotation.z=Math.sin(t*Math.PI*2)*.10;
      }else{
        const swing=Math.max(0,Math.sin(t*Math.PI*6));
        this.bully.userData.club.rotation.z=-.3-swing*1.35;
        this.hero.scale.set(.85,.85*(1-swing*.15),.85);
        this.hero.rotation.z=Math.sin(t*34)*.06*(1-t);
        (this.hero.userData.eyelids||[]).forEach(lid=>{lid.rotation.x=1.2;});
        this.blur=ease(clamp((t-.35)/.65,0,1))*2.5;
        this.stars.children.forEach((star,i)=>{
          const a=this.elapsed*3+i*Math.PI*2/5;star.position.set(this.resultHead.x+Math.cos(a)*.5,this.resultHead.y+.65,this.resultHead.z+Math.sin(a)*.22);star.rotation.y=-.4;
        });
      }
      if(t>=1&&!this.page.data.returnResultReady)this.page.setData({returnResultReady:true});
    }
  }

  render() {
    const p=this.page,T=this.T,r=p.renderer;
    if(!this.blur||!r.setRenderTarget){r.render(p.scene,p.camera);return;}
    if(!this.blurTarget){
      this.blurTarget=new T.WebGLRenderTarget(Math.round(p.width),Math.round(p.height));
      this.blurIntermediate=new T.WebGLRenderTarget(Math.round(p.width),Math.round(p.height));
      this.blurScene=new T.Scene();this.blurCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
      this.blurMaterial=new T.ShaderMaterial({ uniforms:{image:{value:this.blurTarget.texture},pixel:{value:new T.Vector2(1/p.width,1/p.height)},direction:{value:new T.Vector2(1,0)},amount:{value:0},finish:{value:0}},
        vertexShader:'varying vec2 tex;void main(){tex=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:'uniform sampler2D image;uniform vec2 pixel;uniform vec2 direction;uniform float amount;uniform float finish;varying vec2 tex;void main(){vec2 d=pixel*direction*amount;vec3 c=texture2D(image,tex).rgb*.227027;c+=texture2D(image,tex+d*1.384615).rgb*.316216;c+=texture2D(image,tex-d*1.384615).rgb*.316216;c+=texture2D(image,tex+d*3.230769).rgb*.070270;c+=texture2D(image,tex-d*3.230769).rgb*.070270;float grey=dot(c,vec3(.299,.587,.114));c=mix(c,vec3(grey),amount*.10*finish);c*=1.-smoothstep(.25,.8,length(tex-.5))*.22*finish;gl_FragColor=vec4(c,1.);}',depthTest:false,depthWrite:false });
      this.blurQuad=new T.Mesh(new this.Geo.Plane(2,2),this.blurMaterial);this.blurQuad.frustumCulled=false;this.blurScene.add(this.blurQuad);
    }
    this.blurMaterial.uniforms.amount.value=this.blur;
    r.setRenderTarget(this.blurTarget);r.render(p.scene,p.camera);
    this.blurMaterial.uniforms.image.value=this.blurTarget.texture;
    this.blurMaterial.uniforms.direction.value.set(1,0);this.blurMaterial.uniforms.finish.value=0;
    r.setRenderTarget(this.blurIntermediate);r.render(this.blurScene,this.blurCamera);
    this.blurMaterial.uniforms.image.value=this.blurIntermediate.texture;
    this.blurMaterial.uniforms.direction.value.set(0,1);this.blurMaterial.uniforms.finish.value=1;
    r.setRenderTarget(null);r.render(this.blurScene,this.blurCamera);
  }

  dispose() {
    this.active=false;this.drag=null;this.travelDrag=null;this.events=null;this.projectile=null;this.world=null;this.blur=0;this.wobbleUntil=0;
    if(this.stage)this.page.removeObject(this.stage);
    this.stage=null;
    if(this.blurTarget)this.blurTarget.dispose();
    if(this.blurIntermediate)this.blurIntermediate.dispose();
    if(this.blurMaterial)this.blurMaterial.dispose();
    if(this.blurQuad)this.blurQuad.geometry.dispose();
    this.blurTarget=null;this.blurIntermediate=null;this.blurMaterial=null;this.blurQuad=null;
    this.bands=null;this.trajectory=null;this.launchOrigin=null;this.hero=null;
    if(this.page.pondGroup)this.page.pondGroup.visible=true;
    if(this.page.scene.fog){this.page.scene.fog.near=24;this.page.scene.fog.far=62;}
  }
}

module.exports = page => new ReturnJourney(page);
