async function racer() {
	// common.js  v
	//=========================================================================
	// minimalist DOM helpers
	//=========================================================================

	var Dom = {
		get: function (id) {
			return id instanceof HTMLElement || id === document
				? id
				: document.getElementById(id);
		},
		set: function (id, html) {
			Dom.get(id).innerHTML = html;
		},
		on: function (ele, type, fn, capture) {
			Dom.get(ele).addEventListener(type, fn, capture);
		},
		un: function (ele, type, fn, capture) {
			Dom.get(ele).removeEventListener(type, fn, capture);
		},
		show: function (ele, type) {
			Dom.get(ele).style.display = type || "block";
		},
		blur: function (ev) {
			ev.target.blur();
		},

		addClassName: function (ele, name) {
			Dom.toggleClassName(ele, name, true);
		},
		removeClassName: function (ele, name) {
			Dom.toggleClassName(ele, name, false);
		},
		toggleClassName: function (ele, name, on) {
			ele = Dom.get(ele);
			var classes = ele.className.split(" ");
			var n = classes.indexOf(name);
			on = typeof on == "undefined" ? n < 0 : on;
			if (on && n < 0) classes.push(name);
			else if (!on && n >= 0) classes.splice(n, 1);
			ele.className = classes.join(" ");
		},

		storage: window.localStorage || {},
	};

	//=========================================================================
	// general purpose helpers (mostly math)
	//=========================================================================

	var Util = {
		timestamp: function () {
			return new Date().getTime();
		},
		toInt: function (obj, def) {
			if (obj !== null) {
				var x = parseInt(obj, 10);
				if (!isNaN(x)) return x;
			}
			return Util.toInt(def, 0);
		},
		toFloat: function (obj, def) {
			if (obj !== null) {
				var x = parseFloat(obj);
				if (!isNaN(x)) return x;
			}
			return Util.toFloat(def, 0.0);
		},
		limit: function (value, min, max) {
			return Math.max(min, Math.min(value, max));
		},
		randomInt: function (min, max) {
			return Math.round(Util.interpolate(min, max, Math.random()));
		},
		randomChoice: function (options) {
			return options[Util.randomInt(0, options.length - 1)];
		},
		percentRemaining: function (n, total) {
			return (n % total) / total;
		},
		accelerate: function (v, accel, dt) {
			return v + accel * dt;
		},
		interpolate: function (a, b, percent) {
			return a + (b - a) * percent;
		},
		easeIn: function (a, b, percent) {
			return a + (b - a) * Math.pow(percent, 2);
		},
		easeOut: function (a, b, percent) {
			return a + (b - a) * (1 - Math.pow(1 - percent, 2));
		},
		easeInOut: function (a, b, percent) {
			return a + (b - a) * (-Math.cos(percent * Math.PI) / 2 + 0.5);
		},
		exponentialFog: function (distance, density) {
			return 1 / Math.pow(Math.E, distance * distance * density);
		},

		increase: function (start, increment, max) {
			// with looping
			var result = start + increment;
			while (result >= max) result -= max;
			while (result < 0) result += max;
			return result;
		},

		project: function (
			p,
			cameraX,
			cameraY,
			cameraZ,
			cameraDepth,
			width,
			height,
			roadWidth
		) {
			p.camera.x = (p.world.x || 0) - cameraX;
			p.camera.y = (p.world.y || 0) - cameraY;
			p.camera.z = (p.world.z || 0) - cameraZ;
			p.screen.scale = cameraDepth / p.camera.z;
			p.screen.x = Math.round(
				width / 2 + (p.screen.scale * p.camera.x * width) / 2
			);
			p.screen.y = Math.round(
				height / 2 - (p.screen.scale * p.camera.y * height) / 2
			);
			p.screen.w = Math.round((p.screen.scale * roadWidth * width) / 2);
		},

		overlap: function (x1, w1, x2, w2, percent) {
			var half = (percent || 1) / 2;
			var min1 = x1 - w1 * half;
			var max1 = x1 + w1 * half;
			var min2 = x2 - w2 * half;
			var max2 = x2 + w2 * half;
			return !(max1 < min2 || min1 > max2);
		},
	};

	//=========================================================================
	// POLYFILL for requestAnimationFrame
	//=========================================================================

	if (!window.requestAnimationFrame) {
		// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
		window.requestAnimationFrame =
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			function (callback, element) {
				window.setTimeout(callback, 1000 / 60);
			};
	}

	//=========================================================================
	// GAME LOOP helpers
	//=========================================================================

	var Game = {
		// a modified version of the game loop from my previous boulderdash game - see http://codeincomplete.com/posts/2011/10/25/javascript_boulderdash/#gameloop

		run: function (options) {
			Game.loadImages(options.images, function (images) {
				options.ready(images); // tell caller to initialize itself because images are loaded and we're ready to rumble

				Game.setKeyListener(options.keys);

				Game.setDivListener(options.keys);

				var canvas = options.canvas, // canvas render target is provided by caller
					update = options.update, // method to update game logic is provided by caller
					render = options.render, // method to render the game is provided by caller
					step = options.step, // fixed frame step (1/fps) is specified by caller
					now = null,
					last = Util.timestamp(),
					dt = 0,
					gdt = 0;

				function frame() {
					now = Util.timestamp();
					dt = Math.min(1, (now - last) / 1000); // using requestAnimationFrame have to be able to handle large delta's caused when it 'hibernates' in a background or non-visible tab
					gdt = gdt + dt;
					while (gdt > step) {
						gdt = gdt - step;
						update(step);
					}
					render();
					last = now;
					requestAnimationFrame(frame, canvas);
				}
				frame(); // lets get this party started
			});
		},

		//---------------------------------------------------------------------------

		loadImages: function (names, callback) {
			// load multiple images and callback when ALL images have loaded
			var result = [];
			var count = names.length;

			var onload = function () {
				if (--count == 0) callback(result);
			};

			for (var n = 0; n < names.length; n++) {
				var name = names[n];
				result[n] = document.createElement("img");
				Dom.on(result[n], "load", onload);
				result[n].src = "images/" + name + ".png";
			}
		},

		//---------------------------------------------------------------------------

		setKeyListener: function (keys) {
			var onkey = function (keyCode, mode) {
				var n, k;
				for (n = 0; n < keys.length; n++) {
					k = keys[n];
					k.mode = k.mode || "up";
					if (
						k.key == keyCode ||
						(k.keys && k.keys.indexOf(keyCode) >= 0)
					) {
						if (k.mode == mode) {
							k.action.call();
						}
					}
				}
			};
			Dom.on(document, "keydown", function (ev) {
				onkey(ev.keyCode, "down");
			});
			Dom.on(document, "keyup", function (ev) {
				onkey(ev.keyCode, "up");
			});
		},

		//---------------------------------------------------------------------------

		setDivListener: function (keys) {
			// Setup listeners on div to activate functions (for mobile devices)
			var n, k;
			for (n = 0; n < keys.length; n++) {
				k = keys[n];
				if (k.div) {
					elt = document.getElementById(k.div);
					if (elt) {
						// if the specified div element does not exist, just skip (probably the gamepad is not coded in the html)
						if (k.mode == "up") {
							elt.onmouseup = k.action;
							elt.addEventListener("mouseup", k.action);
							elt.addEventListener("touchend", k.action);
						} else {
							elt.onmousedown = k.action; // fallback for old devices
							elt.addEventListener("mousedown", k.action);
							elt.addEventListener("touchstart", k.action);
						}
					}
				}
			}
		},

		//---------------------------------------------------------------------------

		playMusic: function () {
			var music = Dom.get("music");
			music.volume = 0.05; // shhhh! annoying music!
			music.muted = !music.muted;
			if (!music.muted) {
				music.play();
				Dom.toggleClassName("mute", "on", music.muted);
			} else {
				music.pause();
				Dom.toggleClassName("mute", "on", music.muted);
			}
		},
	};

	//=========================================================================
	// canvas rendering helpers
	//=========================================================================

	var Render = {
		polygon: function (ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.lineTo(x3, y3);
			ctx.lineTo(x4, y4);
			ctx.closePath();
			ctx.fill();
		},

		//---------------------------------------------------------------------------

		segment: function (
			ctx,
			width,
			lanes,
			x1,
			y1,
			w1,
			x2,
			y2,
			w2,
			fog,
			color
		) {
			var r1 = Render.rumbleWidth(w1, lanes),
				r2 = Render.rumbleWidth(w2, lanes),
				l1 = Render.laneMarkerWidth(w1, lanes),
				l2 = Render.laneMarkerWidth(w2, lanes),
				lanew1,
				lanew2,
				lanex1,
				lanex2,
				lane;

			ctx.fillStyle = color.grass;
			ctx.fillRect(0, y2, width, y1 - y2);

			Render.polygon(
				ctx,
				x1 - w1 - r1,
				y1,
				x1 - w1,
				y1,
				x2 - w2,
				y2,
				x2 - w2 - r2,
				y2,
				color.rumble
			);
			Render.polygon(
				ctx,
				x1 + w1 + r1,
				y1,
				x1 + w1,
				y1,
				x2 + w2,
				y2,
				x2 + w2 + r2,
				y2,
				color.rumble
			);
			Render.polygon(
				ctx,
				x1 - w1,
				y1,
				x1 + w1,
				y1,
				x2 + w2,
				y2,
				x2 - w2,
				y2,
				color.road
			);

			if (color.lane) {
				lanew1 = (w1 * 2) / lanes;
				lanew2 = (w2 * 2) / lanes;
				lanex1 = x1 - w1 + lanew1;
				lanex2 = x2 - w2 + lanew2;
				for (
					lane = 1;
					lane < lanes;
					lanex1 += lanew1, lanex2 += lanew2, lane++
				)
					Render.polygon(
						ctx,
						lanex1 - l1 / 2,
						y1,
						lanex1 + l1 / 2,
						y1,
						lanex2 + l2 / 2,
						y2,
						lanex2 - l2 / 2,
						y2,
						color.lane
					);
			}

			Render.fog(ctx, 0, y1, width, y2 - y1, fog);
		},

		//---------------------------------------------------------------------------

		background: function (
			ctx,
			background,
			width,
			height,
			layer,
			rotation,
			offset
		) {
			rotation = rotation || 0;
			offset = offset || 0;

			var imageW = layer.w / 2;
			var imageH = layer.h;

			var sourceX = layer.x + Math.floor(layer.w * rotation);
			var sourceY = layer.y;
			var sourceW = Math.min(imageW, layer.x + layer.w - sourceX);
			var sourceH = imageH;

			var destX = 0;
			var destY = offset;
			var destW = Math.floor(width * (sourceW / imageW));
			var destH = height;

			ctx.drawImage(
				background,
				sourceX,
				sourceY,
				sourceW,
				sourceH,
				destX,
				destY,
				destW,
				destH
			);
			if (sourceW < imageW)
				ctx.drawImage(
					background,
					layer.x,
					sourceY,
					imageW - sourceW,
					sourceH,
					destW - 1,
					destY,
					width - destW,
					destH
				);
		},

		//---------------------------------------------------------------------------

		sprite: function (
			ctx,
			width,
			height,
			resolution,
			roadWidth,
			sprites,
			sprite,
			scale,
			destX,
			destY,
			offsetX,
			offsetY,
			clipY
		) {
			//  scale for projection AND relative to roadWidth (for tweakUI)
			var destW =
				((sprite.w * scale * width) / 2) * (SPRITES.SCALE * roadWidth);
			var destH =
				((sprite.h * scale * width) / 2) * (SPRITES.SCALE * roadWidth);

			destX = destX + destW * (offsetX || 0);
			destY = destY + destH * (offsetY || 0);

			var clipH = clipY ? Math.max(0, destY + destH - clipY) : 0;
			if (clipH < destH)
				ctx.drawImage(
					sprites,
					sprite.x,
					sprite.y,
					sprite.w,
					sprite.h - (sprite.h * clipH) / destH,
					destX,
					destY,
					destW,
					destH - clipH
				);
		},

		//---------------------------------------------------------------------------

		player: function (
			ctx,
			width,
			height,
			resolution,
			roadWidth,
			sprites,
			speedPercent,
			scale,
			destX,
			destY,
			steer,
			updown
		) {
			var bounce =
				1.5 *
				Math.random() *
				speedPercent *
				resolution *
				Util.randomChoice([-1, 1]);
			var sprite;
			if (steer < 0)
				sprite =
					updown > 0
						? SPRITES.PLAYER_UPHILL_LEFT
						: SPRITES.PLAYER_LEFT;
			else if (steer > 0)
				sprite =
					updown > 0
						? SPRITES.PLAYER_UPHILL_RIGHT
						: SPRITES.PLAYER_RIGHT;
			else
				sprite =
					updown > 0
						? SPRITES.PLAYER_UPHILL_STRAIGHT
						: SPRITES.PLAYER_STRAIGHT;

			Render.sprite(
				ctx,
				width,
				height,
				resolution,
				roadWidth,
				sprites,
				sprite,
				scale,
				destX,
				destY + bounce,
				-0.5,
				-1
			);
		},

		//---------------------------------------------------------------------------

		fog: function (ctx, x, y, width, height, fog) {
			if (fog < 1) {
				ctx.globalAlpha = 1 - fog;
				ctx.fillStyle = COLORS.FOG;
				ctx.fillRect(x, y, width, height);
				ctx.globalAlpha = 1;
			}
		},

		rumbleWidth: function (projectedRoadWidth, lanes) {
			return projectedRoadWidth / Math.max(6, 2 * lanes);
		},
		laneMarkerWidth: function (projectedRoadWidth, lanes) {
			return projectedRoadWidth / Math.max(32, 8 * lanes);
		},
	};

	//=============================================================================
	// RACING GAME CONSTANTS
	//=============================================================================

	var KEY = {
		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40,
		A: 65,
		D: 68,
		S: 83,
		W: 87,
	};

	var COLORS = {
		SKY: "#72D7EE",
		TREE: "#005108",
		FOG: "#9cbdd6",
		LIGHT: {
			road: "#82593d",
			grass: "#618242",
			rumble: "#ffffff",
			lane: "#ffffff",
		},
		DARK: { road: "#7c5539", grass: "#5a7c39", rumble: "#ffffff" },
		START: { road: "#ffffff", grass: "white", rumble: "white" },
		FINISH: { road: "black", grass: "black", rumble: "black" },
	};

	/* var COLORS = {
SKY: '#72D7EE',
TREE: '#005108',
FOG: '#9cbdd6',
LIGHT: { road: '#c272d6', grass: '#9cbdd6', rumble: '#555555', lane: '#CCCCCC' },
DARK: { road: '#b253c9', grass: '#9cbdd6', rumble: '#BBBBBB' },
START: { road: '#white', grass: 'white', rumble: 'white' },
FINISH: { road: 'black', grass: 'black', rumble: 'black' }
};*/

	var BACKGROUND = {
		// HILLS: { x: 5, y: 5, w: 1280, h: 480 },
		SKY: { x: 5, y: 495, w: 1280, h: 700 },
		TREES: { x: 5, y: 985, w: 1280, h: 500 },
	};

	var SPRITES = {
		PALM_TREE: { x: 5, y: 5, w: 215, h: 540 },
		BILLBOARD08: { x: 230, y: 5, w: 385, h: 265 },
		TREE1: { x: 625, y: 5, w: 360, h: 360 },
		DEAD_TREE1: { x: 5, y: 555, w: 135, h: 332 },
		BILLBOARD09: { x: 150, y: 555, w: 328, h: 282 },
		BOULDER3: { x: 230, y: 280, w: 320, h: 220 },
		COLUMN: { x: 995, y: 5, w: 200, h: 315 },
		BILLBOARD01: { x: 625, y: 375, w: 300, h: 170 },
		BILLBOARD06: { x: 488, y: 555, w: 298, h: 190 },
		BILLBOARD05: { x: 5, y: 897, w: 298, h: 190 },
		BILLBOARD007: { x: 305, y: 890, w: 290, h: 190 },
		BOULDER2: { x: 621, y: 897, w: 298, h: 140 },
		TREE2: { x: 1205, y: 5, w: 282, h: 295 },
		BILLBOARD04: { x: 1205, y: 310, w: 268, h: 170 },
		DEAD_TREE2: { x: 1205, y: 490, w: 150, h: 260 },
		BOULDER1: { x: 1205, y: 760, w: 168, h: 248 },
		BUSH1: { x: 5, y: 1097, w: 240, h: 155 },
		CACTUS: { x: 929, y: 897, w: 235, h: 118 },
		BUSH2: { x: 255, y: 1097, w: 232, h: 152 },
		BILLBOARD03: { x: 5, y: 1262, w: 230, h: 220 },
		BILLBOARD02: { x: 245, y: 1262, w: 215, h: 220 },
		STUMP: { x: 995, y: 330, w: 195, h: 140 },
		PLAYER_UPHILL_LEFT: { x: 997, y: 479, w: 81, h: 55 },
		PLAYER_UPHILL_STRAIGHT: { x: 1085, y: 480, w: 81, h: 55 },
		PLAYER_UPHILL_RIGHT: { x: 995, y: 556, w: 81, h: 55 },
		PLAYER_LEFT: { x: 997, y: 479, w: 81, h: 50 },
		PLAYER_STRAIGHT: { x: 1084, y: 480, w: 81, h: 50 },
		PLAYER_RIGHT: { x: 995, y: 556, w: 81, h: 50 },
		COIN: { x: 1380, y: 1085, w: 92, h: 86 },
		NITRO: { x: 1380, y: 1170, w: 85, h: 100 },
		ARCHER: { x: 1205, y: 1080, w: 67, h: 80 },
		TROLLFACE: { x: 1365, y: 650, w: 105, h: 95 },
		TROLL: { x: 1350, y: 540, w: 126, h: 106 },
		BROWN_DRAGON: { x: 1093, y: 1080, w: 100, h: 80 },
	};

	SPRITES.SCALE = 0.3 * (1 / SPRITES.PLAYER_STRAIGHT.w); // the reference sprite width should be 1/3rd the (half-)roadWidth

	SPRITES.BILLBOARDS = [
		SPRITES.BILLBOARD01,
		SPRITES.BILLBOARD007,
		SPRITES.BILLBOARD08,
		SPRITES.BILLBOARD05,
		SPRITES.BILLBOARD09,
		SPRITES.BILLBOARD06,
	];
	SPRITES.PLANTS = [
		SPRITES.TREE1,
		SPRITES.TREE2,
		SPRITES.DEAD_TREE1,
		SPRITES.DEAD_TREE2,
		SPRITES.PALM_TREE,
		SPRITES.BUSH1,
		SPRITES.BUSH2,
		SPRITES.CACTUS,
		SPRITES.STUMP,
		SPRITES.BOULDER1,
		SPRITES.BOULDER2,
		SPRITES.BOULDER3,
	];
	SPRITES.CREATURES = [SPRITES.TROLLFACE, SPRITES.ARCHER, SPRITES.TROLL];

	/////
	// START OF RACER.JS
	//////

	var fps = 60; // how many 'update' frames per second
	var step = 1 / fps; // how long is each frame (in seconds)
	var width = 1024; // logical canvas width
	var height = 768; // logical canvas height
	var centrifugal = 0.3; // centrifugal force multiplier when going around curves
	var offRoadDecel = 0.99; // speed multiplier when off road (e.g. you lose 2% speed each update frame)
	var skySpeed = 0.001; // background sky layer scroll speed when going around curve (or up hill)
	var hillSpeed = 0.002; // background hill layer scroll speed when going around curve (or up hill)
	var treeSpeed = 0.003; // background tree layer scroll speed when going around curve (or up hill)
	var skyOffset = 0; // current sky scroll offset
	var hillOffset = 0; // current hill scroll offset
	var treeOffset = 0; // current tree scroll offset
	var segments = []; // array of road segments
	var creatures = []; // array of creatures on the road
	var objects = [];
	var score = 0; // current score
	var canvas = Dom.get("canvas"); // our canvas...
	var ctx = canvas.getContext("2d"); // ...and its drawing context
	var background = null; // our background image (loaded below)
	var sprites = null; // our spritesheet (loaded below)
	var resolution = null; // scaling factor to provide resolution independence (computed)
	var roadWidth = 2000; // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
	var segmentLength = 200; // length of a single segment
	var rumbleLength = 3; // number of segments per red/white rumble strip
	var trackLength = null; // z length of entire track (computed)
	var lanes = 3; // number of lanes
	var fieldOfView = 100; // angle (degrees) for field of view
	var cameraHeight = 1000; // z height of camera
	var cameraDepth = null; // z distance camera is from screen (computed)
	var drawDistance = 300; // number of segments to draw
	var playerX = 0; // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
	var playerZ = null; // player relative z distance from camera (computed)
	var fogDensity = 5; // exponential fog density
	var position = 0; // current camera Z position (add playerZ to get player's absolute Z position)
	var speed = 0; // current speed
	var maxSpeed = segmentLength / step; // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
	var accel = maxSpeed / 5; // acceleration rate - tuned until it 'felt' right
	var breaking = -maxSpeed; // deceleration rate when braking
	var decel = -maxSpeed / 5; // 'natural' deceleration rate when neither accelerating, nor braking
	var offRoadDecel = -maxSpeed / 2; // off road deceleration is somewhere in between
	var offRoadLimit = maxSpeed / 4; // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)
	var totalCreatures = 200; // total number of creatures on the road
	var totalCoins = 20; // total number of coins on the road
	var totalNitros = 3; // total number of nitros on the road
	var currentLapTime = 0; // current lap time
	var lastLapTime = null; // last lap time
	let lastTouchEnd = 0; // count times screen is touched
	let firstLapStarted = false;
	let isLeaderboardVisible = false; // Keep track of visibility state

	// Nitro variables
	var turboDuration = 5; // duration of turbo in seconds
	var turboAnimation = 1; // duration of animation to do progressive increase/decrease of fov
	var turboFovIncrement = 1.4; // multiplier of fov during turbo
	var turboMaxSpeed = maxSpeed * 1.4; // maximum speed under turbo
	var turboCentrifugal = centrifugal / 2; // torque when under turbo (else the player cannot turn in curves)
	var turboTriggered = false; // internal variable - turbo triggered by player?
	var turboTimeDone = 0.0; // internal variable - turbo being consumed, since how much time (allow to do animation and such)
	var turboCurrentFov = fieldOfView; // internal variable - current fov while doing turbo

	var keyLeft = false;
	var keyRight = false;
	var keyFaster = false;
	var keySlower = false;

	var hud = {
		speed: { value: null, dom: Dom.get("speed_value") },
		current_lap_time: {
			value: null,
			dom: Dom.get("current_lap_time_value"),
		},
		last_lap_time: { value: null, dom: Dom.get("last_lap_time_value") },
		fast_lap_time: { value: null, dom: Dom.get("fast_lap_time_value") },
		coins: { value: null, dom: Dom.get("coins_value") },
	};

	//=========================================================================
	// UPDATE THE GAME WORLD
	//=========================================================================

	async function update(dt) {
		var n,
			i,
			creature,
			creatureW,
			sprite,
			spriteW,
			object,
			objectW,
			overlap;
		var playerSegment = findSegment(position + playerZ);
		var playerW = SPRITES.PLAYER_STRAIGHT.w * SPRITES.SCALE;
		var speedPercent = speed / maxSpeed;
		var dx = dt * 2.15 * speedPercent; // at top speed, should be able to cross from left to right (-1 to 1) in 1 second
		var startPosition = position;
		var segmentObject = playerSegment.object;

		updateCreatures(dt, playerSegment, playerW);

		position = Util.increase(position, dt * speed, trackLength);

		if (keyLeft) playerX = playerX - dx;
		else if (keyRight) playerX = playerX + dx;

		if (turboTriggered) {
			playerX =
				playerX -
				dx * speedPercent * playerSegment.curve * turboCentrifugal;
		} else {
			playerX =
				playerX - dx * speedPercent * playerSegment.curve * centrifugal;
		}

		if (keyFaster) speed = Util.accelerate(speed, accel, dt);
		else if (keySlower) speed = Util.accelerate(speed, breaking, dt);
		else speed = Util.accelerate(speed, decel, dt);

		if (segmentObject) {
			objectW = segmentObject.source.w * SPRITES.SCALE;
			overlap = Util.overlap(
				playerX,
				playerW,
				segmentObject.offset,
				objectW,
				0.9
			);

			if (overlap) {
				if (segmentObject.source == SPRITES.COIN) collectCoin();
				else if (segmentObject.source == SPRITES.NITRO) triggerTurbo();
				playerSegment.object = null;
			}
		}

		if (playerX < -1 || playerX > 1) {
			if (speed > offRoadLimit)
				speed = Util.accelerate(speed, offRoadDecel, dt);

			for (n = 0; n < playerSegment.sprites.length; n++) {
				sprite = playerSegment.sprites[n];
				spriteW = sprite.source.w * SPRITES.SCALE;
				if (
					Util.overlap(
						playerX,
						playerW,
						sprite.offset +
						(spriteW / 2) * (sprite.offset > 0 ? 1 : -1),
						spriteW
					)
				) {
					speed = maxSpeed / 5;
					position = Util.increase(
						playerSegment.p1.world.z,
						-playerZ,
						trackLength
					); // stop in front of sprite (at front of segment)
					break;
				}
			}
		}

		for (n = 0; n < playerSegment.creatures.length; n++) {
			creature = playerSegment.creatures[n];
			creatureW = creature.sprite.w * SPRITES.SCALE;
			if (speed > creature.speed) {
				if (
					Util.overlap(
						playerX,
						playerW,
						creature.offset,
						creatureW,
						0.7
					)
				) {
					speed = creature.speed * (creature.speed / speed);
					position = Util.increase(creature.z, -playerZ, trackLength);
					break;
				}
			}
		}

		playerX = Util.limit(playerX, -3, 3);

		if (!turboTriggered) {
			speed = Util.limit(speed, 0, maxSpeed);
		} else {
			speed = Util.limit(speed, 0, turboMaxSpeed);
			accel = turboMaxSpeed / 3;
			turboTimeDone += dt;
			if (turboTimeDone < turboDuration) {
				if (turboTimeDone < turboAnimation) {
					turboFov = fieldOfView * turboFovIncrement;
					if (turboCurrentFov < turboFov) {
						turboCurrentFov +=
							(turboFov - fieldOfView) * (dt / turboAnimation);
						updateFOV(turboCurrentFov);
					}
				} else if (turboDuration <= turboTimeDone + turboAnimation) {
					if (turboCurrentFov > fieldOfView) {
						turboCurrentFov -=
							(turboFov - fieldOfView) * (dt / turboAnimation);
						updateFOV(turboCurrentFov);
					}
					if (speed > maxSpeed) {
						speed -=
							(turboMaxSpeed - maxSpeed) *
							(dt / turboAnimation) *
							3;
					}
				}
			} else {
				turboTriggered = false;
				updateFOV(fieldOfView);
			}
		}

		skyOffset = Util.increase(
			skyOffset,
			(skySpeed * playerSegment.curve * (position - startPosition)) /
			segmentLength,
			1
		);
		hillOffset = Util.increase(
			hillOffset,
			(hillSpeed * playerSegment.curve * (position - startPosition)) /
			segmentLength,
			1
		);
		treeOffset = Util.increase(
			treeOffset,
			(treeSpeed * playerSegment.curve * (position - startPosition)) /
			segmentLength,
			1
		);

		if (position > playerZ) {
			if (!firstLapStarted) {
				startGameAPI();
				firstLapStarted = true;
			}
			if (currentLapTime && startPosition < playerZ) {
				lastLapTime = currentLapTime;
				currentLapTime = 0;
				resetObjects();

				if (lastLapTime <= Util.toFloat(Dom.storage.fast_lap_time)) {
					Dom.storage.fast_lap_time = lastLapTime;
					updateHud("fast_lap_time", formatTime(lastLapTime));
					Dom.addClassName("fast_lap_time", "fastest");
					Dom.addClassName("last_lap_time", "fastest");
					
					updateLeaderboard();
				} else {
					Dom.removeClassName("fast_lap_time", "fastest");
					Dom.removeClassName("last_lap_time", "fastest");
				}
				const sonic = Util.toFloat(Dom.storage.fast_lap_time);
					//console.log("fast_lap_time --> ", sonic);
					await endGameAPI(sonic);
				updateHud("last_lap_time", formatTime(lastLapTime));
				Dom.show("last_lap_time");
				startGameAPI();
			} else {
				currentLapTime += dt;
			}
		}

		updateHud("speed", 5 * Math.round(speed / 500));
		updateHud("current_lap_time", formatTime(currentLapTime));
		updateHud("coins", score); // Update the score in the HUD
	}

	//-------------------------------------------------------------------------

	function updateCreatures(dt, playerSegment, playerW) {
		var n, creature, oldSegment, newSegment;
		for (n = 0; n < creatures.length; n++) {
			creature = creatures[n];
			oldSegment = findSegment(creature.z);
			creature.offset =
				creature.offset +
				updateCreatureOffset(
					creature,
					oldSegment,
					playerSegment,
					playerW
				);
			creature.z = Util.increase(
				creature.z,
				dt * creature.speed,
				trackLength
			);
			creature.percent = Util.percentRemaining(creature.z, segmentLength); // useful for interpolation during rendering phase
			newSegment = findSegment(creature.z);
			if (oldSegment != newSegment) {
				index = oldSegment.creatures.indexOf(creature);
				oldSegment.creatures.splice(index, 1);
				newSegment.creatures.push(creature);
			}
		}
	}

	function updateCreatureOffset(
		creature,
		creatureSegment,
		playerSegment,
		playerW
	) {
		var i,
			j,
			dir,
			segment,
			otherCreature,
			otherCreatureW,
			lookahead = 25,
			creatureW = creature.sprite.w * SPRITES.SCALE;

		// optimization, dont bother steering around other creatures when 'out of sight' of the player
		if (creatureSegment.index - playerSegment.index > drawDistance)
			return 0;

		for (i = 1; i < lookahead; i++) {
			segment = segments[(creatureSegment.index + i) % segments.length];

			if (
				segment === playerSegment &&
				creature.speed > speed &&
				Util.overlap(playerX, playerW, creature.offset, creatureW, 1.2)
			) {
				if (playerX > 0.5) dir = -1;
				else if (playerX < -0.5) dir = 1;
				else dir = creature.offset > playerX ? 1 : -1;
				return (((dir * 1) / i) * (creature.speed - speed)) / maxSpeed; // the closer the creatures (smaller i) and the greated the speed ratio, the larger the offset
			}

			for (j = 0; j < segment.creatures.length; j++) {
				otherCreature = segment.creatures[j];
				otherCreatureW = otherCreature.sprite.w * SPRITES.SCALE;
				if (
					creature.speed > otherCreature.speed &&
					Util.overlap(
						creature.offset,
						creatureW,
						otherCreature.offset,
						otherCreatureW,
						1.2
					)
				) {
					if (otherCreature.offset > 0.5) dir = -1;
					else if (otherCreature.offset < -0.5) dir = 1;
					else dir = creature.offset > otherCreature.offset ? 1 : -1;
					return (
						(((dir * 1) / i) *
							(creature.speed - otherCreature.speed)) /
						maxSpeed
					);
				}
			}
		}

		// if no creatures ahead, but I have somehow ended up off road, then steer back on
		if (creature.offset < -0.85) return 0.1;
		else if (creature.offset > 0.85) return -0.1;
		else return 0;
	}

	//-------------------------------------------------------------------------

	function collectCoin() {
		Dom.get("current_lap_time").style.backgroundColor = "green";
		setTimeout(function () {
			Dom.get("current_lap_time").style.backgroundColor = "";
		}, 1000);

		score += 1;
		currentLapTime -= 1.5;
		//console.log("Money");
	}

	function triggerTurbo() {
		turboCurrentFov = fieldOfView;
		turboTimeDone = 0.0;
		turboTriggered = true;
		//console.log("GO CRAZYYYY");
	}

	function updateFOV(fov) {
		cameraDepth = 1 / Math.tan(((fov / 2) * Math.PI) / 180);
		playerZ = cameraHeight * cameraDepth;
	}

	//-------------------------------------------------------------------------

	function updateHud(key, value) {
		// accessing DOM can be slow, so only do it if value has changed
		if (hud[key].value !== value) {
			hud[key].value = value;
			Dom.set(hud[key].dom, value);
		}
	}

	function formatTime(dt) {
		var minutes = Math.floor(dt / 60);
		var seconds = Math.floor(dt - minutes * 60);
		var tenths = Math.floor(10 * (dt - Math.floor(dt)));
		if (minutes > 0)
			return (
				minutes +
				"." +
				(seconds < 10 ? "0" : "") +
				seconds +
				"." +
				tenths
			);
		else return seconds + "." + tenths;
	}

	//=========================================================================
	// RENDER THE GAME WORLD
	//=========================================================================

	function render() {
		var baseSegment = findSegment(position);
		var basePercent = Util.percentRemaining(position, segmentLength);
		var playerSegment = findSegment(position + playerZ);
		var playerPercent = Util.percentRemaining(
			position + playerZ,
			segmentLength
		);
		var playerY = Util.interpolate(
			playerSegment.p1.world.y,
			playerSegment.p2.world.y,
			playerPercent
		);
		var maxy = height;

		var x = 0;
		var dx = -(baseSegment.curve * basePercent);

		ctx.clearRect(0, 0, width, height);

		Render.background(
			ctx,
			background,
			width,
			height,
			BACKGROUND.SKY,
			skyOffset,
			resolution * skySpeed * playerY
		);
		// Render.background(ctx, background, width, height, BACKGROUND.HILLS, hillOffset, resolution * hillSpeed * playerY);
		Render.background(
			ctx,
			background,
			width,
			height,
			BACKGROUND.TREES,
			treeOffset,
			resolution * treeSpeed * playerY
		);

		var n, i, segment, creature, sprite, spriteScale, spriteX, spriteY;

		for (n = 0; n < drawDistance; n++) {
			segment = segments[(baseSegment.index + n) % segments.length];
			segment.looped = segment.index < baseSegment.index;
			segment.fog = Util.exponentialFog(n / drawDistance, fogDensity);
			segment.clip = maxy;

			Util.project(
				segment.p1,
				playerX * roadWidth - x,
				playerY + cameraHeight,
				position - (segment.looped ? trackLength : 0),
				cameraDepth,
				width,
				height,
				roadWidth
			);
			Util.project(
				segment.p2,
				playerX * roadWidth - x - dx,
				playerY + cameraHeight,
				position - (segment.looped ? trackLength : 0),
				cameraDepth,
				width,
				height,
				roadWidth
			);

			x = x + dx;
			dx = dx + segment.curve;

			if (
				segment.p1.camera.z <= cameraDepth || // behind us
				segment.p2.screen.y >= segment.p1.screen.y || // back face cull
				segment.p2.screen.y >= maxy
			)
				// clip by (already rendered) hill
				continue;

			Render.segment(
				ctx,
				width,
				lanes,
				segment.p1.screen.x,
				segment.p1.screen.y,
				segment.p1.screen.w,
				segment.p2.screen.x,
				segment.p2.screen.y,
				segment.p2.screen.w,
				segment.fog,
				segment.color
			);

			maxy = segment.p1.screen.y;
		}

		for (n = drawDistance - 1; n > 0; n--) {
			segment = segments[(baseSegment.index + n) % segments.length];

			for (i = 0; i < segment.creatures.length; i++) {
				creature = segment.creatures[i];
				spriteScale = Util.interpolate(
					segment.p1.screen.scale,
					segment.p2.screen.scale,
					creature.percent
				);
				spriteX =
					Util.interpolate(
						segment.p1.screen.x,
						segment.p2.screen.x,
						creature.percent
					) +
					(spriteScale * creature.offset * roadWidth * width) / 2;
				spriteY = Util.interpolate(
					segment.p1.screen.y,
					segment.p2.screen.y,
					creature.percent
				);
				Render.sprite(
					ctx,
					width,
					height,
					resolution,
					roadWidth,
					sprites,
					creature.sprite,
					spriteScale,
					spriteX,
					spriteY,
					-0.5,
					-1,
					segment.clip
				);
			}

			for (var i = 0; i < segment.sprites.length; i++) {
				sprite = segment.sprites[i];
				spriteScale = segment.p1.screen.scale;
				spriteX =
					segment.p1.screen.x +
					(spriteScale * sprite.offset * roadWidth * width) / 2;
				spriteY = segment.p1.screen.y;
				Render.sprite(
					ctx,
					width,
					height,
					resolution,
					roadWidth,
					sprites,
					sprite.source,
					spriteScale,
					spriteX,
					spriteY,
					sprite.offset < 0 ? -1 : 0,
					-1,
					segment.clip
				);
			}

			if (segment.object !== null) {
				object = segment.object;
				spriteScale = segment.p1.screen.scale;
				spriteX =
					segment.p1.screen.x +
					(spriteScale * object.offset * roadWidth * width) / 2;
				spriteY = segment.p1.screen.y;
				Render.sprite(
					ctx,
					width,
					height,
					resolution,
					roadWidth,
					sprites,
					object.source,
					spriteScale,
					spriteX,
					spriteY,
					-0.5,
					-1,
					segment.clip
				);
			}

			if (segment == playerSegment) {
				Render.player(
					ctx,
					width,
					height,
					resolution,
					roadWidth,
					sprites,
					speed / maxSpeed,
					cameraDepth / playerZ,
					width / 2,
					height / 2 -
					((cameraDepth / playerZ) *
						Util.interpolate(
							playerSegment.p1.camera.y,
							playerSegment.p2.camera.y,
							playerPercent
						) *
						height) /
					2,
					speed * (keyLeft ? -1 : keyRight ? 1 : 0),
					playerSegment.p2.world.y - playerSegment.p1.world.y
				);
			}
		}
	}

	function findSegment(z) {
		return segments[Math.floor(z / segmentLength) % segments.length];
	}

	//=========================================================================
	// BUILD ROAD GEOMETRY
	//=========================================================================

	function lastY() {
		return segments.length == 0
			? 0
			: segments[segments.length - 1].p2.world.y;
	}

	function addSegment(curve, y) {
		var n = segments.length;
		segments.push({
			index: n,
			p1: {
				world: { y: lastY(), z: n * segmentLength },
				camera: {},
				screen: {},
			},
			p2: {
				world: { y: y, z: (n + 1) * segmentLength },
				camera: {},
				screen: {},
			},
			curve: curve,
			sprites: [],
			creatures: [],
			object: null,
			color:
				Math.floor(n / rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT,
		});
	}

	function addSprite(n, sprite, offset) {
		segments[n].sprites.push({ source: sprite, offset: offset });
	}

	function addRoad(enter, hold, leave, curve, y) {
		var startY = lastY();
		var endY = startY + Util.toInt(y, 0) * segmentLength;
		var n,
			total = enter + hold + leave;
		for (n = 0; n < enter; n++)
			addSegment(
				Util.easeIn(0, curve, n / enter),
				Util.easeInOut(startY, endY, n / total)
			);
		for (n = 0; n < hold; n++)
			addSegment(
				curve,
				Util.easeInOut(startY, endY, (enter + n) / total)
			);
		for (n = 0; n < leave; n++)
			addSegment(
				Util.easeInOut(curve, 0, n / leave),
				Util.easeInOut(startY, endY, (enter + hold + n) / total)
			);
	}

	var ROAD = {
		LENGTH: { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 },
		HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 },
		CURVE: { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 },
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
		addRoad(
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			-ROAD.CURVE.EASY,
			ROAD.HILL.NONE
		);
		addRoad(
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			ROAD.CURVE.MEDIUM,
			ROAD.HILL.MEDIUM
		);
		addRoad(
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			ROAD.CURVE.EASY,
			-ROAD.HILL.LOW
		);
		addRoad(
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			-ROAD.CURVE.EASY,
			ROAD.HILL.MEDIUM
		);
		addRoad(
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			ROAD.LENGTH.MEDIUM,
			-ROAD.CURVE.MEDIUM,
			-ROAD.HILL.MEDIUM
		);
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

		addSprite(20, SPRITES.BILLBOARD01, -1);
		addSprite(40, SPRITES.BILLBOARD06, -1); //magisat
		addSprite(60, SPRITES.BILLBOARD09, -1); //aa rare
		addSprite(80, SPRITES.BILLBOARD08, -1); //carota
		addSprite(100, SPRITES.BILLBOARD007, -1); //ord play

		addSprite(120, SPRITES.BILLBOARD05, -1);
		addSprite(140, SPRITES.BILLBOARD01, -1.2);
		addSprite(160, SPRITES.BILLBOARD06, -1);
		addSprite(180, SPRITES.BILLBOARD01, -1.2);
		addSprite(200, SPRITES.BILLBOARD05, -1);
		addSprite(220, SPRITES.BILLBOARD06, -1);
		addSprite(240, SPRITES.BILLBOARD01, 1.2); //inscrib3

		addSprite(240, SPRITES.BILLBOARD01, -1.2);
		addSprite(240, SPRITES.BILLBOARD05, 1.2);

		addSprite(segments.length - 25, SPRITES.BILLBOARD007, -1.2);
		addSprite(segments.length - 25, SPRITES.BILLBOARD09, 1.2);

		for (n = 10; n < 200; n += 4 + Math.floor(n / 100)) {
			addSprite(n, SPRITES.PALM_TREE, 0.5 + Math.random() * 0.5);
			addSprite(n, SPRITES.PALM_TREE, 1 + Math.random() * 2);
		}

		for (n = 250; n < 1000; n += 5) {
			addSprite(n, SPRITES.COLUMN, 1.1);
			addSprite(
				n + Util.randomInt(0, 5),
				SPRITES.TREE1,
				-1 - Math.random() * 2
			);
			addSprite(
				n + Util.randomInt(0, 5),
				SPRITES.TREE2,
				-1 - Math.random() * 2
			);
		}

		for (n = 200; n < segments.length; n += 1) {
			addSprite(
				n,
				Util.randomChoice(SPRITES.PLANTS),
				Util.randomChoice([1, -1]) * (2 + Math.random() * 5)
			);
		}

		var side, sprite, offset;
		for (n = 1000; n < segments.length - 50; n += 100) {
			side = Util.randomChoice([1, -1]);
			addSprite(
				n + Util.randomInt(0, 50),
				Util.randomChoice(SPRITES.BILLBOARDS),
				-side
			);
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
			speed =
				maxSpeed / 4 +
				(Math.random() * maxSpeed) / (sprite == SPRITES.TROLL ? 4 : 2);
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

		for (i = 0; i < segments.length; i++) segments[i].object = null;

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
			z = getValidZ("nitro");
			nitro = { offset: offset, z: z, source: SPRITES.NITRO };
			segment = findSegment(nitro.z);
			segment.object = nitro;
			objects.push(nitro);
		}
	}

	function getValidZ(targetName) {
		var tooClose, isOutOfRange, interval;
		var coinSeparation = 7500;
		var nitroSeparation = 100000;
		var startSegment = 180;
		var endSegment = targetName === "coin" ? 50 : 300;

		do {
			z = Math.floor(Math.random() * segments.length) * segmentLength;

			// Check if the new z value is too close to any existing objects
			tooClose = objects.some((existingObject) => {
				interval =
					existingObject.source === SPRITES.NITRO &&
						targetName === "nitro"
						? nitroSeparation
						: coinSeparation;
				return Math.abs(existingObject.z - z) < interval;
			});

			// Check if the new z value is within the desired segment range
			isOutOfRange =
				findSegment(z).index < startSegment ||
				findSegment(z).index > segments.length - endSegment;
		} while (tooClose || isOutOfRange || findSegment(z).object); // Keep generating new z values until we find one that's not too close to other nitros and within the desired range
		return z;
	}

	//=========================================================================
	// THE GAME LOOP
	//=========================================================================

	Game.run({
		canvas: canvas,
		render: render,
		update: update,
		step: step,
		images: ["background", "sprites"],
		keys: [
			{
				keys: [KEY.LEFT, KEY.A],
				div: "gamepad-left",
				mode: "down",
				action: function () {
					keyLeft = true;
				},
			},
			{
				keys: [KEY.RIGHT, KEY.D],
				div: "gamepad-right",
				mode: "down",
				action: function () {
					keyRight = true;
				},
			},
			{
				keys: [KEY.UP, KEY.W],
				div: "gamepad-up",
				mode: "down",
				action: function () {
					keyFaster = true;
				},
			},
			{
				keys: [KEY.DOWN, KEY.S],
				div: "gamepad-down",
				mode: "down",
				action: function () {
					keySlower = true;
				},
			},
			{
				keys: [KEY.LEFT, KEY.A],
				div: "gamepad-left",
				mode: "up",
				action: function () {
					keyLeft = false;
				},
			},
			{
				keys: [KEY.RIGHT, KEY.D],
				div: "gamepad-right",
				mode: "up",
				action: function () {
					keyRight = false;
				},
			},
			{
				keys: [KEY.UP, KEY.W],
				div: "gamepad-up",
				mode: "up",
				action: function () {
					keyFaster = false;
				},
			},
			{
				keys: [KEY.DOWN, KEY.S],
				div: "gamepad-down",
				mode: "up",
				action: function () {
					keySlower = false;
				},
			},
		],
		ready: async function (images) {
			background = images[0];
			sprites = images[1];
			reset();
			const existingScore = await loadScore();
			if (existingScore) {
				Dom.storage.fast_lap_time = parseFormattedTime(existingScore);
			} else {
				Dom.storage.fast_lap_time = Dom.storage.fast_lap_time || 180;
			}
			updateHud(
				"fast_lap_time",
				formatTime(Util.toFloat(Dom.storage.fast_lap_time))
			);
		},
	});

	function parseFormattedTime(formattedTime) {
		const timeComponents = formattedTime.split(".");
		if (timeComponents.length !== 3) {
			console.error("Invalid formatted time format");
			return 0;
		}
		const minutes = parseInt(timeComponents[0]);
		const seconds = parseInt(timeComponents[1]);
		const tenths = parseInt(timeComponents[2]);
		const totalTimeInSeconds = minutes * 60 + seconds + tenths / 10;

		return totalTimeInSeconds;
	}

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
		cameraDepth = 1 / Math.tan(((fieldOfView / 2) * Math.PI) / 180);
		playerZ = cameraHeight * cameraDepth;
		resolution = height / 480;

		if (
			segments.length == 0 ||
			options.segmentLength ||
			options.rumbleLength
		)
			resetRoad(); // only rebuild road when necessary
	}

	//=========================================================================
	// MOBILE RESCALING FUNCTIONS
	//=========================================================================

	function scaleRacer() {
		var isMobile = "ontouchstart" in window || navigator.maxTouchPoints;
		var racer = Dom.get("racer");
		var mute = Dom.get("mute");
		var hud = Dom.get("hud");
		var gamepad = Dom.get("gamepad");
		var fast_lap_time = Dom.get("fast_lap_time");
		var leaderboard = Dom.get("leaderboard-container");
		const leaderboardButton = Dom.get("leaderboard-button");
		var rightButtons = document.querySelector(".right-buttons");
		var leftButtons = document.querySelector(".left-buttons");
		var container = document.querySelector(".container");

		if (isMobile) {
			reset({ width: 640, height: 480 });
			createGamepad();

			if (window.innerHeight > window.innerWidth)
				// Portrait mode adjustments
				setStylesForPortraitMode(
					racer,
					mute,
					hud,
					gamepad,
					rightButtons,
					leftButtons,
					fast_lap_time
				);
			// Landscape mode adjustments
			else
				setStylesForLandscapeMode(
					racer,
					mute,
					hud,
					gamepad,
					rightButtons,
					leftButtons,
					fast_lap_time
				);

			// Disable the container styles and the leaderboard for mobile
			container.classList.remove("container");
			leaderboardButton.style.display = "none";
		} else {
			// Desktop adjustments
			setStylesForDesktop(
				container,
				racer,
				mute,
				hud,
				fast_lap_time,
				leaderboard
			);

			// Enable the container styles and leaderboard for desktop
			container.classList.add("container");
			leaderboardButton.style.display = "block";
		}
	}

	function setStylesForPortraitMode(
		racer,
		mute,
		hud,
		gamepad,
		rightButtons,
		leftButtons,
		fast_lap_time
	) {
		fast_lap_time.style.width = "10em";
		hud.style.fontSize = "1.5em";
		racer.style.transform = "scale(1)";
		racer.style.marginTop = "0%";
		racer.style.marginLeft = "0%";
		mute.style.marginLeft = "2%";
		mute.style.marginTop = "78%";
		mute.style.transform = "scale(2.5)";
		gamepad.style.transform = "scale(2)";
		gamepad.style.width = "40%";
		rightButtons.style.marginLeft = "115%";
		rightButtons.style.marginTop = "130%";
		leftButtons.style.marginLeft = "30%";
		leftButtons.style.marginTop = "190%";
		leftButtons.style.position = rightButtons.style.position = "absolute";
	}

	function setStylesForLandscapeMode(
		racer,
		mute,
		hud,
		gamepad,
		rightButtons,
		leftButtons,
		fast_lap_time
	) {
		fast_lap_time.style.width = "10em";
		hud.style.fontSize = "1.5em";
		racer.style.transform = "scale(0.6)";
		racer.style.marginTop = "-15%";
		racer.style.marginLeft = "9%";
		mute.style.marginLeft = "102%";
		mute.style.marginTop = "1%";
		mute.style.transform = "scale(2.5)";
		gamepad.style.transform = "scale(1)";
		gamepad.style.width = "100%";
		rightButtons.style.marginLeft = "94%";
		rightButtons.style.marginTop = "13%";
		leftButtons.style.marginLeft = "1.5%";
		leftButtons.style.marginTop = "26%";
		leftButtons.style.position = rightButtons.style.position = "absolute";
	}

	function setStylesForDesktop(
		container,
		racer,
		mute,
		hud,
		fast_lap_time,
		leaderboard
	) {
		// Define constants for target dimensions
		const containerHeight = 900;
		const containerWidth = isLeaderboardVisible ? 1700 : 1200;

		// Calculate scale factors for height and width
		const heightScale = Math.min(window.innerHeight / containerHeight, 1);
		const widthScale = Math.min(window.innerWidth / containerWidth, 1);

		// Apply container scaling
		container.style.transform = `scale(${Math.min(
			heightScale,
			widthScale
		)})`;

		// Set styles for other elements
		fast_lap_time.style.width = "11em";
		hud.style.fontSize = "1.3em";
		racer.style.transform = "scale(1)";
		racer.style.marginTop = "";
		racer.style.marginLeft =
			isLeaderboardVisible === false ? "0px" : "540px";
		mute.style.marginLeft = "1040px";
		mute.style.marginTop = "0.5em";
		mute.style.transform = "scale(2)";

		// Calculate and apply container margin-top
		const racerHeight = racer.getBoundingClientRect().height;
		const containerMarginTop =
			racerHeight / 2 + (window.innerHeight - racerHeight) / 3;
		container.style.marginTop = `${containerMarginTop}px`;
	}

	function createGamepad() {
		var existingGamepad = Dom.get("gamepad");

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

			document.body.insertAdjacentHTML("beforeend", gamepadHTML);
		}
	}

	// Disable zoom on double-touch gestures
	document.addEventListener(
		"touchend",
		function (event) {
			var now = new Date().getTime();
			if (now - lastTouchEnd <= 300) {
				event.preventDefault();
			}
			lastTouchEnd = now;
		},
		false
	);

	document.addEventListener("DOMContentLoaded", scaleRacer);
	window.addEventListener("resize", scaleRacer);

	//=========================================================================
	// API Functions
	//=========================================================================

	async function startGameAPI() {
		auth_token = localStorage.getItem("auth_token");
		console.log("auth token:", auth_token);
		const data = {
			auth_token: auth_token,
		};
		let responseBody;
		await fetch(
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
		)
			.then(async (response) => {
				if (response.ok) {
					console.log("Data sent successfully!");
					responseBody = await response.text();
				} else {
					console.error("Error sending data:", response.statusText);
				}
			})
			.then(() => {
				const response_token = responseBody;
				localStorage.setItem("game_token", response_token);
				console.log("Data sent! game_token:", response_token);
			})
			.catch((error) => {
				console.error("Network error:", error);
			});
	}

	async function endGameAPI(lap_time) {
		const data = {
			game_token: localStorage.getItem("game_token"),
			lap_time: lap_time,
			btcAddress: localStorage.getItem("btcAddress"),
		};
		console.log("data:", data);
		await fetch("https://pvrgwmyaxynklimiusly.functions.supabase.co/end_game", {
			method: "POST",
			headers: {
				Authorization:
					"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		})
			.then((response) => {
				//console.log("sent verification request-->", response);
				if (response.ok) {
					//console.log("response status end:", response.statusText);
					//console.log("Data sent successfully!");
				} else {
					//console.log("Error sending data:", response.statusText);
				}
			})
			.catch((error) => {
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
			if (!response.ok) throw new Error("Network response was not ok");
			else return await response.json();
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
			leaderboardButton.textContent = "Hide Leaderboard";
		} else {
			// Hide the leaderboard container
			leaderboardContainer.style.display = "none";
			isLeaderboardVisible = false;
			leaderboardButton.textContent = "Show Leaderboard";
		}
		scaleRacer();
	});
	async function loadScore() {
		const btcAddress = localStorage.getItem("btcAddress");
		if (btcAddress) {
			const requestUrl = `https://pvrgwmyaxynklimiusly.supabase.co/rest/v1/scores?btcAddress=eq.${btcAddress}`;
			try {
				const response = await fetch(requestUrl, {
					method: "GET",
					headers: {
						apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
						"Content-Type": "application/json",
					},
				});
				if (response.ok) {
					const responseData = await response.json();
					if (responseData.length > 0) {
						const existingScore = responseData[0];
						const existingFastLap = existingScore.fast_lap;
						return existingFastLap;
					}
				} else {
					console.error("Error checking btcAddress:", response);
					return null;
				}
			} catch (error) {
				console.error("Error checking btcAddress:", error);
				return null;
			}
		} else {
			return null;
		}
	}

	async function updateLeaderboard() {
		const topScores = await fetchLeaderboard();
		/*const matchingScore = topScores.find(
				(score) => score.btcAddress === Dom.storage.btcAddress
		);*/

		//  if (matchingScore) Dom.storage.fast_lap_time = matchingScore.fast_lap;

		//console.log("leaderboard json:", topScores);

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
          <span class="score">${entry.fast_lap}</span>
        </div>`
			)
			.join("");

		// Combine header row and leaderboard entry rows
		leaderboardContainer.innerHTML = headerHTML + leaderboardHTML;
	}

	updateLeaderboard();

	// Update the leaderboard every minute
	setInterval(updateLeaderboard, 60000);
}

// https://www.toolnb.com/tools-lang-en/gzip.html to encode changes
