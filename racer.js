function racer() {
  var fps = 60;                      // how many 'update' frames per second
  var step = 1 / fps;                   // how long is each frame (in seconds)
  var width = 1024;                    // logical canvas width
  var height = 768;                     // logical canvas height
  var centrifugal = 0.3;                     // centrifugal force multiplier when going around curves
  var offRoadDecel = 0.99;                    // speed multiplier when off road (e.g. you lose 2% speed each update frame)
  var skySpeed = 0.001;                   // background sky layer scroll speed when going around curve (or up hill)
  var hillSpeed = 0.002;                   // background hill layer scroll speed when going around curve (or up hill)
  var treeSpeed = 0.003;                   // background tree layer scroll speed when going around curve (or up hill)
  var skyOffset = 0;                       // current sky scroll offset
  var hillOffset = 0;                       // current hill scroll offset
  var treeOffset = 0;                       // current tree scroll offset
  var segments = [];                      // array of road segments
  var creatures = [];                      // array of creatures on the road
  var objects = [];
  var score = 0;												// current score
  var canvas = Dom.get('canvas');       // our canvas...
  var ctx = canvas.getContext('2d'); 		// ...and its drawing context
  var background = null;                    // our background image (loaded below)
  var sprites = null;                    // our spritesheet (loaded below)
  var resolution = null;                    // scaling factor to provide resolution independence (computed)
  var roadWidth = 2000;                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
  var segmentLength = 200;                     // length of a single segment
  var rumbleLength = 3;                       // number of segments per red/white rumble strip
  var trackLength = null;                    // z length of entire track (computed)
  var lanes = 3;                       // number of lanes
  var fieldOfView = 100;                     // angle (degrees) for field of view
  var cameraHeight = 1000;                    // z height of camera
  var cameraDepth = null;                    // z distance camera is from screen (computed)
  var drawDistance = 300;                     // number of segments to draw
  var playerX = 0;                       // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
  var playerZ = null;                    // player relative z distance from camera (computed)
  var fogDensity = 5;                       // exponential fog density
  var position = 0;                       // current camera Z position (add playerZ to get player's absolute Z position)
  var speed = 0;                       // current speed
  var maxSpeed = segmentLength / step;      // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
  var accel = maxSpeed / 5;             // acceleration rate - tuned until it 'felt' right
  var breaking = -maxSpeed;               // deceleration rate when braking
  var decel = -maxSpeed / 5;             // 'natural' deceleration rate when neither accelerating, nor braking
  var offRoadDecel = -maxSpeed / 2;             // off road deceleration is somewhere in between
  var offRoadLimit = maxSpeed / 4;             // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)
  var totalCreatures = 200;                     // total number of creatures on the road
  var totalCoins = 20;											// total number of coins on the road
  var totalNitros = 3;												// total number of nitros on the road
  var currentLapTime = 0;                       // current lap time
  var lastLapTime = null;                    // last lap time
  let lastTouchEnd = 0;												// count times screen is touched 
  let firstLapStarted = false;
  let isLeaderboardVisible = false; 				// Keep track of visibility state
  
  // Nitro variables
  var turboDuration = 5;                            // duration of turbo in seconds
  var turboAnimation = 1;                           // duration of animation to do progressive increase/decrease of fov
  var turboFovIncrement = 1.4;                        // multiplier of fov during turbo
  var turboMaxSpeed = maxSpeed * 1.4;         // maximum speed under turbo
  var turboCentrifugal = centrifugal/2;                         // torque when under turbo (else the player cannot turn in curves)
  var turboTriggered = false;                         // internal variable - turbo triggered by player?
  var turboTimeDone = 0.0;                             // internal variable - turbo being consumed, since how much time (allow to do animation and such)
  var turboCurrentFov = fieldOfView;              // internal variable - current fov while doing turbo
  
  
  var keyLeft = false;
  var keyRight = false;
  var keyFaster = false;
  var keySlower = false;
  
  var hud = {
    speed: { value: null, dom: Dom.get('speed_value') },
    current_lap_time: { value: null, dom: Dom.get('current_lap_time_value') },
    last_lap_time: { value: null, dom: Dom.get('last_lap_time_value') },
    fast_lap_time: { value: null, dom: Dom.get('fast_lap_time_value') },
    coins: { value: null, dom: Dom.get('coins_value') }
  }
  
  //=========================================================================
  // UPDATE THE GAME WORLD
  //=========================================================================
      
  function update(dt) {
    
    var n, i, creature, creatureW, sprite, spriteW, object, objectW, overlap;
    var playerSegment = findSegment(position + playerZ);
    var playerW = SPRITES.PLAYER_STRAIGHT.w * SPRITES.SCALE;
    var speedPercent = speed / maxSpeed;
    var dx = dt * 2.15 * speedPercent; // at top speed, should be able to cross from left to right (-1 to 1) in 1 second
    var startPosition = position;
    var segmentObject = playerSegment.object;
    
    updateCreatures(dt, playerSegment, playerW);
    
    position = Util.increase(position, dt * speed, trackLength);
    
    if (keyLeft)
      playerX = playerX - dx;
    else if (keyRight)
      playerX = playerX + dx;
    
    if (turboTriggered) {
      playerX = playerX - (dx * speedPercent * playerSegment.curve * turboCentrifugal);
    } else {
      playerX = playerX - (dx * speedPercent * playerSegment.curve * centrifugal);
    }
  
    if (keyFaster)
      speed = Util.accelerate(speed, accel, dt);
    else if (keySlower)
      speed = Util.accelerate(speed, breaking, dt);
    else
      speed = Util.accelerate(speed, decel, dt);
  
    if (segmentObject) {
      objectW = segmentObject.source.w * SPRITES.SCALE;
      overlap = Util.overlap(playerX, playerW, segmentObject.offset, objectW, 0.9);
  
      if (overlap) {
        if (segmentObject.source == SPRITES.COIN) 
          collectCoin();
        else if (segmentObject.source == SPRITES.NITRO) 
          triggerTurbo();
        playerSegment.object = null;
      }
    }
    
    if ((playerX < -1) || (playerX > 1)) {
      if (speed > offRoadLimit)
        speed = Util.accelerate(speed, offRoadDecel, dt);
  
      for (n = 0; n < playerSegment.sprites.length; n++) {
        sprite = playerSegment.sprites[n];
        spriteW = sprite.source.w * SPRITES.SCALE;
        if (Util.overlap(playerX, playerW, sprite.offset + spriteW / 2 * (sprite.offset > 0 ? 1 : -1), spriteW)) {
          speed = maxSpeed / 5;
          position = Util.increase(playerSegment.p1.world.z, -playerZ, trackLength); // stop in front of sprite (at front of segment)
          break;
        }
      }
    }
  
    for (n = 0; n < playerSegment.creatures.length; n++) {
      creature = playerSegment.creatures[n];
      creatureW = creature.sprite.w * SPRITES.SCALE;
      if (speed > creature.speed) {
        if (Util.overlap(playerX, playerW, creature.offset, creatureW, 0.7)) {
          speed = creature.speed * (creature.speed / speed);
          position = Util.increase(creature.z, -playerZ, trackLength);
          break;
        }
      }
    }
  
    playerX = Util.limit(playerX, -3, 3);    
  
    if (!turboTriggered) {
      speed   = Util.limit(speed, 0, maxSpeed);
    } else {
      speed   = Util.limit(speed, 0, turboMaxSpeed); 
      accel = turboMaxSpeed / 3; 
      turboTimeDone += dt; 
      if (turboTimeDone < turboDuration) {
        if (turboTimeDone < turboAnimation) {
          turboFov = fieldOfView * turboFovIncrement;
          if (turboCurrentFov < turboFov) {
            turboCurrentFov += (turboFov - fieldOfView) * (dt/turboAnimation);
            updateFOV(turboCurrentFov);
          }
        } else if (turboDuration <= (turboTimeDone + turboAnimation)) {
          if (turboCurrentFov > fieldOfView) {
            turboCurrentFov -= (turboFov - fieldOfView) * (dt/turboAnimation);
            updateFOV(turboCurrentFov);
          }
          if (speed > maxSpeed) {
            speed -= (turboMaxSpeed - maxSpeed) * (dt/turboAnimation)*3;
          }
        }
      } else {
        turboTriggered = false;
        updateFOV(fieldOfView);
      }
    }
  
    skyOffset = Util.increase(skyOffset, skySpeed * playerSegment.curve * (position - startPosition) / segmentLength, 1);
    hillOffset = Util.increase(hillOffset, hillSpeed * playerSegment.curve * (position - startPosition) / segmentLength, 1);
    treeOffset = Util.increase(treeOffset, treeSpeed * playerSegment.curve * (position - startPosition) / segmentLength, 1);
  
    if (position > playerZ) {
      if (!firstLapStarted) {
        startGameAPI();
        console.log("first lap starts now");
        firstLapStarted = true;
      }
      if (currentLapTime && (startPosition < playerZ)) {
        lastLapTime = currentLapTime;
        currentLapTime = 0;
        resetObjects();
        if (lastLapTime <= Util.toFloat(Dom.storage.fast_lap_time)) {
          Dom.storage.fast_lap_time = lastLapTime;
          updateHud('fast_lap_time', formatTime(lastLapTime));
          Dom.addClassName('fast_lap_time', 'fastest');
          Dom.addClassName('last_lap_time', 'fastest');
          const sonic = Util.toFloat(Dom.storage.fast_lap_time);
          console.log("fast_lap_time --> ", sonic);
          endGameAPI(sonic);
        } else {
          Dom.removeClassName('fast_lap_time', 'fastest');
          Dom.removeClassName('last_lap_time', 'fastest');
        }
        updateHud('last_lap_time', formatTime(lastLapTime));
        Dom.show('last_lap_time');
        startGameAPI()
      }
      else {
        currentLapTime += dt;
      }
    }
  
    updateHud('speed', 5 * Math.round(speed / 500));
    updateHud('current_lap_time', formatTime(currentLapTime));
    updateHud('coins', score); // Update the score in the HUD
  }
  
  //-------------------------------------------------------------------------
  
  function updateCreatures(dt, playerSegment, playerW) {
    var n, creature, oldSegment, newSegment;
    for (n = 0; n < creatures.length; n++) {
      creature = creatures[n];
      oldSegment = findSegment(creature.z);
      creature.offset = creature.offset + updateCreatureOffset(creature, oldSegment, playerSegment, playerW);
      creature.z = Util.increase(creature.z, dt * creature.speed, trackLength);
      creature.percent = Util.percentRemaining(creature.z, segmentLength); // useful for interpolation during rendering phase
      newSegment = findSegment(creature.z);
      if (oldSegment != newSegment) {
        index = oldSegment.creatures.indexOf(creature);
        oldSegment.creatures.splice(index, 1);
        newSegment.creatures.push(creature);
      }
    }
  }
  
  function updateCreatureOffset(creature, creatureSegment, playerSegment, playerW) {
    
    var i, j, dir, segment, otherCreature, otherCreatureW, lookahead = 25, creatureW = creature.sprite.w * SPRITES.SCALE;
    
    // optimization, dont bother steering around other creatures when 'out of sight' of the player
    if ((creatureSegment.index - playerSegment.index) > drawDistance)
      return 0;
  
      for (i = 1; i < lookahead; i++) {
      segment = segments[(creatureSegment.index + i) % segments.length];
      
      if ((segment === playerSegment) && (creature.speed > speed) && (Util.overlap(playerX, playerW, creature.offset, creatureW, 1.2))) {
        if (playerX > 0.5)
          dir = -1;
          else if (playerX < -0.5)
          dir = 1;
          else
          dir = (creature.offset > playerX) ? 1 : -1;
          return dir * 1 / i * (creature.speed - speed) / maxSpeed; // the closer the creatures (smaller i) and the greated the speed ratio, the larger the offset
      }
  
      for (j = 0; j < segment.creatures.length; j++) {
        otherCreature = segment.creatures[j];
        otherCreatureW = otherCreature.sprite.w * SPRITES.SCALE;
        if ((creature.speed > otherCreature.speed) && Util.overlap(creature.offset, creatureW, otherCreature.offset, otherCreatureW, 1.2)) {
          if (otherCreature.offset > 0.5)
            dir = -1;
          else if (otherCreature.offset < -0.5)
          dir = 1;
          else
            dir = (creature.offset > otherCreature.offset) ? 1 : -1;
          return dir * 1 / i * (creature.speed - otherCreature.speed) / maxSpeed;
        }
      }
    }
  
    // if no creatures ahead, but I have somehow ended up off road, then steer back on
    if (creature.offset < -0.85)
      return 0.1;
    else if (creature.offset > 0.85)
      return -0.1;
    else
      return 0;
  }
  
  //-------------------------------------------------------------------------
  
  function collectCoin() {
    Dom.get('current_lap_time').style.backgroundColor = 'green';
    setTimeout(function() {
      Dom.get('current_lap_time').style.backgroundColor = '';
    }, 1000);
    
    score += 1;
    currentLapTime -= 1.5;
    console.log("Money");
  }
  
  function triggerTurbo() {
    turboCurrentFov = fieldOfView;
    turboTimeDone = 0.0;
    turboTriggered = true;
    console.log("GO CRAZYYYY");
  }
  
  function updateFOV(fov) {
    cameraDepth = 1 / Math.tan((fov/2) * Math.PI/180);
    playerZ = (cameraHeight * cameraDepth);
  }
  
  //-------------------------------------------------------------------------
  
  function updateHud(key, value) { // accessing DOM can be slow, so only do it if value has changed
    if (hud[key].value !== value) {
      hud[key].value = value;
      Dom.set(hud[key].dom, value);
    }
  }
  
  function formatTime(dt) {
    var minutes = Math.floor(dt / 60);
    var seconds = Math.floor(dt - (minutes * 60));
    var tenths = Math.floor(10 * (dt - Math.floor(dt)));
    if (minutes > 0)
      return minutes + "." + (seconds < 10 ? "0" : "") + seconds + "." + tenths;
    else
    return seconds + "." + tenths;
  }
  
  //=========================================================================
  // RENDER THE GAME WORLD
  //=========================================================================
  
  function render() {
  
    var baseSegment = findSegment(position);
    var basePercent = Util.percentRemaining(position, segmentLength);
    var playerSegment = findSegment(position + playerZ);
    var playerPercent = Util.percentRemaining(position + playerZ, segmentLength);
    var playerY = Util.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);
    var maxy = height;
    
    var x = 0;
    var dx = - (baseSegment.curve * basePercent);
    
    
    ctx.clearRect(0, 0, width, height);
  
    Render.background(ctx, background, width, height, BACKGROUND.SKY, skyOffset, resolution * skySpeed * playerY);
    // Render.background(ctx, background, width, height, BACKGROUND.HILLS, hillOffset, resolution * hillSpeed * playerY);
    Render.background(ctx, background, width, height, BACKGROUND.TREES, treeOffset, resolution * treeSpeed * playerY);
    
    var n, i, segment, creature, sprite, spriteScale, spriteX, spriteY;
    
    for (n = 0; n < drawDistance; n++) {
  
      segment = segments[(baseSegment.index + n) % segments.length];
      segment.looped = segment.index < baseSegment.index;
      segment.fog = Util.exponentialFog(n / drawDistance, fogDensity);
      segment.clip = maxy;
      
      Util.project(segment.p1, (playerX * roadWidth) - x, playerY + cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);
      Util.project(segment.p2, (playerX * roadWidth) - x - dx, playerY + cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);
  
      x = x + dx;
      dx = dx + segment.curve;
  
      if ((segment.p1.camera.z <= cameraDepth) || // behind us
        (segment.p2.screen.y >= segment.p1.screen.y) || // back face cull
        (segment.p2.screen.y >= maxy))                  // clip by (already rendered) hill
        continue;
        
      Render.segment(ctx, width, lanes,
      segment.p1.screen.x,
        segment.p1.screen.y,
        segment.p1.screen.w,
        segment.p2.screen.x,
        segment.p2.screen.y,
        segment.p2.screen.w,
        segment.fog,
        segment.color);
  
        maxy = segment.p1.screen.y;
    }
  
    for (n = (drawDistance - 1); n > 0; n--) {
      segment = segments[(baseSegment.index + n) % segments.length];
      
      for (i = 0; i < segment.creatures.length; i++) {
        creature = segment.creatures[i];
        spriteScale = Util.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, creature.percent);
        spriteX = Util.interpolate(segment.p1.screen.x, segment.p2.screen.x, creature.percent) + (spriteScale * creature.offset * roadWidth * width / 2);
        spriteY = Util.interpolate(segment.p1.screen.y, segment.p2.screen.y, creature.percent);
        Render.sprite(ctx, width, height, resolution, roadWidth, sprites, creature.sprite, spriteScale, spriteX, spriteY, -0.5, -1, segment.clip);
      }
  
      for (var i = 0; i < segment.sprites.length; i++) {
        sprite = segment.sprites[i];
        spriteScale = segment.p1.screen.scale;
        spriteX = segment.p1.screen.x + (spriteScale * sprite.offset * roadWidth * width / 2);
        spriteY = segment.p1.screen.y;
        Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), -1, segment.clip);
      }
      
      if (segment.object !== null) {
        object = segment.object;
        spriteScale = segment.p1.screen.scale;
        spriteX = segment.p1.screen.x + (spriteScale * object.offset * roadWidth * width / 2);
        spriteY = segment.p1.screen.y;
        Render.sprite(ctx, width, height, resolution, roadWidth, sprites, object.source, spriteScale, spriteX, spriteY, -0.5, -1, segment.clip);
      }
  
      if (segment == playerSegment) {
        Render.player(ctx, width, height, resolution, roadWidth, sprites, speed / maxSpeed,
          cameraDepth / playerZ,
          width / 2,
          (height / 2) - (cameraDepth / playerZ * Util.interpolate(playerSegment.p1.camera.y, playerSegment.p2.camera.y, playerPercent) * height / 2),
          speed * (keyLeft ? -1 : keyRight ? 1 : 0),
          playerSegment.p2.world.y - playerSegment.p1.world.y);
      }
    }
  }
  
  function findSegment(z) {
    return segments[Math.floor(z / segmentLength) % segments.length];
  }
  
  //=========================================================================
  // BUILD ROAD GEOMETRY
  //=========================================================================
  
  function lastY() { return (segments.length == 0) ? 0 : segments[segments.length - 1].p2.world.y; }
  
  function addSegment(curve, y) {
    var n = segments.length;
    segments.push({
      index: n,
      p1: { world: { y: lastY(), z: n * segmentLength }, camera: {}, screen: {} },
      p2: { world: { y: y, z: (n + 1) * segmentLength }, camera: {}, screen: {} },
      curve: curve,
      sprites: [],
      creatures: [],
      object: null,
      color: Math.floor(n / rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT
    });
  }
  
  function addSprite(n, sprite, offset) {
    segments[n].sprites.push({ source: sprite, offset: offset });
  }
  
  function addRoad(enter, hold, leave, curve, y) {
    var startY = lastY();
    var endY = startY + (Util.toInt(y, 0) * segmentLength);
    var n, total = enter + hold + leave;
    for (n = 0; n < enter; n++)
      addSegment(Util.easeIn(0, curve, n / enter), Util.easeInOut(startY, endY, n / total));
      for (n = 0; n < hold; n++)
      addSegment(curve, Util.easeInOut(startY, endY, (enter + n) / total));
    for (n = 0; n < leave; n++)
    addSegment(Util.easeInOut(curve, 0, n / leave), Util.easeInOut(startY, endY, (enter + hold + n) / total));
  }
  
  var ROAD = {
    LENGTH: { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 },
    HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 },
    CURVE: { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 }
  };
  
  function addStraight(num) {
    num = num || ROAD.LENGTH.MEDIUM;
    addRoad(num, num, num, 0, 0);
  }
  
  function addHill(num, height) {
    num = num || ROAD.LENGTH.MEDIUM;
    height = height || ROAD.HILL.MEDIUM;
    addRoad(num, num, num, 0, height);
  }
  
  function addCurve(num, curve, height) {
    num = num || ROAD.LENGTH.MEDIUM;
    curve = curve || ROAD.CURVE.MEDIUM;
    height = height || ROAD.HILL.NONE;
    addRoad(num, num, num, curve, height);
  }
  
  function addLowRollingHills(num, height) {
    num = num || ROAD.LENGTH.SHORT;
    height = height || ROAD.HILL.LOW;
    addRoad(num, num, num, 0, height / 2);
    addRoad(num, num, num, 0, -height);
    addRoad(num, num, num, ROAD.CURVE.EASY, height);
    addRoad(num, num, num, 0, 0);
    addRoad(num, num, num, -ROAD.CURVE.EASY, height / 2);
    addRoad(num, num, num, 0, 0);
  }
  
  function addSCurves() {
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, -ROAD.CURVE.EASY, ROAD.HILL.NONE);
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.CURVE.EASY, -ROAD.HILL.LOW);
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, -ROAD.CURVE.EASY, ROAD.HILL.MEDIUM);
    addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
  }
  
  function addBumps() {
    addRoad(10, 10, 10, 0, 5);
    addRoad(10, 10, 10, 0, -2);
    addRoad(10, 10, 10, 0, -5);
    addRoad(10, 10, 10, 0, 8);
    addRoad(10, 10, 10, 0, 5);
    addRoad(10, 10, 10, 0, -7);
    addRoad(10, 10, 10, 0, 5);
    addRoad(10, 10, 10, 0, -2);
  }
  
  function addDownhillToEnd(num) {
    num = num || 200;
    addRoad(num, num, num, -ROAD.CURVE.EASY, -lastY() / segmentLength);
  }
  
  function resetRoad() {
    segments = [];
    
    addStraight(ROAD.LENGTH.SHORT);
    addLowRollingHills();
    addSCurves();
    addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.LOW);
    addBumps();
    addLowRollingHills();
    addCurve(ROAD.LENGTH.LONG * 2, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    addStraight();
    addHill(ROAD.LENGTH.MEDIUM, ROAD.HILL.HIGH);
    addSCurves();
    addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM, ROAD.HILL.NONE);
    addHill(ROAD.LENGTH.LONG, -ROAD.HILL.HIGH);
    addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW);
    addBumps();
    addHill(ROAD.LENGTH.LONG, -ROAD.HILL.MEDIUM);
    addStraight();
    addSCurves();
    addDownhillToEnd();
    
    resetSprites();
    resetCreatures();
    resetObjects();
    
    segments[findSegment(playerZ).index + 2].color = COLORS.START;
    segments[findSegment(playerZ).index + 3].color = COLORS.START;
    for (var n = 0; n < rumbleLength; n++)
      segments[segments.length - 1 - n].color = COLORS.FINISH;
  
    trackLength = segments.length * segmentLength;
  }
  
  function resetSprites() {
    var n, i;
  
    addSprite(20, SPRITES.BILLBOARD007, -1);
    addSprite(40, SPRITES.BILLBOARD007, -1);
    addSprite(60, SPRITES.BILLBOARD007, -1);
    addSprite(80, SPRITES.BILLBOARD007, -1);
    addSprite(100, SPRITES.BILLBOARD007, -1);
    addSprite(120, SPRITES.BILLBOARD007, -1);
    addSprite(140, SPRITES.BILLBOARD007, -1);
    addSprite(160, SPRITES.BILLBOARD007, -1);
    addSprite(180, SPRITES.BILLBOARD007, -1);
    
    addSprite(240, SPRITES.BILLBOARD007, -1.2);
    addSprite(240, SPRITES.BILLBOARD007, 1.2);
    addSprite(segments.length - 25, SPRITES.BILLBOARD007, -1.2);
    addSprite(segments.length - 25, SPRITES.BILLBOARD007, 1.2);
  
    for (n = 10; n < 200; n += 4 + Math.floor(n / 100)) {
      addSprite(n, SPRITES.PALM_TREE, 0.5 + Math.random() * 0.5);
      addSprite(n, SPRITES.PALM_TREE, 1 + Math.random() * 2);
    }
  
    for (n = 250; n < 1000; n += 5) {
      addSprite(n, SPRITES.COLUMN, 1.1);
      addSprite(n + Util.randomInt(0, 5), SPRITES.TREE1, -1 - (Math.random() * 2));
      addSprite(n + Util.randomInt(0, 5), SPRITES.TREE2, -1 - (Math.random() * 2));
    }
  
    for (n = 200; n < segments.length; n += 1) {
      addSprite(n, Util.randomChoice(SPRITES.PLANTS), Util.randomChoice([1, -1]) * (2 + Math.random() * 5));
    }
  
    var side, sprite, offset;
    for (n = 1000; n < (segments.length - 50); n += 100) {
      side = Util.randomChoice([1, -1]);
      addSprite(n + Util.randomInt(0, 50), Util.randomChoice(SPRITES.BILLBOARDS), -side);
      for (i = 0; i < 10; i++) {
        sprite = Util.randomChoice(SPRITES.PLANTS);
        offset = side * (1.5 + Math.random());
        addSprite(n + Util.randomInt(0, 50), sprite, offset);
      }
    }
  }
  
  function resetCreatures() {
    creatures = [];
    var n, creature, segment, offset, z, sprite, speed;
    for (var n = 0; n < totalCreatures; n++) {
      offset = Math.random() * Util.randomChoice([-0.8, 0.8]);
      z = Math.floor(Math.random() * segments.length) * segmentLength;
      sprite = Util.randomChoice(SPRITES.CREATURES);
      speed = maxSpeed / 4 + Math.random() * maxSpeed / (sprite == SPRITES.TROLL ? 4 : 2);
      creature = { offset: offset, z: z, sprite: sprite, speed: speed };
      segment = findSegment(creature.z);
      segment.creatures.push(creature);
      creatures.push(creature);
    }
  }
  
  function resetObjects() {
    objects = [];
    score = 0;
    var n, coin, nitro, segment, offset, z;
  
    for (i = 0; i < segments.length; i++)
      segments[i].object = null;
    
    for (var n = 0; n < totalCoins; n++) {
      offset = Math.random() * Util.randomChoice([-0.7, 0.7]);
      z = getValidZ("coin");
      coin = { offset: offset, z: z, source: SPRITES.COIN };
      segment = findSegment(coin.z);
      segment.object = coin;
      objects.push(coin);
    }
    
    for (var n = 0; n < totalNitros; n++) {
      offset = Math.random() * Util.randomChoice([-0.7, 0.7]);
      z = getValidZ("nitro")
      nitro = { offset: offset, z: z, source: SPRITES.NITRO};
      segment = findSegment(nitro.z);
      segment.object = nitro;
      objects.push(nitro);
    }
  }
  
  function getValidZ(targetName) {
    var tooClose, isOutOfRange, interval
    var coinSeparation = 7500; 
    var nitroSeparation = 100000; 
    var startSegment = 180;
    var endSegment = targetName === "coin" ? 50 : 300;
  
    do {
      z = Math.floor(Math.random() * segments.length) * segmentLength;
    
      // Check if the new z value is too close to any existing objects
      tooClose = objects.some(existingObject => {
        interval = (
          existingObject.source === SPRITES.NITRO && 
          targetName						=== "nitro"
        ) ? nitroSeparation : coinSeparation;
        return Math.abs(existingObject.z - z) < interval;
      });
  
      // Check if the new z value is within the desired segment range
      isOutOfRange = findSegment(z).index < startSegment ||
                      findSegment(z).index > segments.length - endSegment;
    
    } while (tooClose || isOutOfRange || findSegment(z).object); // Keep generating new z values until we find one that's not too close to other nitros and within the desired range
    return z;
  }
  
  //=========================================================================
  // THE GAME LOOP
  //=========================================================================
  
  Game.run({
    canvas: canvas, render: render, update: update, step: step,
    images: ["background", "sprites"],
    keys: [
      { keys: [KEY.LEFT, KEY.A], div: 'gamepad-left', mode: 'down', action: function () { keyLeft = true; } },
      { keys: [KEY.RIGHT, KEY.D], div: 'gamepad-right', mode: 'down', action: function () { keyRight = true; } },
      { keys: [KEY.UP, KEY.W], div: 'gamepad-up', mode: 'down', action: function () { keyFaster = true; } },
      { keys: [KEY.DOWN, KEY.S], div: 'gamepad-down', mode: 'down', action: function () { keySlower = true; } },
      { keys: [KEY.LEFT, KEY.A], div: 'gamepad-left', mode: 'up', action: function () { keyLeft = false; } },
      { keys: [KEY.RIGHT, KEY.D], div: 'gamepad-right', mode: 'up', action: function () { keyRight = false; } },
      { keys: [KEY.UP, KEY.W], div: 'gamepad-up', mode: 'up', action: function () { keyFaster = false; } },
      { keys: [KEY.DOWN, KEY.S], div: 'gamepad-down', mode: 'up', action: function () { keySlower = false; } }
    ],
    ready: function (images) {
      background = images[0];
      sprites = images[1];
      reset();
      Dom.storage.fast_lap_time = Dom.storage.fast_lap_time || 180;
      updateHud('fast_lap_time', formatTime(Util.toFloat(Dom.storage.fast_lap_time)));
    },
    scaleRacer: scaleRacer,
  });
  
  function reset(options) {
    options = options || {};
    canvas.width = width = Util.toInt(options.width, width);
    canvas.height = height = Util.toInt(options.height, height);
    lanes = Util.toInt(options.lanes, lanes);
    roadWidth = Util.toInt(options.roadWidth, roadWidth);
    cameraHeight = Util.toInt(options.cameraHeight, cameraHeight);
    drawDistance = Util.toInt(options.drawDistance, drawDistance);
    fogDensity = Util.toInt(options.fogDensity, fogDensity);
    fieldOfView = Util.toInt(options.fieldOfView, fieldOfView);
    segmentLength = Util.toInt(options.segmentLength, segmentLength);
    rumbleLength = Util.toInt(options.rumbleLength, rumbleLength);
    cameraDepth = 1 / Math.tan((fieldOfView / 2) * Math.PI / 180);
    playerZ = (cameraHeight * cameraDepth);
    resolution = height / 480;
    
    if ((segments.length == 0) || (options.segmentLength) || (options.rumbleLength))
      resetRoad(); // only rebuild road when necessary
  }
  
  //=========================================================================
  // MOBILE RESCALING FUNCTIONS
  //=========================================================================
  
  function scaleRacer() {
    var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints;
    var racer = Dom.get('racer');
    var mute = Dom.get('mute');
    var hud = Dom.get('hud');
    var gamepad = Dom.get('gamepad');
    var fast_lap_time = Dom.get('fast_lap_time');
    var leaderboard = Dom.get("leaderboard-container");
    const leaderboardButton = Dom.get("leaderboard-button");
    var rightButtons = document.querySelector('.right-buttons');
    var leftButtons = document.querySelector('.left-buttons');
    var container = document.querySelector('.container'); 
      
    if (isMobile) {
      reset({ width: 640, height: 480 });
      createGamepad();
      
      if (window.innerHeight > window.innerWidth) 
        // Portrait mode adjustments
        setStylesForPortraitMode(racer, mute, hud, gamepad, rightButtons, leftButtons, fast_lap_time);
      else 
        // Landscape mode adjustments
        setStylesForLandscapeMode(racer, mute, hud, gamepad, rightButtons, leftButtons, fast_lap_time);
        
        // Disable the container styles and the leaderboard for mobile
        container.classList.remove('container');
        leaderboardButton.style.display = 'none';
    } else {
      // Desktop adjustments
      setStylesForDesktop(container, racer, mute, hud, fast_lap_time, leaderboard);

      // Enable the container styles and leaderboard for desktop
      container.classList.add('container');
      leaderboardButton.style.display = 'block';
    }
  }
  
  function setStylesForPortraitMode(racer, mute, hud, gamepad, rightButtons, leftButtons, fast_lap_time) {
    fast_lap_time.style.width = '10em'
    hud.style.fontSize = '1.5em';
    racer.style.transform = 'scale(1)';
    racer.style.marginTop = '0%';
    racer.style.marginLeft = '0%';
    mute.style.marginLeft = '2%';
    mute.style.marginTop = '78%';
    mute.style.transform = 'scale(2.5)';
    gamepad.style.transform = 'scale(2)';
    gamepad.style.width = '40%';
    rightButtons.style.marginLeft = '115%';
    rightButtons.style.marginTop = '130%';
    leftButtons.style.marginLeft = '30%';
    leftButtons.style.marginTop = '190%';
    leftButtons.style.position = rightButtons.style.position = 'absolute';
  }
  
  function setStylesForLandscapeMode(racer, mute, hud, gamepad, rightButtons, leftButtons, fast_lap_time) {
    fast_lap_time.style.width = '10em'
    hud.style.fontSize = '1.5em';
    racer.style.transform = 'scale(0.6)';
    racer.style.marginTop = '-15%';
    racer.style.marginLeft = '9%';
    mute.style.marginLeft = '102%';
    mute.style.marginTop = '1%';
    mute.style.transform = 'scale(2.5)';
    gamepad.style.transform = 'scale(1)';
    gamepad.style.width = '100%';
    rightButtons.style.marginLeft = '94%';
    rightButtons.style.marginTop = '13%';
    leftButtons.style.marginLeft = '1.5%';
    leftButtons.style.marginTop = '26%';
    leftButtons.style.position = rightButtons.style.position = 'absolute';
  }
  
  function setStylesForDesktop(container, racer, mute, hud, fast_lap_time, leaderboard) {
    // Define constants for target dimensions
    const containerHeight = 900;
    const containerWidth = isLeaderboardVisible ? 1700 : 1200;
      
    // Calculate scale factors for height and width
    const heightScale = Math.min(window.innerHeight / containerHeight, 1);
    const widthScale = Math.min(window.innerWidth / containerWidth, 1);
  
    // Apply container scaling
    container.style.transform = `scale(${Math.min(heightScale, widthScale)})`;
    
    // Set styles for other elements
    fast_lap_time.style.width = '11em';
    hud.style.fontSize = '1.3em';
    racer.style.transform = 'scale(1)';
    racer.style.marginTop = '';
    racer.style.marginLeft = isLeaderboardVisible === false ? '0px' : '540px';
    mute.style.marginLeft = '1040px';
    mute.style.marginTop = '0.5em';
    mute.style.transform = 'scale(2)';
  
    // Calculate and apply container margin-top
    const racerHeight = racer.getBoundingClientRect().height;
    const containerMarginTop = (racerHeight / 2) + (window.innerHeight - racerHeight) / 3;
    container.style.marginTop = `${containerMarginTop}px`;
  }
  
  
  function createGamepad() {
    var existingGamepad = Dom.get('gamepad');
  
    if (!existingGamepad) {
      var gamepadHTML = `
        <div id='gamepad'>
          <div class='left-buttons'>
            <div id='gamepad-left' class='gamepad-button'><span><</span></div>
            <div id='gamepad-right' class='gamepad-button'><span>></span></div>
          </div>
          <div class='right-buttons'>
            <div id='gamepad-up' class='gamepad-button'><span>ʌ</span></div>
            <div id='gamepad-down' class='gamepad-button'><span>v</span></div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', gamepadHTML);
    }
  }
  
  // Disable zoom on double-touch gestures
  document.addEventListener('touchend', function(event) {
    var now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  document.addEventListener("DOMContentLoaded", scaleRacer);
  window.addEventListener("resize", scaleRacer);
  
  //=========================================================================
  // API Functions
  //=========================================================================
  
  function startGameAPI() {
    auth_token = localStorage.getItem("auth_token");
    console.log("auth token:", auth_token);
    const data = {
      auth_token: auth_token,
    };
    const response = fetch(
      "https://pvrgwmyaxynklimiusly.functions.supabase.co/game_token",
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    ).then(async (response) => {
      if (response.ok) {
        console.log("Data sent successfully!");
        responseBody = await response.text();
      } else {
        console.log(
          "Error sending data:",
          response.statusText
        );
      }
    }).then((responseData) => {
      const response_token = responseBody;
      localStorage.setItem("game_token", response_token);
      console.log("Data sent! game_token:", response_token);
    }).catch((error) => {
      console.error("Network error:", error);
    });
  }
  
  function endGameAPI(lap_time) {
    const data = {
      game_token: localStorage.getItem("game_token"),
      lap_time: lap_time,
      btcAddress: localStorage.getItem("btcAddress"),
    };
    console.log("data:", data);
    fetch(
      "https://pvrgwmyaxynklimiusly.functions.supabase.co/end_game",
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    ).then((response) => {
      console.log("sent verification request-->", response);
      if (response.ok) {
        console.log(
          "response status end:",
          response.statusText
        );
        console.log("Data sent successfully!");
      } else {
        console.log(
          "Error sending data:",
          response.statusText
        );
      }
    }).catch((error) => {
      console.error("Network error:", error);
    });
  }
  
  async function fetchLeaderboard() {
    try {
      const response = await fetch(
        "https://pvrgwmyaxynklimiusly.supabase.co/functions/v1/leaderboard",
        {
          method: "GET",
          headers: {
            Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
          },
        }
      );
      if (!response.ok)
        throw new Error("Network response was not ok");
      else 
        return await response.json();
    } catch (error) {
      console.error("Network error:", error);
      return null;
    }
  }
  
  //=========================================================================
  // Leaderboard Rendering
  //=========================================================================
  
  const leaderboardContainer = Dom.get("leaderboard-container");
  const leaderboardButton = document.getElementById("leaderboard-button");
  
  leaderboardButton.addEventListener("click", () => {
    if (isLeaderboardVisible === false) {
      // Show the leaderboard container
      leaderboardContainer.style.display = "block";
      isLeaderboardVisible = true;
      
    } else {
      // Hide the leaderboard container
      leaderboardContainer.style.display = "none";
      isLeaderboardVisible = false;
    }
    scaleRacer()
  });
  
  async function updateLeaderboard () {		  
    const topScores = await fetchLeaderboard();
    console.log("leaderboard json:", topScores);
    
    const headerHTML = `
    <div class="leaderboard-entry">
      <span class="rank">#</span>
      <span class="btc-address">Racer</span>
      <span class="score">Fastest Lap</span>
    </div> <div class="line-separator"></div>`;
        
    // Create the leaderboard entry rows
    const leaderboardHTML = topScores
    .map(
      (entry, index) =>
      `<div class="leaderboard-entry">
        <span class="rank">${index + 1}</span>
        <span class="btc-address">${entry.btcAddress}</span>
        <span class="score">${formatTime(entry.fast_lap)}</span>
        </div>`
    )
    .join("");
    
    // Combine header row and leaderboard entry rows
    leaderboardContainer.innerHTML = headerHTML + leaderboardHTML;
  };
  
  updateLeaderboard();
    
  // Update the leaderboard every minute
  setInterval(updateLeaderboard, 60000);
}