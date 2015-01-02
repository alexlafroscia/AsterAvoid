(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function(){

	var Socket;
	if(typeof window === 'undefined'){
		Socket = require('ws');
	}else {
		if (!("WebSocket" in window)){
			console.error('Myo.js : Sockets not supported :(');
		}
		Socket = WebSocket;
	}
	/**
	 * Utils
	 */
	var extend = function(){
		var result = {};
		for(var i in arguments){
			var obj = arguments[i];
			for(var propName in obj){
				if(obj.hasOwnProperty(propName)){ result[propName] = obj[propName]; }
			}
		}
		return result;
	};
	var unique_counter = 0;
	var getUniqueId = function(){
		unique_counter++;
		return new Date().getTime() + "" + unique_counter;
	}


	var eventTable = {
		'pose' : function(myo, data){
			if(myo.lastPose != 'rest' && data.pose == 'rest'){
				myo.trigger(myo.lastPose, false);
				myo.trigger('pose', myo.lastPose, false);
			}
			myo.trigger(data.pose, true);
			myo.trigger('pose', data.pose, true);
			myo.lastPose = data.pose;
		},
		'rssi' : function(myo, data){
			myo.trigger('bluetooth_strength', data.rssi);
		},
		'orientation' : function(myo, data){
			myo._lastQuant = data.orientation;
			var imu_data = {
				orientation : {
					x : data.orientation.x - myo.orientationOffset.x,
					y : data.orientation.y - myo.orientationOffset.y,
					z : data.orientation.z - myo.orientationOffset.z,
					w : data.orientation.w - myo.orientationOffset.w
				},
				accelerometer : {
					x : data.accelerometer[0],
					y : data.accelerometer[1],
					z : data.accelerometer[2]
				},
				gyroscope : {
					x : data.gyroscope[0],
					y : data.gyroscope[1],
					z : data.gyroscope[2]
				}
			}
			if(!myo.lastIMU) myo.lastIMU = imu_data;
			myo.trigger('orientation',   imu_data.orientation);
			myo.trigger('accelerometer', imu_data.accelerometer);
			myo.trigger('gyroscope',     imu_data.gyroscope);
			myo.trigger('imu',           imu_data);
			myo.lastIMU = imu_data;
		},
		'arm_synced' : function(myo, data){
			myo.arm = data.arm;
			myo.direction = data.x_direction;
			myo.trigger(data.type, data);
		},
		'arm_unsynced' : function(myo, data){
			myo.arm = undefined;
			myo.direction = undefined;
			myo.trigger(data.type, data);
		},
		'connected' : function(myo, data){
			myo.connect_version = data.version.join('.');
			myo.isConnected = true;
			myo.trigger(data.type, data)
		},
		'disconnected' : function(myo, data){
			myo.isConnected = false;
			myo.trigger(data.type, data);
		},
		'emg' : function(myo, data){
			myo.trigger(data.type, data.emg)
		}
	};

	var handleMessage = function(msg){
		var data = JSON.parse(msg.data)[1];
		if(Myo.myos[data.myo] && eventTable[data.type]){
			eventTable[data.type](Myo.myos[data.myo], data);
		}
	};


	/**
	 * Eventy-ness
	 */
	var trigger = function(events, eventName, args){
		var self = this;
		//
		events.map(function(event){
			if(event.name == eventName) event.fn.apply(self, args);
			if(event.name == '*'){
				args.unshift(eventName)
				event.fn.apply(self, args);
			}
		});
		return this;
	};
	var on = function(events, name, fn){
		var id = getUniqueId()
		events.push({
			id   : id,
			name : name,
			fn   : fn
		});
		return id;
	};
	var off = function(events, name){
		events = events.reduce(function(result, event){
			if(event.name == name || event.id == name) {
				return result;
			}
			result.push(event);
			return result;
		}, []);
		return events;
	};



	var myoInstance = {
		isLocked : false,
		isConnected : false,
		orientationOffset : {x : 0,y : 0,z : 0,w : 0},
		lastIMU : undefined,
		socket : undefined,
		arm : undefined,
		direction : undefined,
		events : [],

		trigger : function(eventName){
			var args = Array.prototype.slice.apply(arguments).slice(1);
			trigger.call(this, Myo.events, eventName, args);
			trigger.call(this, this.events, eventName, args);
			return this;
		},
		on : function(eventName, fn){
			return on(this.events, eventName, fn)
		},
		off : function(eventName){
			this.events = off(this.events, eventName);
		},

		timer : function(status, timeout, fn){
			if(status){
				this.timeout = setTimeout(fn.bind(this), timeout);
			}else{
				clearTimeout(this.timeout)
			}
		},
		lock : function(){
			if(this.isLocked) return true;
			this.isLocked = true;
			this.trigger('lock');
			return this;
		},
		unlock : function(timeout){
			var self = this;
			clearTimeout(this.lockTimeout);
			if(timeout){
				this.lockTimeout = setTimeout(function(){
					self.lock();
				}, timeout);
			}
			if(!this.isLocked) return this;
			this.isLocked = false;
			this.trigger('unlock');
			return this;
		},
		zeroOrientation : function(){
			this.orientationOffset = this._lastQuant;
			this.trigger('zero_orientation');
			return this;
		},

		vibrate : function(intensity){
			intensity = intensity || 'medium';
			Myo.socket.send(JSON.stringify(['command',{
				"command": "vibrate",
				"myo": this.id,
				"type": intensity
			}]));
			return this;
		},
		requestBluetoothStrength : function(){
			Myo.socket.send(JSON.stringify(['command',{
				"command": "request_rssi",
				"myo": this.id
			}]));
			return this;
		},
		streamEMG : function(enabled){
			var type = 'enabled';
			if(enabled === false) type = 'disabled';
			Myo.socket.send(JSON.stringify(['command',{
				"command": "set_stream_emg",
				"myo": this.id,
				"type" : type
			}]));
			return this;
		},
	}


	Myo = {
		options : {
			api_version : 3,
			socket_url  : "ws://127.0.0.1:10138/myo/"
		},
		events : [],
		myos : [],

		/**
		 * Myo Constructor
		 * @param  {number} id
		 * @param  {object} options
		 * @return {myo}
		 */
		create : function(id, options){
			if(!Myo.socket) Myo.initSocket();

			if(!id) id = 0;
			if(typeof id === "object") options = id;
			options = options || {};

			var newMyo = Object.create(myoInstance);
			newMyo.options = extend(Myo.options, options);
			newMyo.events = [];
			newMyo.id = id;
			Myo.myos[id] = newMyo;
			return newMyo;
		},

		/**
		 * Event functions
		 */
		trigger : function(eventName){
			var args = Array.prototype.slice.apply(arguments).slice(1);
			trigger.call(Myo, Myo.events, eventName, args);
			return Myo;
		},
		on : function(eventName, fn){
			return on(Myo.events, eventName, fn)
		},
		initSocket : function(){
			Myo.socket = new Socket(Myo.options.socket_url + Myo.options.api_version);
			Myo.socket.onmessage = handleMessage;
			Myo.socket.onerror = function(){
				console.error('ERR: Myo.js had an error with the socket. Double check the API version.');
			}
		}
	};
	if(typeof module !== 'undefined') module.exports = Myo;
})();





},{"ws":2}],2:[function(require,module,exports){

/**
 * Module dependencies.
 */

var global = (function() { return this; })();

/**
 * WebSocket constructor.
 */

var WebSocket = global.WebSocket || global.MozWebSocket;

/**
 * Module exports.
 */

module.exports = WebSocket ? ws : null;

/**
 * WebSocket constructor.
 *
 * The third `opts` options object gets ignored in web browsers, since it's
 * non-standard, and throws a TypeError if passed to the constructor.
 * See: https://github.com/einaros/ws/issues/227
 *
 * @param {String} uri
 * @param {Array} protocols (optional)
 * @param {Object) opts (optional)
 * @api public
 */

function ws(uri, protocols, opts) {
  var instance;
  if (protocols) {
    instance = new WebSocket(uri, protocols);
  } else {
    instance = new WebSocket(uri);
  }
  return instance;
}

if (WebSocket) ws.prototype = WebSocket.prototype;

},{}],3:[function(require,module,exports){
var ArrowKeyController, Game, Player, WASDKeyController, arrowController, game, player1, player2, render, wasdController;

Function.prototype.property = function(prop, desc) {
  return Object.defineProperty(this.prototype, prop, desc);
};

Game = require('./game.coffee');

Player = require('./player.coffee');

WASDKeyController = require('./controllers/wasd_keys.coffee');

ArrowKeyController = require('./controllers/arrow_keys.coffee');

game = new Game();

wasdController = new WASDKeyController();

player1 = new Player(wasdController, 1);

arrowController = new ArrowKeyController();

player2 = new Player(arrowController, 2);

game.addPlayer(player1);

game.addPlayer(player2);

render = function() {
  var i, _i, _ref;
  requestAnimationFrame(render);
  for (i = _i = 0, _ref = game.players.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
    game.players[i].updatePosition();
  }
  game.camera.position.z -= 1;
  game.addObstacle();
  return game.rerender();
};

render();



},{"./controllers/arrow_keys.coffee":4,"./controllers/wasd_keys.coffee":8,"./game.coffee":9,"./player.coffee":11}],4:[function(require,module,exports){
var ArrowKeyController, BaseController,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

BaseController = require('./base.coffee');

ArrowKeyController = (function(_super) {
  __extends(ArrowKeyController, _super);

  function ArrowKeyController() {
    var MOVE_AMOUNT;
    ArrowKeyController.__super__.constructor.call(this);
    MOVE_AMOUNT = 0.5;
    document.addEventListener('keydown', (function(_this) {
      return function(e) {
        e = e || window.event;
        switch (e.which) {
          case 39:
            _this.xValue = MOVE_AMOUNT;
            break;
          case 37:
            _this.xValue = -MOVE_AMOUNT;
            break;
          case 38:
            _this.yValue = MOVE_AMOUNT;
            break;
          case 40:
            _this.yValue = -MOVE_AMOUNT;
            break;
        }
      };
    })(this));
    document.addEventListener('keyup', (function(_this) {
      return function(e) {
        e = e || window.event;
        e = e || window.event;
        switch (e.which) {
          case 39:
          case 37:
            _this.xValue = 0;
            break;
          case 38:
          case 40:
            _this.yValue = 0;
            break;
        }
      };
    })(this));
  }

  ArrowKeyController.prototype.getBaseYaw = function() {
    return 0;
  };

  return ArrowKeyController;

})(BaseController);

module.exports = ArrowKeyController;



},{"./base.coffee":5}],5:[function(require,module,exports){
var Controller;

Controller = (function() {
  function Controller() {
    this.xValue = 0;
    this.yValue = 0;
    this.baseYaw = null;
  }


  /*
   * Instance methods
   */

  Controller.prototype.getYaw = function() {
    throw new Error('getYaw() needs to implemented by subclass');
  };

  Controller.prototype.getBaseYaw = function() {
    throw new Error('getBaseYaw() needs to implemented by subclass');
  };

  return Controller;

})();

module.exports = Controller;



},{}],6:[function(require,module,exports){
var BaseController, Myo, MyoController,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

BaseController = require('./base.coffee');

Myo = require('myo');

MyoController = (function(_super) {
  __extends(MyoController, _super);

  function MyoController() {
    var myo;
    MyoController.__super__.constructor.call(this);
    myo = Myo.create();
    myo.on('accelerometer', (function(_this) {
      return function(data) {
        if (_this.direction === 'toward_elbow') {
          return controller.yValue = -data.x;
        } else {
          return controller.yValue = data.x;
        }
      };
    })(this));
    myo.on('orientation', (function(_this) {
      return function(data) {
        var thisYaw;
        if (_this.baseYaw == null) {
          _this.getBaseYaw();
        }
        thisYaw = _this.getYaw();
        return _this.xValue = -(thisYaw - _this.baseYaw) / 5;
      };
    })(this));
  }


  /*
   * Instance methods
   */

  MyoController.prototype.getYaw = function() {
    var data, p1, yaw, yaw_w;
    data = this.myo.lastIMU.orientation;
    p1 = 2.0 * (data.w * data.z + data.x * data.y);
    yaw = Math.atan2(p1, 1.0 - 2.0 * (data.y * data.y + data.z * data.z));
    yaw_w = (yaw + Math.PI / 2.0) / Math.PI * 18;
    return yaw_w;
  };

  MyoController.prototype.getBaseYaw = function() {
    return this.baseYaw = this.getYaw();
  };

  return MyoController;

})(BaseController);

module.exports = MyoController;



},{"./base.coffee":5,"myo":1}],7:[function(require,module,exports){
var BaseController, TiltController,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

BaseController = require('./base.coffee');

TiltController = (function(_super) {
  __extends(TiltController, _super);

  function TiltController() {
    TiltController.__super__.constructor.call(this);
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (function(_this) {
        return function() {
          return _this.tilt(event.beta, event.gamma);
        };
      })(this), true);
    } else if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', (function(_this) {
        return function() {
          return _this.tilt(event.acceleration.x * 2, event.acceleration.y * 2);
        };
      })(this), true);
    } else {
      window.addEventListener('MozOrientation', (function(_this) {
        return function() {
          return _this.tilt(orientation.x * 50, orientation.y * 50);
        };
      })(this), true);
    }
  }

  TiltController.prototype.tilt = function(beta, gamma) {
    if (this.baseYaw == null) {
      this.baseYaw = gamma;
    }
    this.xValue = beta / 15;
    return this.yValue = (gamma - this.baseYaw) / 20;
  };

  return TiltController;

})(BaseController);

