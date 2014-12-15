(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/alex/Projects/experiements/cubefield-myo/node_modules/myo/myo.js":[function(require,module,exports){
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





},{"ws":"/Users/alex/Projects/experiements/cubefield-myo/node_modules/myo/node_modules/ws/lib/browser.js"}],"/Users/alex/Projects/experiements/cubefield-myo/node_modules/myo/node_modules/ws/lib/browser.js":[function(require,module,exports){

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

},{}],"/Users/alex/Projects/experiements/cubefield-myo/src/app.js":[function(require,module,exports){
var Myo = require('myo');
var Ship = require('./ship');

// Helper methods from myoExtended
// https://github.com/MisterJack49/myoReveal/blob/master/myoExtended.js
function getRoll(data) {
  var roll = Math.atan2(2.0 * (data.w * data.x + data.y * data.z), 1.0 - 2.0 * (data.x * data.x + data.y * data.y));
  var roll_w = ((roll + Math.PI)/(Math.PI * 2.0) * 18);
  return roll_w;
}

function getPitch(data) {
  var pitch = Math.asin(Math.max(-1.0, Math.min(1.0, 2.0 * (data.w * data.y - data.z * data.x))));
  var pitch_w = ((pitch + Math.PI/2.0)/Math.PI * 18);
  return pitch_w;
}

function getYaw(data) {
  var yaw = Math.atan2(2.0 * (data.w * data.z + data.x * data.y), 1.0 - 2.0 * (data.y * data.y + data.z * data.z));
  var yaw_w = ((yaw + Math.PI/2.0)/Math.PI * 18);
  return yaw_w;
}



// My Code
var yValue = 0;
var xValue = 0;
var baseYaw = null;
var myo = Myo.create();


function getBaseYaw(data) {
  baseYaw = getYaw(data.lastIMU.orientation);
}

// Use the accelerometer to get the up/down pitch of the arm
myo.on('accelerometer', function(data) {
  if (this.direction == 'toward_elbow') {
    yValue = -data.x;
  } else {
    yValue = data.x;
  }
});

// Use the orientation to get the "yaw", which can be used to determine
// which direction the arm is facing
myo.on('orientation', function(data) {
  if (baseYaw === null)
    getBaseYaw(this);
  var thisYaw = getYaw(this.lastIMU.orientation);
  xValue = -(thisYaw - baseYaw) / 5;
});


// Make a new scene and camera
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(
  75,                                       // Field of View
  window.innerWidth / window.innerHeight,   // Aspect Ratio (match screen size)
  0.1,                                      // Near
  1000                                      // Far
);
camera.position.set(0, 10, 10);
camera.lookAt(scene.position);

// Make a renderer and add it to the page
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Make a cube
geometry = new THREE.BoxGeometry(1, 1, 1);
material = new THREE.MeshBasicMaterial({
  color: 0x00ff00
});
var cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

// Render Loop
function render() {
  requestAnimationFrame(render);
  //cube.translateY(yValue);
  //cube.translateX(xValue);
  renderer.render(scene, camera);
}
render();

},{"./ship":"/src/ship.js","myo":"/Users/alex/Projects/experiements/cubefield-myo/node_modules/myo/myo.js"}]},{},["/Users/alex/Projects/experiements/cubefield-myo/src/app.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbXlvL215by5qcyIsIm5vZGVfbW9kdWxlcy9teW8vbm9kZV9tb2R1bGVzL3dzL2xpYi9icm93c2VyLmpzIiwic3JjL2FwcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oKXtcblxuXHR2YXIgU29ja2V0O1xuXHRpZih0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyl7XG5cdFx0U29ja2V0ID0gcmVxdWlyZSgnd3MnKTtcblx0fWVsc2Uge1xuXHRcdGlmICghKFwiV2ViU29ja2V0XCIgaW4gd2luZG93KSl7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdNeW8uanMgOiBTb2NrZXRzIG5vdCBzdXBwb3J0ZWQgOignKTtcblx0XHR9XG5cdFx0U29ja2V0ID0gV2ViU29ja2V0O1xuXHR9XG5cdC8qKlxuXHQgKiBVdGlsc1xuXHQgKi9cblx0dmFyIGV4dGVuZCA9IGZ1bmN0aW9uKCl7XG5cdFx0dmFyIHJlc3VsdCA9IHt9O1xuXHRcdGZvcih2YXIgaSBpbiBhcmd1bWVudHMpe1xuXHRcdFx0dmFyIG9iaiA9IGFyZ3VtZW50c1tpXTtcblx0XHRcdGZvcih2YXIgcHJvcE5hbWUgaW4gb2JqKXtcblx0XHRcdFx0aWYob2JqLmhhc093blByb3BlcnR5KHByb3BOYW1lKSl7IHJlc3VsdFtwcm9wTmFtZV0gPSBvYmpbcHJvcE5hbWVdOyB9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH07XG5cdHZhciB1bmlxdWVfY291bnRlciA9IDA7XG5cdHZhciBnZXRVbmlxdWVJZCA9IGZ1bmN0aW9uKCl7XG5cdFx0dW5pcXVlX2NvdW50ZXIrKztcblx0XHRyZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyBcIlwiICsgdW5pcXVlX2NvdW50ZXI7XG5cdH1cblxuXG5cdHZhciBldmVudFRhYmxlID0ge1xuXHRcdCdwb3NlJyA6IGZ1bmN0aW9uKG15bywgZGF0YSl7XG5cdFx0XHRpZihteW8ubGFzdFBvc2UgIT0gJ3Jlc3QnICYmIGRhdGEucG9zZSA9PSAncmVzdCcpe1xuXHRcdFx0XHRteW8udHJpZ2dlcihteW8ubGFzdFBvc2UsIGZhbHNlKTtcblx0XHRcdFx0bXlvLnRyaWdnZXIoJ3Bvc2UnLCBteW8ubGFzdFBvc2UsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdG15by50cmlnZ2VyKGRhdGEucG9zZSwgdHJ1ZSk7XG5cdFx0XHRteW8udHJpZ2dlcigncG9zZScsIGRhdGEucG9zZSwgdHJ1ZSk7XG5cdFx0XHRteW8ubGFzdFBvc2UgPSBkYXRhLnBvc2U7XG5cdFx0fSxcblx0XHQncnNzaScgOiBmdW5jdGlvbihteW8sIGRhdGEpe1xuXHRcdFx0bXlvLnRyaWdnZXIoJ2JsdWV0b290aF9zdHJlbmd0aCcsIGRhdGEucnNzaSk7XG5cdFx0fSxcblx0XHQnb3JpZW50YXRpb24nIDogZnVuY3Rpb24obXlvLCBkYXRhKXtcblx0XHRcdG15by5fbGFzdFF1YW50ID0gZGF0YS5vcmllbnRhdGlvbjtcblx0XHRcdHZhciBpbXVfZGF0YSA9IHtcblx0XHRcdFx0b3JpZW50YXRpb24gOiB7XG5cdFx0XHRcdFx0eCA6IGRhdGEub3JpZW50YXRpb24ueCAtIG15by5vcmllbnRhdGlvbk9mZnNldC54LFxuXHRcdFx0XHRcdHkgOiBkYXRhLm9yaWVudGF0aW9uLnkgLSBteW8ub3JpZW50YXRpb25PZmZzZXQueSxcblx0XHRcdFx0XHR6IDogZGF0YS5vcmllbnRhdGlvbi56IC0gbXlvLm9yaWVudGF0aW9uT2Zmc2V0LnosXG5cdFx0XHRcdFx0dyA6IGRhdGEub3JpZW50YXRpb24udyAtIG15by5vcmllbnRhdGlvbk9mZnNldC53XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFjY2VsZXJvbWV0ZXIgOiB7XG5cdFx0XHRcdFx0eCA6IGRhdGEuYWNjZWxlcm9tZXRlclswXSxcblx0XHRcdFx0XHR5IDogZGF0YS5hY2NlbGVyb21ldGVyWzFdLFxuXHRcdFx0XHRcdHogOiBkYXRhLmFjY2VsZXJvbWV0ZXJbMl1cblx0XHRcdFx0fSxcblx0XHRcdFx0Z3lyb3Njb3BlIDoge1xuXHRcdFx0XHRcdHggOiBkYXRhLmd5cm9zY29wZVswXSxcblx0XHRcdFx0XHR5IDogZGF0YS5neXJvc2NvcGVbMV0sXG5cdFx0XHRcdFx0eiA6IGRhdGEuZ3lyb3Njb3BlWzJdXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmKCFteW8ubGFzdElNVSkgbXlvLmxhc3RJTVUgPSBpbXVfZGF0YTtcblx0XHRcdG15by50cmlnZ2VyKCdvcmllbnRhdGlvbicsICAgaW11X2RhdGEub3JpZW50YXRpb24pO1xuXHRcdFx0bXlvLnRyaWdnZXIoJ2FjY2VsZXJvbWV0ZXInLCBpbXVfZGF0YS5hY2NlbGVyb21ldGVyKTtcblx0XHRcdG15by50cmlnZ2VyKCdneXJvc2NvcGUnLCAgICAgaW11X2RhdGEuZ3lyb3Njb3BlKTtcblx0XHRcdG15by50cmlnZ2VyKCdpbXUnLCAgICAgICAgICAgaW11X2RhdGEpO1xuXHRcdFx0bXlvLmxhc3RJTVUgPSBpbXVfZGF0YTtcblx0XHR9LFxuXHRcdCdhcm1fc3luY2VkJyA6IGZ1bmN0aW9uKG15bywgZGF0YSl7XG5cdFx0XHRteW8uYXJtID0gZGF0YS5hcm07XG5cdFx0XHRteW8uZGlyZWN0aW9uID0gZGF0YS54X2RpcmVjdGlvbjtcblx0XHRcdG15by50cmlnZ2VyKGRhdGEudHlwZSwgZGF0YSk7XG5cdFx0fSxcblx0XHQnYXJtX3Vuc3luY2VkJyA6IGZ1bmN0aW9uKG15bywgZGF0YSl7XG5cdFx0XHRteW8uYXJtID0gdW5kZWZpbmVkO1xuXHRcdFx0bXlvLmRpcmVjdGlvbiA9IHVuZGVmaW5lZDtcblx0XHRcdG15by50cmlnZ2VyKGRhdGEudHlwZSwgZGF0YSk7XG5cdFx0fSxcblx0XHQnY29ubmVjdGVkJyA6IGZ1bmN0aW9uKG15bywgZGF0YSl7XG5cdFx0XHRteW8uY29ubmVjdF92ZXJzaW9uID0gZGF0YS52ZXJzaW9uLmpvaW4oJy4nKTtcblx0XHRcdG15by5pc0Nvbm5lY3RlZCA9IHRydWU7XG5cdFx0XHRteW8udHJpZ2dlcihkYXRhLnR5cGUsIGRhdGEpXG5cdFx0fSxcblx0XHQnZGlzY29ubmVjdGVkJyA6IGZ1bmN0aW9uKG15bywgZGF0YSl7XG5cdFx0XHRteW8uaXNDb25uZWN0ZWQgPSBmYWxzZTtcblx0XHRcdG15by50cmlnZ2VyKGRhdGEudHlwZSwgZGF0YSk7XG5cdFx0fVxuXHR9O1xuXG5cdHZhciBoYW5kbGVNZXNzYWdlID0gZnVuY3Rpb24obXNnKXtcblx0XHR2YXIgZGF0YSA9IEpTT04ucGFyc2UobXNnLmRhdGEpWzFdO1xuXHRcdGlmKE15by5teW9zW2RhdGEubXlvXSAmJiBldmVudFRhYmxlW2RhdGEudHlwZV0pe1xuXHRcdFx0ZXZlbnRUYWJsZVtkYXRhLnR5cGVdKE15by5teW9zW2RhdGEubXlvXSwgZGF0YSk7XG5cdFx0fVxuXHR9O1xuXG5cblx0LyoqXG5cdCAqIEV2ZW50eS1uZXNzXG5cdCAqL1xuXHR2YXIgdHJpZ2dlciA9IGZ1bmN0aW9uKGV2ZW50cywgZXZlbnROYW1lLCBhcmdzKXtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0Ly9cblx0XHRldmVudHMubWFwKGZ1bmN0aW9uKGV2ZW50KXtcblx0XHRcdGlmKGV2ZW50Lm5hbWUgPT0gZXZlbnROYW1lKSBldmVudC5mbi5hcHBseShzZWxmLCBhcmdzKTtcblx0XHRcdGlmKGV2ZW50Lm5hbWUgPT0gJyonKXtcblx0XHRcdFx0YXJncy51bnNoaWZ0KGV2ZW50TmFtZSlcblx0XHRcdFx0ZXZlbnQuZm4uYXBwbHkoc2VsZiwgYXJncyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH07XG5cdHZhciBvbiA9IGZ1bmN0aW9uKGV2ZW50cywgbmFtZSwgZm4pe1xuXHRcdHZhciBpZCA9IGdldFVuaXF1ZUlkKClcblx0XHRldmVudHMucHVzaCh7XG5cdFx0XHRpZCAgIDogaWQsXG5cdFx0XHRuYW1lIDogbmFtZSxcblx0XHRcdGZuICAgOiBmblxuXHRcdH0pO1xuXHRcdHJldHVybiBpZDtcblx0fTtcblx0dmFyIG9mZiA9IGZ1bmN0aW9uKGV2ZW50cywgbmFtZSl7XG5cdFx0ZXZlbnRzID0gZXZlbnRzLnJlZHVjZShmdW5jdGlvbihyZXN1bHQsIGV2ZW50KXtcblx0XHRcdGlmKGV2ZW50Lm5hbWUgPT0gbmFtZSB8fCBldmVudC5pZCA9PSBuYW1lKSB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQucHVzaChldmVudCk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0sIFtdKTtcblx0XHRyZXR1cm4gZXZlbnRzO1xuXHR9O1xuXG5cblxuXHR2YXIgbXlvSW5zdGFuY2UgPSB7XG5cdFx0aXNMb2NrZWQgOiBmYWxzZSxcblx0XHRpc0Nvbm5lY3RlZCA6IGZhbHNlLFxuXHRcdG9yaWVudGF0aW9uT2Zmc2V0IDoge3ggOiAwLHkgOiAwLHogOiAwLHcgOiAwfSxcblx0XHRsYXN0SU1VIDogdW5kZWZpbmVkLFxuXHRcdHNvY2tldCA6IHVuZGVmaW5lZCxcblx0XHRhcm0gOiB1bmRlZmluZWQsXG5cdFx0ZGlyZWN0aW9uIDogdW5kZWZpbmVkLFxuXHRcdGV2ZW50cyA6IFtdLFxuXG5cdFx0dHJpZ2dlciA6IGZ1bmN0aW9uKGV2ZW50TmFtZSl7XG5cdFx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5hcHBseShhcmd1bWVudHMpLnNsaWNlKDEpO1xuXHRcdFx0dHJpZ2dlci5jYWxsKHRoaXMsIE15by5ldmVudHMsIGV2ZW50TmFtZSwgYXJncyk7XG5cdFx0XHR0cmlnZ2VyLmNhbGwodGhpcywgdGhpcy5ldmVudHMsIGV2ZW50TmFtZSwgYXJncyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXHRcdG9uIDogZnVuY3Rpb24oZXZlbnROYW1lLCBmbil7XG5cdFx0XHRyZXR1cm4gb24odGhpcy5ldmVudHMsIGV2ZW50TmFtZSwgZm4pXG5cdFx0fSxcblx0XHRvZmYgOiBmdW5jdGlvbihldmVudE5hbWUpe1xuXHRcdFx0dGhpcy5ldmVudHMgPSBvZmYodGhpcy5ldmVudHMsIGV2ZW50TmFtZSk7XG5cdFx0fSxcblxuXHRcdHRpbWVyIDogZnVuY3Rpb24oc3RhdHVzLCB0aW1lb3V0LCBmbil7XG5cdFx0XHRpZihzdGF0dXMpe1xuXHRcdFx0XHR0aGlzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZuLmJpbmQodGhpcyksIHRpbWVvdXQpO1xuXHRcdFx0fWVsc2V7XG5cdFx0XHRcdGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXQpXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRsb2NrIDogZnVuY3Rpb24oKXtcblx0XHRcdGlmKHRoaXMuaXNMb2NrZWQpIHJldHVybiB0cnVlO1xuXHRcdFx0dGhpcy5pc0xvY2tlZCA9IHRydWU7XG5cdFx0XHR0aGlzLnRyaWdnZXIoJ2xvY2snKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cdFx0dW5sb2NrIDogZnVuY3Rpb24odGltZW91dCl7XG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5sb2NrVGltZW91dCk7XG5cdFx0XHRpZih0aW1lb3V0KXtcblx0XHRcdFx0dGhpcy5sb2NrVGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRzZWxmLmxvY2soKTtcblx0XHRcdFx0fSwgdGltZW91dCk7XG5cdFx0XHR9XG5cdFx0XHRpZighdGhpcy5pc0xvY2tlZCkgcmV0dXJuIHRoaXM7XG5cdFx0XHR0aGlzLmlzTG9ja2VkID0gZmFsc2U7XG5cdFx0XHR0aGlzLnRyaWdnZXIoJ3VubG9jaycpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblx0XHR6ZXJvT3JpZW50YXRpb24gOiBmdW5jdGlvbigpe1xuXHRcdFx0dGhpcy5vcmllbnRhdGlvbk9mZnNldCA9IHRoaXMuX2xhc3RRdWFudDtcblx0XHRcdHRoaXMudHJpZ2dlcignemVyb19vcmllbnRhdGlvbicpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblxuXHRcdHZpYnJhdGUgOiBmdW5jdGlvbihpbnRlbnNpdHkpe1xuXHRcdFx0aW50ZW5zaXR5ID0gaW50ZW5zaXR5IHx8ICdtZWRpdW0nO1xuXHRcdFx0TXlvLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KFsnY29tbWFuZCcse1xuXHRcdFx0XHRcImNvbW1hbmRcIjogXCJ2aWJyYXRlXCIsXG5cdFx0XHRcdFwibXlvXCI6IHRoaXMuaWQsXG5cdFx0XHRcdFwidHlwZVwiOiBpbnRlbnNpdHlcblx0XHRcdH1dKSk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXHRcdHJlcXVlc3RCbHVldG9vdGhTdHJlbmd0aCA6IGZ1bmN0aW9uKCl7XG5cdFx0XHRNeW8uc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoWydjb21tYW5kJyx7XG5cdFx0XHRcdFwiY29tbWFuZFwiOiBcInJlcXVlc3RfcnNzaVwiLFxuXHRcdFx0XHRcIm15b1wiOiB0aGlzLmlkXG5cdFx0XHR9XSkpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblx0fVxuXG5cblx0TXlvID0ge1xuXHRcdG9wdGlvbnMgOiB7XG5cdFx0XHRhcGlfdmVyc2lvbiA6IDMsXG5cdFx0XHRzb2NrZXRfdXJsICA6IFwid3M6Ly8xMjcuMC4wLjE6MTAxMzgvbXlvL1wiXG5cdFx0fSxcblx0XHRldmVudHMgOiBbXSxcblx0XHRteW9zIDogW10sXG5cblx0XHQvKipcblx0XHQgKiBNeW8gQ29uc3RydWN0b3Jcblx0XHQgKiBAcGFyYW0gIHtudW1iZXJ9IGlkXG5cdFx0ICogQHBhcmFtICB7b2JqZWN0fSBvcHRpb25zXG5cdFx0ICogQHJldHVybiB7bXlvfVxuXHRcdCAqL1xuXHRcdGNyZWF0ZSA6IGZ1bmN0aW9uKGlkLCBvcHRpb25zKXtcblx0XHRcdGlmKCFNeW8uc29ja2V0KSBNeW8uaW5pdFNvY2tldCgpO1xuXG5cdFx0XHRpZighaWQpIGlkID0gMDtcblx0XHRcdGlmKHR5cGVvZiBpZCA9PT0gXCJvYmplY3RcIikgb3B0aW9ucyA9IGlkO1xuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cblx0XHRcdHZhciBuZXdNeW8gPSBPYmplY3QuY3JlYXRlKG15b0luc3RhbmNlKTtcblx0XHRcdG5ld015by5vcHRpb25zID0gZXh0ZW5kKE15by5vcHRpb25zLCBvcHRpb25zKTtcblx0XHRcdG5ld015by5ldmVudHMgPSBbXTtcblx0XHRcdG5ld015by5pZCA9IGlkO1xuXHRcdFx0TXlvLm15b3NbaWRdID0gbmV3TXlvO1xuXHRcdFx0cmV0dXJuIG5ld015bztcblx0XHR9LFxuXG5cdFx0LyoqXG5cdFx0ICogRXZlbnQgZnVuY3Rpb25zXG5cdFx0ICovXG5cdFx0dHJpZ2dlciA6IGZ1bmN0aW9uKGV2ZW50TmFtZSl7XG5cdFx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5hcHBseShhcmd1bWVudHMpLnNsaWNlKDEpO1xuXHRcdFx0dHJpZ2dlci5jYWxsKE15bywgTXlvLmV2ZW50cywgZXZlbnROYW1lLCBhcmdzKTtcblx0XHRcdHJldHVybiBNeW87XG5cdFx0fSxcblx0XHRvbiA6IGZ1bmN0aW9uKGV2ZW50TmFtZSwgZm4pe1xuXHRcdFx0cmV0dXJuIG9uKE15by5ldmVudHMsIGV2ZW50TmFtZSwgZm4pXG5cdFx0fSxcblx0XHRpbml0U29ja2V0IDogZnVuY3Rpb24oKXtcblx0XHRcdE15by5zb2NrZXQgPSBuZXcgU29ja2V0KE15by5vcHRpb25zLnNvY2tldF91cmwgKyBNeW8ub3B0aW9ucy5hcGlfdmVyc2lvbik7XG5cdFx0XHRNeW8uc29ja2V0Lm9ubWVzc2FnZSA9IGhhbmRsZU1lc3NhZ2U7XG5cdFx0XHRNeW8uc29ja2V0Lm9uZXJyb3IgPSBmdW5jdGlvbigpe1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCdFUlI6IE15by5qcyBoYWQgYW4gZXJyb3Igd2l0aCB0aGUgc29ja2V0LiBEb3VibGUgY2hlY2sgdGhlIEFQSSB2ZXJzaW9uLicpO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblx0aWYodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIG1vZHVsZS5leHBvcnRzID0gTXlvO1xufSkoKTtcblxuXG5cblxuIiwiXG4vKipcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIGdsb2JhbCA9IChmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0pKCk7XG5cbi8qKlxuICogV2ViU29ja2V0IGNvbnN0cnVjdG9yLlxuICovXG5cbnZhciBXZWJTb2NrZXQgPSBnbG9iYWwuV2ViU29ja2V0IHx8IGdsb2JhbC5Nb3pXZWJTb2NrZXQ7XG5cbi8qKlxuICogTW9kdWxlIGV4cG9ydHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBXZWJTb2NrZXQgPyB3cyA6IG51bGw7XG5cbi8qKlxuICogV2ViU29ja2V0IGNvbnN0cnVjdG9yLlxuICpcbiAqIFRoZSB0aGlyZCBgb3B0c2Agb3B0aW9ucyBvYmplY3QgZ2V0cyBpZ25vcmVkIGluIHdlYiBicm93c2Vycywgc2luY2UgaXQnc1xuICogbm9uLXN0YW5kYXJkLCBhbmQgdGhyb3dzIGEgVHlwZUVycm9yIGlmIHBhc3NlZCB0byB0aGUgY29uc3RydWN0b3IuXG4gKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9laW5hcm9zL3dzL2lzc3Vlcy8yMjdcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJpXG4gKiBAcGFyYW0ge0FycmF5fSBwcm90b2NvbHMgKG9wdGlvbmFsKVxuICogQHBhcmFtIHtPYmplY3QpIG9wdHMgKG9wdGlvbmFsKVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiB3cyh1cmksIHByb3RvY29scywgb3B0cykge1xuICB2YXIgaW5zdGFuY2U7XG4gIGlmIChwcm90b2NvbHMpIHtcbiAgICBpbnN0YW5jZSA9IG5ldyBXZWJTb2NrZXQodXJpLCBwcm90b2NvbHMpO1xuICB9IGVsc2Uge1xuICAgIGluc3RhbmNlID0gbmV3IFdlYlNvY2tldCh1cmkpO1xuICB9XG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuaWYgKFdlYlNvY2tldCkgd3MucHJvdG90eXBlID0gV2ViU29ja2V0LnByb3RvdHlwZTtcbiIsInZhciBNeW8gPSByZXF1aXJlKCdteW8nKTtcbnZhciBTaGlwID0gcmVxdWlyZSgnLi9zaGlwJyk7XG5cbi8vIEhlbHBlciBtZXRob2RzIGZyb20gbXlvRXh0ZW5kZWRcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9NaXN0ZXJKYWNrNDkvbXlvUmV2ZWFsL2Jsb2IvbWFzdGVyL215b0V4dGVuZGVkLmpzXG5mdW5jdGlvbiBnZXRSb2xsKGRhdGEpIHtcbiAgdmFyIHJvbGwgPSBNYXRoLmF0YW4yKDIuMCAqIChkYXRhLncgKiBkYXRhLnggKyBkYXRhLnkgKiBkYXRhLnopLCAxLjAgLSAyLjAgKiAoZGF0YS54ICogZGF0YS54ICsgZGF0YS55ICogZGF0YS55KSk7XG4gIHZhciByb2xsX3cgPSAoKHJvbGwgKyBNYXRoLlBJKS8oTWF0aC5QSSAqIDIuMCkgKiAxOCk7XG4gIHJldHVybiByb2xsX3c7XG59XG5cbmZ1bmN0aW9uIGdldFBpdGNoKGRhdGEpIHtcbiAgdmFyIHBpdGNoID0gTWF0aC5hc2luKE1hdGgubWF4KC0xLjAsIE1hdGgubWluKDEuMCwgMi4wICogKGRhdGEudyAqIGRhdGEueSAtIGRhdGEueiAqIGRhdGEueCkpKSk7XG4gIHZhciBwaXRjaF93ID0gKChwaXRjaCArIE1hdGguUEkvMi4wKS9NYXRoLlBJICogMTgpO1xuICByZXR1cm4gcGl0Y2hfdztcbn1cblxuZnVuY3Rpb24gZ2V0WWF3KGRhdGEpIHtcbiAgdmFyIHlhdyA9IE1hdGguYXRhbjIoMi4wICogKGRhdGEudyAqIGRhdGEueiArIGRhdGEueCAqIGRhdGEueSksIDEuMCAtIDIuMCAqIChkYXRhLnkgKiBkYXRhLnkgKyBkYXRhLnogKiBkYXRhLnopKTtcbiAgdmFyIHlhd193ID0gKCh5YXcgKyBNYXRoLlBJLzIuMCkvTWF0aC5QSSAqIDE4KTtcbiAgcmV0dXJuIHlhd193O1xufVxuXG5cblxuLy8gTXkgQ29kZVxudmFyIHlWYWx1ZSA9IDA7XG52YXIgeFZhbHVlID0gMDtcbnZhciBiYXNlWWF3ID0gbnVsbDtcbnZhciBteW8gPSBNeW8uY3JlYXRlKCk7XG5cblxuZnVuY3Rpb24gZ2V0QmFzZVlhdyhkYXRhKSB7XG4gIGJhc2VZYXcgPSBnZXRZYXcoZGF0YS5sYXN0SU1VLm9yaWVudGF0aW9uKTtcbn1cblxuLy8gVXNlIHRoZSBhY2NlbGVyb21ldGVyIHRvIGdldCB0aGUgdXAvZG93biBwaXRjaCBvZiB0aGUgYXJtXG5teW8ub24oJ2FjY2VsZXJvbWV0ZXInLCBmdW5jdGlvbihkYXRhKSB7XG4gIGlmICh0aGlzLmRpcmVjdGlvbiA9PSAndG93YXJkX2VsYm93Jykge1xuICAgIHlWYWx1ZSA9IC1kYXRhLng7XG4gIH0gZWxzZSB7XG4gICAgeVZhbHVlID0gZGF0YS54O1xuICB9XG59KTtcblxuLy8gVXNlIHRoZSBvcmllbnRhdGlvbiB0byBnZXQgdGhlIFwieWF3XCIsIHdoaWNoIGNhbiBiZSB1c2VkIHRvIGRldGVybWluZVxuLy8gd2hpY2ggZGlyZWN0aW9uIHRoZSBhcm0gaXMgZmFjaW5nXG5teW8ub24oJ29yaWVudGF0aW9uJywgZnVuY3Rpb24oZGF0YSkge1xuICBpZiAoYmFzZVlhdyA9PT0gbnVsbClcbiAgICBnZXRCYXNlWWF3KHRoaXMpO1xuICB2YXIgdGhpc1lhdyA9IGdldFlhdyh0aGlzLmxhc3RJTVUub3JpZW50YXRpb24pO1xuICB4VmFsdWUgPSAtKHRoaXNZYXcgLSBiYXNlWWF3KSAvIDU7XG59KTtcblxuXG4vLyBNYWtlIGEgbmV3IHNjZW5lIGFuZCBjYW1lcmFcbnZhciBzY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xudmFyIGNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYShcbiAgNzUsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmllbGQgb2YgVmlld1xuICB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgICAvLyBBc3BlY3QgUmF0aW8gKG1hdGNoIHNjcmVlbiBzaXplKVxuICAwLjEsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBOZWFyXG4gIDEwMDAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZhclxuKTtcbmNhbWVyYS5wb3NpdGlvbi5zZXQoMCwgMTAsIDEwKTtcbmNhbWVyYS5sb29rQXQoc2NlbmUucG9zaXRpb24pO1xuXG4vLyBNYWtlIGEgcmVuZGVyZXIgYW5kIGFkZCBpdCB0byB0aGUgcGFnZVxudmFyIHJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoKTtcbnJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHJlbmRlcmVyLmRvbUVsZW1lbnQpO1xuXG4vLyBNYWtlIGEgY3ViZVxuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQm94R2VvbWV0cnkoMSwgMSwgMSk7XG5tYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7XG4gIGNvbG9yOiAweDAwZmYwMFxufSk7XG52YXIgY3ViZSA9IG5ldyBUSFJFRS5NZXNoKGdlb21ldHJ5LCBtYXRlcmlhbCk7XG5zY2VuZS5hZGQoY3ViZSk7XG5cbmNhbWVyYS5wb3NpdGlvbi56ID0gNTtcblxuLy8gUmVuZGVyIExvb3BcbmZ1bmN0aW9uIHJlbmRlcigpIHtcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlbmRlcik7XG4gIC8vY3ViZS50cmFuc2xhdGVZKHlWYWx1ZSk7XG4gIC8vY3ViZS50cmFuc2xhdGVYKHhWYWx1ZSk7XG4gIHJlbmRlcmVyLnJlbmRlcihzY2VuZSwgY2FtZXJhKTtcbn1cbnJlbmRlcigpO1xuIl19
