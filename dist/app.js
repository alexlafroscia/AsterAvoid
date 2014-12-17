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
var Controller, Game, Myo, Player, Ship, controller, game, myo, player1, render, ship;

Function.prototype.property = function(prop, desc) {
  return Object.defineProperty(this.prototype, prop, desc);
};

Myo = require('myo');

Ship = require('./ship.coffee');

Player = require('./player.coffee');

Game = require('./game.coffee');

Controller = require('./controller.coffee');

game = new Game();

myo = Myo.create();

controller = new Controller('myo', myo);

ship = new Ship();

player1 = new Player(controller, ship);

game.addPlayer(player1);

render = function() {
  var i, _i, _ref;
  requestAnimationFrame(render);
  for (i = _i = 0, _ref = game.players.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
    game.players[i].updatePosition();
  }
  return game.rerender();
};

render();



},{"./controller.coffee":4,"./game.coffee":5,"./player.coffee":6,"./ship.coffee":7,"myo":1}],4:[function(require,module,exports){
var Controller;

Controller = (function() {
  function Controller(type, myo) {
    this.type = type;
    this.myo = myo != null ? myo : null;
    this.xValue = 0;
    this.yValue = 0;
    this.baseYaw = null;
    if (type === 'myo') {
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
  }

  Controller.prototype.getYaw = function() {
    var data, p1, yaw, yaw_w;
    if (this.type === 'myo') {
      data = this.myo.lastIMU.orientation;
      p1 = 2.0 * (data.w * data.z + data.x * data.y);
      yaw = Math.atan2(p1, 1.0 - 2.0 * (data.y * data.y + data.z * data.z));
      yaw_w = (yaw + Math.PI / 2.0) / Math.PI * 18;
      return yaw_w;
    }
  };

  Controller.prototype.getBaseYaw = function() {
    if (this.type === 'myo') {
      return this.baseYaw = this.getYaw();
    }
  };

  return Controller;

})();

module.exports = Controller;



},{}],5:[function(require,module,exports){
var Game;

Game = (function() {
  function Game() {
    this.players = [];
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 10, 10);
    this.camera.lookAt(this.scene.position);
    this.camera.position.z = 5;
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
  }

  Game.prototype.rerender = function() {
    return this.renderer.render(this.scene, this.camera);
  };

  Game.prototype.addPlayer = function(player) {
    this.players.push(player);
    return this.scene.add(player.ship.geo);
  };

  return Game;

})();

module.exports = Game;



},{}],6:[function(require,module,exports){
var Player;

Player = (function() {
  function Player(controller, ship) {
    this.controller = controller;
    this.ship = ship;
  }

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

  Player.prototype.updatePosition = function() {
    return this.ship.move(this.xValue, this.yValue);
  };

  return Player;

})();

module.exports = Player;



},{}],7:[function(require,module,exports){
var Ship;

Ship = (function() {
  function Ship() {
    var geometry, material;
    geometry = new THREE.BoxGeometry(1, 1, 1);
    material = new THREE.MeshBasicMaterial({
      color: 0x00ff00
    });
    this.geo = new THREE.Mesh(geometry, material);
  }

  Ship.prototype.move = function(x, y) {
    this.geo.translateX(x);
    return this.geo.translateY(y);
  };

  return Ship;

})();

module.exports = Ship;



},{}]},{},[3,4,5,6,7]);