module.exports = TiltController;



},{"./base.coffee":5}],8:[function(require,module,exports){
var BaseController, WASDKeyController,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

BaseController = require('./base.coffee');

WASDKeyController = (function(_super) {
  __extends(WASDKeyController, _super);

  function WASDKeyController() {
    var MOVE_AMOUNT;
    WASDKeyController.__super__.constructor.call(this);
    MOVE_AMOUNT = 0.5;
    document.addEventListener('keydown', (function(_this) {
      return function(e) {
        e = e || window.event;
        switch (e.which) {
          case 68:
            _this.xValue = MOVE_AMOUNT;
            break;
          case 65:
            _this.xValue = -MOVE_AMOUNT;
            break;
          case 87:
            _this.yValue = MOVE_AMOUNT;
            break;
          case 83:
            _this.yValue = -MOVE_AMOUNT;
            break;
        }
      };
    })(this));
    document.addEventListener('keyup', (function(_this) {
      return function(e) {
        e = e || window.event;
        switch (e.which) {
          case 65:
          case 68:
            _this.xValue = 0;
            break;
          case 87:
          case 83:
            _this.yValue = 0;
            break;
        }
      };
    })(this));
  }

  WASDKeyController.prototype.getBaseYaw = function() {
    return 0;
  };

  return WASDKeyController;

})(BaseController);

module.exports = WASDKeyController;



},{"./base.coffee":5}],9:[function(require,module,exports){
var Game, Obstacle;

Obstacle = require('./obstacle.coffee');

Game = (function() {
  function Game() {
    var directionalLight, height, width;
    this.players = [];
    width = window.innerWidth;
    height = window.innerHeight;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 10, 30);
    this.camera.lookAt(this.scene.position);
    this.camera.position.z = 10;
    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 1, 1);
    this.scene.add(directionalLight);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(width, height);
    document.body.appendChild(this.renderer.domElement);
  }


  /*
   * Instance methods
   */

  Game.prototype.rerender = function() {
    return this.renderer.render(this.scene, this.camera);
  };

  Game.prototype.addPlayer = function(player) {
    this.players.push(player);
    return player.initMesh(this.scene);
  };

  Game.prototype.addObstacle = function() {
    var obstacle, zPosition;
    zPosition = this.camera.position.z - 120;
    obstacle = new Obstacle(zPosition);
    return this.scene.add(obstacle.sphere);
  };

  return Game;

})();

