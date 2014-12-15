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

},{"myo":"/Users/alex/Projects/experiements/cubefield-myo/node_modules/myo/myo.js"}]},{},["/Users/alex/Projects/experiements/cubefield-myo/src/app.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbXlvL215by5qcyIsIm5vZGVfbW9kdWxlcy9teW8vbm9kZV9tb2R1bGVzL3dzL2xpYi9icm93c2VyLmpzIiwic3JjL2FwcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uKCl7XG5cblx0dmFyIFNvY2tldDtcblx0aWYodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpe1xuXHRcdFNvY2tldCA9IHJlcXVpcmUoJ3dzJyk7XG5cdH1lbHNlIHtcblx0XHRpZiAoIShcIldlYlNvY2tldFwiIGluIHdpbmRvdykpe1xuXHRcdFx0Y29uc29sZS5lcnJvcignTXlvLmpzIDogU29ja2V0cyBub3Qgc3VwcG9ydGVkIDooJyk7XG5cdFx0fVxuXHRcdFNvY2tldCA9IFdlYlNvY2tldDtcblx0fVxuXHQvKipcblx0ICogVXRpbHNcblx0ICovXG5cdHZhciBleHRlbmQgPSBmdW5jdGlvbigpe1xuXHRcdHZhciByZXN1bHQgPSB7fTtcblx0XHRmb3IodmFyIGkgaW4gYXJndW1lbnRzKXtcblx0XHRcdHZhciBvYmogPSBhcmd1bWVudHNbaV07XG5cdFx0XHRmb3IodmFyIHByb3BOYW1lIGluIG9iail7XG5cdFx0XHRcdGlmKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSkpeyByZXN1bHRbcHJvcE5hbWVdID0gb2JqW3Byb3BOYW1lXTsgfVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9O1xuXHR2YXIgdW5pcXVlX2NvdW50ZXIgPSAwO1xuXHR2YXIgZ2V0VW5pcXVlSWQgPSBmdW5jdGlvbigpe1xuXHRcdHVuaXF1ZV9jb3VudGVyKys7XG5cdFx0cmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgXCJcIiArIHVuaXF1ZV9jb3VudGVyO1xuXHR9XG5cblxuXHR2YXIgZXZlbnRUYWJsZSA9IHtcblx0XHQncG9zZScgOiBmdW5jdGlvbihteW8sIGRhdGEpe1xuXHRcdFx0aWYobXlvLmxhc3RQb3NlICE9ICdyZXN0JyAmJiBkYXRhLnBvc2UgPT0gJ3Jlc3QnKXtcblx0XHRcdFx0bXlvLnRyaWdnZXIobXlvLmxhc3RQb3NlLCBmYWxzZSk7XG5cdFx0XHRcdG15by50cmlnZ2VyKCdwb3NlJywgbXlvLmxhc3RQb3NlLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHRteW8udHJpZ2dlcihkYXRhLnBvc2UsIHRydWUpO1xuXHRcdFx0bXlvLnRyaWdnZXIoJ3Bvc2UnLCBkYXRhLnBvc2UsIHRydWUpO1xuXHRcdFx0bXlvLmxhc3RQb3NlID0gZGF0YS5wb3NlO1xuXHRcdH0sXG5cdFx0J3Jzc2knIDogZnVuY3Rpb24obXlvLCBkYXRhKXtcblx0XHRcdG15by50cmlnZ2VyKCdibHVldG9vdGhfc3RyZW5ndGgnLCBkYXRhLnJzc2kpO1xuXHRcdH0sXG5cdFx0J29yaWVudGF0aW9uJyA6IGZ1bmN0aW9uKG15bywgZGF0YSl7XG5cdFx0XHRteW8uX2xhc3RRdWFudCA9IGRhdGEub3JpZW50YXRpb247XG5cdFx0XHR2YXIgaW11X2RhdGEgPSB7XG5cdFx0XHRcdG9yaWVudGF0aW9uIDoge1xuXHRcdFx0XHRcdHggOiBkYXRhLm9yaWVudGF0aW9uLnggLSBteW8ub3JpZW50YXRpb25PZmZzZXQueCxcblx0XHRcdFx0XHR5IDogZGF0YS5vcmllbnRhdGlvbi55IC0gbXlvLm9yaWVudGF0aW9uT2Zmc2V0LnksXG5cdFx0XHRcdFx0eiA6IGRhdGEub3JpZW50YXRpb24ueiAtIG15by5vcmllbnRhdGlvbk9mZnNldC56LFxuXHRcdFx0XHRcdHcgOiBkYXRhLm9yaWVudGF0aW9uLncgLSBteW8ub3JpZW50YXRpb25PZmZzZXQud1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRhY2NlbGVyb21ldGVyIDoge1xuXHRcdFx0XHRcdHggOiBkYXRhLmFjY2VsZXJvbWV0ZXJbMF0sXG5cdFx0XHRcdFx0eSA6IGRhdGEuYWNjZWxlcm9tZXRlclsxXSxcblx0XHRcdFx0XHR6IDogZGF0YS5hY2NlbGVyb21ldGVyWzJdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGd5cm9zY29wZSA6IHtcblx0XHRcdFx0XHR4IDogZGF0YS5neXJvc2NvcGVbMF0sXG5cdFx0XHRcdFx0eSA6IGRhdGEuZ3lyb3Njb3BlWzFdLFxuXHRcdFx0XHRcdHogOiBkYXRhLmd5cm9zY29wZVsyXVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZighbXlvLmxhc3RJTVUpIG15by5sYXN0SU1VID0gaW11X2RhdGE7XG5cdFx0XHRteW8udHJpZ2dlcignb3JpZW50YXRpb24nLCAgIGltdV9kYXRhLm9yaWVudGF0aW9uKTtcblx0XHRcdG15by50cmlnZ2VyKCdhY2NlbGVyb21ldGVyJywgaW11X2RhdGEuYWNjZWxlcm9tZXRlcik7XG5cdFx0XHRteW8udHJpZ2dlcignZ3lyb3Njb3BlJywgICAgIGltdV9kYXRhLmd5cm9zY29wZSk7XG5cdFx0XHRteW8udHJpZ2dlcignaW11JywgICAgICAgICAgIGltdV9kYXRhKTtcblx0XHRcdG15by5sYXN0SU1VID0gaW11X2RhdGE7XG5cdFx0fSxcblx0XHQnYXJtX3N5bmNlZCcgOiBmdW5jdGlvbihteW8sIGRhdGEpe1xuXHRcdFx0bXlvLmFybSA9IGRhdGEuYXJtO1xuXHRcdFx0bXlvLmRpcmVjdGlvbiA9IGRhdGEueF9kaXJlY3Rpb247XG5cdFx0XHRteW8udHJpZ2dlcihkYXRhLnR5cGUsIGRhdGEpO1xuXHRcdH0sXG5cdFx0J2FybV91bnN5bmNlZCcgOiBmdW5jdGlvbihteW8sIGRhdGEpe1xuXHRcdFx0bXlvLmFybSA9IHVuZGVmaW5lZDtcblx0XHRcdG15by5kaXJlY3Rpb24gPSB1bmRlZmluZWQ7XG5cdFx0XHRteW8udHJpZ2dlcihkYXRhLnR5cGUsIGRhdGEpO1xuXHRcdH0sXG5cdFx0J2Nvbm5lY3RlZCcgOiBmdW5jdGlvbihteW8sIGRhdGEpe1xuXHRcdFx0bXlvLmNvbm5lY3RfdmVyc2lvbiA9IGRhdGEudmVyc2lvbi5qb2luKCcuJyk7XG5cdFx0XHRteW8uaXNDb25uZWN0ZWQgPSB0cnVlO1xuXHRcdFx0bXlvLnRyaWdnZXIoZGF0YS50eXBlLCBkYXRhKVxuXHRcdH0sXG5cdFx0J2Rpc2Nvbm5lY3RlZCcgOiBmdW5jdGlvbihteW8sIGRhdGEpe1xuXHRcdFx0bXlvLmlzQ29ubmVjdGVkID0gZmFsc2U7XG5cdFx0XHRteW8udHJpZ2dlcihkYXRhLnR5cGUsIGRhdGEpO1xuXHRcdH1cblx0fTtcblxuXHR2YXIgaGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uKG1zZyl7XG5cdFx0dmFyIGRhdGEgPSBKU09OLnBhcnNlKG1zZy5kYXRhKVsxXTtcblx0XHRpZihNeW8ubXlvc1tkYXRhLm15b10gJiYgZXZlbnRUYWJsZVtkYXRhLnR5cGVdKXtcblx0XHRcdGV2ZW50VGFibGVbZGF0YS50eXBlXShNeW8ubXlvc1tkYXRhLm15b10sIGRhdGEpO1xuXHRcdH1cblx0fTtcblxuXG5cdC8qKlxuXHQgKiBFdmVudHktbmVzc1xuXHQgKi9cblx0dmFyIHRyaWdnZXIgPSBmdW5jdGlvbihldmVudHMsIGV2ZW50TmFtZSwgYXJncyl7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdC8vXG5cdFx0ZXZlbnRzLm1hcChmdW5jdGlvbihldmVudCl7XG5cdFx0XHRpZihldmVudC5uYW1lID09IGV2ZW50TmFtZSkgZXZlbnQuZm4uYXBwbHkoc2VsZiwgYXJncyk7XG5cdFx0XHRpZihldmVudC5uYW1lID09ICcqJyl7XG5cdFx0XHRcdGFyZ3MudW5zaGlmdChldmVudE5hbWUpXG5cdFx0XHRcdGV2ZW50LmZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9O1xuXHR2YXIgb24gPSBmdW5jdGlvbihldmVudHMsIG5hbWUsIGZuKXtcblx0XHR2YXIgaWQgPSBnZXRVbmlxdWVJZCgpXG5cdFx0ZXZlbnRzLnB1c2goe1xuXHRcdFx0aWQgICA6IGlkLFxuXHRcdFx0bmFtZSA6IG5hbWUsXG5cdFx0XHRmbiAgIDogZm5cblx0XHR9KTtcblx0XHRyZXR1cm4gaWQ7XG5cdH07XG5cdHZhciBvZmYgPSBmdW5jdGlvbihldmVudHMsIG5hbWUpe1xuXHRcdGV2ZW50cyA9IGV2ZW50cy5yZWR1Y2UoZnVuY3Rpb24ocmVzdWx0LCBldmVudCl7XG5cdFx0XHRpZihldmVudC5uYW1lID09IG5hbWUgfHwgZXZlbnQuaWQgPT0gbmFtZSkge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2goZXZlbnQpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9LCBbXSk7XG5cdFx0cmV0dXJuIGV2ZW50cztcblx0fTtcblxuXG5cblx0dmFyIG15b0luc3RhbmNlID0ge1xuXHRcdGlzTG9ja2VkIDogZmFsc2UsXG5cdFx0aXNDb25uZWN0ZWQgOiBmYWxzZSxcblx0XHRvcmllbnRhdGlvbk9mZnNldCA6IHt4IDogMCx5IDogMCx6IDogMCx3IDogMH0sXG5cdFx0bGFzdElNVSA6IHVuZGVmaW5lZCxcblx0XHRzb2NrZXQgOiB1bmRlZmluZWQsXG5cdFx0YXJtIDogdW5kZWZpbmVkLFxuXHRcdGRpcmVjdGlvbiA6IHVuZGVmaW5lZCxcblx0XHRldmVudHMgOiBbXSxcblxuXHRcdHRyaWdnZXIgOiBmdW5jdGlvbihldmVudE5hbWUpe1xuXHRcdFx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuYXBwbHkoYXJndW1lbnRzKS5zbGljZSgxKTtcblx0XHRcdHRyaWdnZXIuY2FsbCh0aGlzLCBNeW8uZXZlbnRzLCBldmVudE5hbWUsIGFyZ3MpO1xuXHRcdFx0dHJpZ2dlci5jYWxsKHRoaXMsIHRoaXMuZXZlbnRzLCBldmVudE5hbWUsIGFyZ3MpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblx0XHRvbiA6IGZ1bmN0aW9uKGV2ZW50TmFtZSwgZm4pe1xuXHRcdFx0cmV0dXJuIG9uKHRoaXMuZXZlbnRzLCBldmVudE5hbWUsIGZuKVxuXHRcdH0sXG5cdFx0b2ZmIDogZnVuY3Rpb24oZXZlbnROYW1lKXtcblx0XHRcdHRoaXMuZXZlbnRzID0gb2ZmKHRoaXMuZXZlbnRzLCBldmVudE5hbWUpO1xuXHRcdH0sXG5cblx0XHR0aW1lciA6IGZ1bmN0aW9uKHN0YXR1cywgdGltZW91dCwgZm4pe1xuXHRcdFx0aWYoc3RhdHVzKXtcblx0XHRcdFx0dGhpcy50aW1lb3V0ID0gc2V0VGltZW91dChmbi5iaW5kKHRoaXMpLCB0aW1lb3V0KTtcblx0XHRcdH1lbHNle1xuXHRcdFx0XHRjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0bG9jayA6IGZ1bmN0aW9uKCl7XG5cdFx0XHRpZih0aGlzLmlzTG9ja2VkKSByZXR1cm4gdHJ1ZTtcblx0XHRcdHRoaXMuaXNMb2NrZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy50cmlnZ2VyKCdsb2NrJyk7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9LFxuXHRcdHVubG9jayA6IGZ1bmN0aW9uKHRpbWVvdXQpe1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMubG9ja1RpbWVvdXQpO1xuXHRcdFx0aWYodGltZW91dCl7XG5cdFx0XHRcdHRoaXMubG9ja1RpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0c2VsZi5sb2NrKCk7XG5cdFx0XHRcdH0sIHRpbWVvdXQpO1xuXHRcdFx0fVxuXHRcdFx0aWYoIXRoaXMuaXNMb2NrZWQpIHJldHVybiB0aGlzO1xuXHRcdFx0dGhpcy5pc0xvY2tlZCA9IGZhbHNlO1xuXHRcdFx0dGhpcy50cmlnZ2VyKCd1bmxvY2snKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cdFx0emVyb09yaWVudGF0aW9uIDogZnVuY3Rpb24oKXtcblx0XHRcdHRoaXMub3JpZW50YXRpb25PZmZzZXQgPSB0aGlzLl9sYXN0UXVhbnQ7XG5cdFx0XHR0aGlzLnRyaWdnZXIoJ3plcm9fb3JpZW50YXRpb24nKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cblx0XHR2aWJyYXRlIDogZnVuY3Rpb24oaW50ZW5zaXR5KXtcblx0XHRcdGludGVuc2l0eSA9IGludGVuc2l0eSB8fCAnbWVkaXVtJztcblx0XHRcdE15by5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShbJ2NvbW1hbmQnLHtcblx0XHRcdFx0XCJjb21tYW5kXCI6IFwidmlicmF0ZVwiLFxuXHRcdFx0XHRcIm15b1wiOiB0aGlzLmlkLFxuXHRcdFx0XHRcInR5cGVcIjogaW50ZW5zaXR5XG5cdFx0XHR9XSkpO1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fSxcblx0XHRyZXF1ZXN0Qmx1ZXRvb3RoU3RyZW5ndGggOiBmdW5jdGlvbigpe1xuXHRcdFx0TXlvLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KFsnY29tbWFuZCcse1xuXHRcdFx0XHRcImNvbW1hbmRcIjogXCJyZXF1ZXN0X3Jzc2lcIixcblx0XHRcdFx0XCJteW9cIjogdGhpcy5pZFxuXHRcdFx0fV0pKTtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH0sXG5cdH1cblxuXG5cdE15byA9IHtcblx0XHRvcHRpb25zIDoge1xuXHRcdFx0YXBpX3ZlcnNpb24gOiAzLFxuXHRcdFx0c29ja2V0X3VybCAgOiBcIndzOi8vMTI3LjAuMC4xOjEwMTM4L215by9cIlxuXHRcdH0sXG5cdFx0ZXZlbnRzIDogW10sXG5cdFx0bXlvcyA6IFtdLFxuXG5cdFx0LyoqXG5cdFx0ICogTXlvIENvbnN0cnVjdG9yXG5cdFx0ICogQHBhcmFtICB7bnVtYmVyfSBpZFxuXHRcdCAqIEBwYXJhbSAge29iamVjdH0gb3B0aW9uc1xuXHRcdCAqIEByZXR1cm4ge215b31cblx0XHQgKi9cblx0XHRjcmVhdGUgOiBmdW5jdGlvbihpZCwgb3B0aW9ucyl7XG5cdFx0XHRpZighTXlvLnNvY2tldCkgTXlvLmluaXRTb2NrZXQoKTtcblxuXHRcdFx0aWYoIWlkKSBpZCA9IDA7XG5cdFx0XHRpZih0eXBlb2YgaWQgPT09IFwib2JqZWN0XCIpIG9wdGlvbnMgPSBpZDtcblx0XHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG5cdFx0XHR2YXIgbmV3TXlvID0gT2JqZWN0LmNyZWF0ZShteW9JbnN0YW5jZSk7XG5cdFx0XHRuZXdNeW8ub3B0aW9ucyA9IGV4dGVuZChNeW8ub3B0aW9ucywgb3B0aW9ucyk7XG5cdFx0XHRuZXdNeW8uZXZlbnRzID0gW107XG5cdFx0XHRuZXdNeW8uaWQgPSBpZDtcblx0XHRcdE15by5teW9zW2lkXSA9IG5ld015bztcblx0XHRcdHJldHVybiBuZXdNeW87XG5cdFx0fSxcblxuXHRcdC8qKlxuXHRcdCAqIEV2ZW50IGZ1bmN0aW9uc1xuXHRcdCAqL1xuXHRcdHRyaWdnZXIgOiBmdW5jdGlvbihldmVudE5hbWUpe1xuXHRcdFx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuYXBwbHkoYXJndW1lbnRzKS5zbGljZSgxKTtcblx0XHRcdHRyaWdnZXIuY2FsbChNeW8sIE15by5ldmVudHMsIGV2ZW50TmFtZSwgYXJncyk7XG5cdFx0XHRyZXR1cm4gTXlvO1xuXHRcdH0sXG5cdFx0b24gOiBmdW5jdGlvbihldmVudE5hbWUsIGZuKXtcblx0XHRcdHJldHVybiBvbihNeW8uZXZlbnRzLCBldmVudE5hbWUsIGZuKVxuXHRcdH0sXG5cdFx0aW5pdFNvY2tldCA6IGZ1bmN0aW9uKCl7XG5cdFx0XHRNeW8uc29ja2V0ID0gbmV3IFNvY2tldChNeW8ub3B0aW9ucy5zb2NrZXRfdXJsICsgTXlvLm9wdGlvbnMuYXBpX3ZlcnNpb24pO1xuXHRcdFx0TXlvLnNvY2tldC5vbm1lc3NhZ2UgPSBoYW5kbGVNZXNzYWdlO1xuXHRcdFx0TXlvLnNvY2tldC5vbmVycm9yID0gZnVuY3Rpb24oKXtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignRVJSOiBNeW8uanMgaGFkIGFuIGVycm9yIHdpdGggdGhlIHNvY2tldC4gRG91YmxlIGNoZWNrIHRoZSBBUEkgdmVyc2lvbi4nKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cdGlmKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IE15bztcbn0pKCk7XG5cblxuXG5cbiIsIlxuLyoqXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICovXG5cbnZhciBnbG9iYWwgPSAoZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSgpO1xuXG4vKipcbiAqIFdlYlNvY2tldCBjb25zdHJ1Y3Rvci5cbiAqL1xuXG52YXIgV2ViU29ja2V0ID0gZ2xvYmFsLldlYlNvY2tldCB8fCBnbG9iYWwuTW96V2ViU29ja2V0O1xuXG4vKipcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gV2ViU29ja2V0ID8gd3MgOiBudWxsO1xuXG4vKipcbiAqIFdlYlNvY2tldCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBUaGUgdGhpcmQgYG9wdHNgIG9wdGlvbnMgb2JqZWN0IGdldHMgaWdub3JlZCBpbiB3ZWIgYnJvd3NlcnMsIHNpbmNlIGl0J3NcbiAqIG5vbi1zdGFuZGFyZCwgYW5kIHRocm93cyBhIFR5cGVFcnJvciBpZiBwYXNzZWQgdG8gdGhlIGNvbnN0cnVjdG9yLlxuICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZWluYXJvcy93cy9pc3N1ZXMvMjI3XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHVyaVxuICogQHBhcmFtIHtBcnJheX0gcHJvdG9jb2xzIChvcHRpb25hbClcbiAqIEBwYXJhbSB7T2JqZWN0KSBvcHRzIChvcHRpb25hbClcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gd3ModXJpLCBwcm90b2NvbHMsIG9wdHMpIHtcbiAgdmFyIGluc3RhbmNlO1xuICBpZiAocHJvdG9jb2xzKSB7XG4gICAgaW5zdGFuY2UgPSBuZXcgV2ViU29ja2V0KHVyaSwgcHJvdG9jb2xzKTtcbiAgfSBlbHNlIHtcbiAgICBpbnN0YW5jZSA9IG5ldyBXZWJTb2NrZXQodXJpKTtcbiAgfVxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbmlmIChXZWJTb2NrZXQpIHdzLnByb3RvdHlwZSA9IFdlYlNvY2tldC5wcm90b3R5cGU7XG4iLCJ2YXIgTXlvID0gcmVxdWlyZSgnbXlvJyk7XG5cbi8vIEhlbHBlciBtZXRob2RzIGZyb20gbXlvRXh0ZW5kZWRcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9NaXN0ZXJKYWNrNDkvbXlvUmV2ZWFsL2Jsb2IvbWFzdGVyL215b0V4dGVuZGVkLmpzXG5mdW5jdGlvbiBnZXRSb2xsKGRhdGEpIHtcbiAgdmFyIHJvbGwgPSBNYXRoLmF0YW4yKDIuMCAqIChkYXRhLncgKiBkYXRhLnggKyBkYXRhLnkgKiBkYXRhLnopLCAxLjAgLSAyLjAgKiAoZGF0YS54ICogZGF0YS54ICsgZGF0YS55ICogZGF0YS55KSk7XG4gIHZhciByb2xsX3cgPSAoKHJvbGwgKyBNYXRoLlBJKS8oTWF0aC5QSSAqIDIuMCkgKiAxOCk7XG4gIHJldHVybiByb2xsX3c7XG59XG5cbmZ1bmN0aW9uIGdldFBpdGNoKGRhdGEpIHtcbiAgdmFyIHBpdGNoID0gTWF0aC5hc2luKE1hdGgubWF4KC0xLjAsIE1hdGgubWluKDEuMCwgMi4wICogKGRhdGEudyAqIGRhdGEueSAtIGRhdGEueiAqIGRhdGEueCkpKSk7XG4gIHZhciBwaXRjaF93ID0gKChwaXRjaCArIE1hdGguUEkvMi4wKS9NYXRoLlBJICogMTgpO1xuICByZXR1cm4gcGl0Y2hfdztcbn1cblxuZnVuY3Rpb24gZ2V0WWF3KGRhdGEpIHtcbiAgdmFyIHlhdyA9IE1hdGguYXRhbjIoMi4wICogKGRhdGEudyAqIGRhdGEueiArIGRhdGEueCAqIGRhdGEueSksIDEuMCAtIDIuMCAqIChkYXRhLnkgKiBkYXRhLnkgKyBkYXRhLnogKiBkYXRhLnopKTtcbiAgdmFyIHlhd193ID0gKCh5YXcgKyBNYXRoLlBJLzIuMCkvTWF0aC5QSSAqIDE4KTtcbiAgcmV0dXJuIHlhd193O1xufVxuXG5cblxuLy8gTXkgQ29kZVxudmFyIHlWYWx1ZSA9IDA7XG52YXIgeFZhbHVlID0gMDtcbnZhciBiYXNlWWF3ID0gbnVsbDtcbnZhciBteW8gPSBNeW8uY3JlYXRlKCk7XG5cblxuZnVuY3Rpb24gZ2V0QmFzZVlhdyhkYXRhKSB7XG4gIGJhc2VZYXcgPSBnZXRZYXcoZGF0YS5sYXN0SU1VLm9yaWVudGF0aW9uKTtcbn1cblxuLy8gVXNlIHRoZSBhY2NlbGVyb21ldGVyIHRvIGdldCB0aGUgdXAvZG93biBwaXRjaCBvZiB0aGUgYXJtXG5teW8ub24oJ2FjY2VsZXJvbWV0ZXInLCBmdW5jdGlvbihkYXRhKSB7XG4gIGlmICh0aGlzLmRpcmVjdGlvbiA9PSAndG93YXJkX2VsYm93Jykge1xuICAgIHlWYWx1ZSA9IC1kYXRhLng7XG4gIH0gZWxzZSB7XG4gICAgeVZhbHVlID0gZGF0YS54O1xuICB9XG59KTtcblxuLy8gVXNlIHRoZSBvcmllbnRhdGlvbiB0byBnZXQgdGhlIFwieWF3XCIsIHdoaWNoIGNhbiBiZSB1c2VkIHRvIGRldGVybWluZVxuLy8gd2hpY2ggZGlyZWN0aW9uIHRoZSBhcm0gaXMgZmFjaW5nXG5teW8ub24oJ29yaWVudGF0aW9uJywgZnVuY3Rpb24oZGF0YSkge1xuICBpZiAoYmFzZVlhdyA9PT0gbnVsbClcbiAgICBnZXRCYXNlWWF3KHRoaXMpO1xuICB2YXIgdGhpc1lhdyA9IGdldFlhdyh0aGlzLmxhc3RJTVUub3JpZW50YXRpb24pO1xuICB4VmFsdWUgPSAtKHRoaXNZYXcgLSBiYXNlWWF3KSAvIDU7XG59KTtcblxuXG4vLyBNYWtlIGEgbmV3IHNjZW5lIGFuZCBjYW1lcmFcbnZhciBzY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xudmFyIGNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYShcbiAgNzUsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmllbGQgb2YgVmlld1xuICB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCwgICAvLyBBc3BlY3QgUmF0aW8gKG1hdGNoIHNjcmVlbiBzaXplKVxuICAwLjEsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBOZWFyXG4gIDEwMDAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZhclxuKTtcbmNhbWVyYS5wb3NpdGlvbi5zZXQoMCwgMTAsIDEwKTtcbmNhbWVyYS5sb29rQXQoc2NlbmUucG9zaXRpb24pO1xuXG4vLyBNYWtlIGEgcmVuZGVyZXIgYW5kIGFkZCBpdCB0byB0aGUgcGFnZVxudmFyIHJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoKTtcbnJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHJlbmRlcmVyLmRvbUVsZW1lbnQpO1xuXG4vLyBNYWtlIGEgY3ViZVxuZ2VvbWV0cnkgPSBuZXcgVEhSRUUuQm94R2VvbWV0cnkoMSwgMSwgMSk7XG5tYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7XG4gIGNvbG9yOiAweDAwZmYwMFxufSk7XG52YXIgY3ViZSA9IG5ldyBUSFJFRS5NZXNoKGdlb21ldHJ5LCBtYXRlcmlhbCk7XG5zY2VuZS5hZGQoY3ViZSk7XG5cbmNhbWVyYS5wb3NpdGlvbi56ID0gNTtcblxuLy8gUmVuZGVyIExvb3BcbmZ1bmN0aW9uIHJlbmRlcigpIHtcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlbmRlcik7XG4gIC8vY3ViZS50cmFuc2xhdGVZKHlWYWx1ZSk7XG4gIC8vY3ViZS50cmFuc2xhdGVYKHhWYWx1ZSk7XG4gIHJlbmRlcmVyLnJlbmRlcihzY2VuZSwgY2FtZXJhKTtcbn1cbnJlbmRlcigpO1xuIl19