module.exports = Game;



},{"./obstacle.coffee":10}],10:[function(require,module,exports){
var Obstacle;

Obstacle = (function() {

  /*
   * Class Properties
   */
  Obstacle.fieldWidth = 80;

  Obstacle.fieldHeight = 10;


  /*
   * Class Methods
   */

  Obstacle.createXPosition = function() {
    var random;
    random = Math.floor((Math.random() * Obstacle.fieldWidth) + 1);
    return random - (this.fieldWidth / 2);
  };

  Obstacle.createYPosition = function() {
    var random;
    random = Math.floor((Math.random() * Obstacle.fieldHeight) + 1);
    return random - (this.fieldHeight / 2);
  };

  function Obstacle(zValue) {
    var geometry, material;
    geometry = new THREE.SphereGeometry((Math.random() * 2) + 1, 2, 2);
    material = new THREE.MeshLambertMaterial({
      color: 'green'
    });
    this.sphere = new THREE.Mesh(geometry, material);
    this.sphere.position.x = this.constructor.createXPosition();
    this.sphere.position.y = this.constructor.createYPosition();
    this.sphere.position.z = zValue;
  }

  return Obstacle;

})();

module.exports = Obstacle;



},{}],11:[function(require,module,exports){
var Player, Ship;

Ship = require('./ship.coffee');

Player = (function() {
  function Player(controller, id) {
    this.controller = controller;
    this.id = id;
  }


  /*
   * Instance properties
   */

  Player.property('xValue', {
    get: function() {
      return this.controller.xValue;
    }
  });

  Player.property('yValue', {
    get: function() {
      return this.controller.yValue;
    }
  });


  /*
   * Instance methods
   */

  Player.prototype.updatePosition = function() {
    var _ref;
    return (_ref = this.ship) != null ? _ref.move(this.xValue, this.yValue, -1) : void 0;
  };

  Player.prototype.initMesh = function(scene) {
    var color;
    if (this.id === 1) {
      color = 'blue';
    } else {
      color = 'red';
    }
    return this.ship = new Ship(scene, color);
  };

  return Player;

})();

module.exports = Player;



},{"./ship.coffee":12}],12:[function(require,module,exports){
var Ship;

Ship = (function() {
  function Ship(scene, color) {
    var loader, material;
    material = new THREE.MeshLambertMaterial({
      color: color
    });
    material.shading = THREE.FlatShading;
    loader = new THREE.JSONLoader();
    loader.load('models/ship.json', (function(_this) {
      return function(geometry) {
        _this.geo = new THREE.Mesh(geometry, material);
        _this.geo.scale.set(1, 1, 1);
        _this.geo.position.y = 0;
        _this.geo.position.x = 0;
        return scene.add(_this.geo);
      };
    })(this));
  }


  /*
   * Instance methods
   */

  Ship.prototype.move = function(x, y, z) {
    var _ref, _ref1, _ref2;
    if ((_ref = this.geo) != null) {
      _ref.translateX(x);
    }
    if ((_ref1 = this.geo) != null) {
      _ref1.translateY(y);
    }
    return (_ref2 = this.geo) != null ? _ref2.translateZ(z) : void 0;
  };

  return Ship;

})();

module.exports = Ship;



},{}]},{},[3,4,5,6,7,8,9,10,11,12]);
