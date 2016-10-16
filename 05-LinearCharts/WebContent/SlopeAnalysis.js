//////////////////////////////////////////////////////////////////////////////////////////////////////
/*

 Javascript State Machine Library - https://github.com/jakesgordon/javascript-state-machine

 Copyright (c) 2012, 2013 Jake Gordon and contributors
 Released under the MIT license - https://github.com/jakesgordon/javascript-state-machine/blob/master/LICENSE

 */

(function(window) {

	var StateMachine = {

		// ---------------------------------------------------------------------------

		VERSION : "2.2.0",

		// ---------------------------------------------------------------------------

		Result : {
			SUCCEEDED : 1, // the event transitioned successfully from one
							// state to another
			NOTRANSITION : 2, // the event was successfull but no state
								// transition was necessary
			CANCELLED : 3, // the event was cancelled by the caller in a
							// beforeEvent callback
			PENDING : 4
		// the event is asynchronous and the caller is in control of when the
		// transition occurs
		},

		Error : {
			INVALID_TRANSITION : 100, // caller tried to fire an event that
										// was innapropriate in the current
										// state
			PENDING_TRANSITION : 200, // caller tried to fire an event while
										// an async transition was still pending
			INVALID_CALLBACK : 300
		// caller provided callback function threw an exception
		},

		WILDCARD : '*',
		ASYNC : 'async',

		// ---------------------------------------------------------------------------

		create : function(cfg, target) {

			var initial = (typeof cfg.initial == 'string') ? {
				state : cfg.initial
			} : cfg.initial; // allow for a simple string, or an object with
								// { state: 'foo', event: 'setup', defer:
								// true|false }
			var terminal = cfg.terminal || cfg['final'];
			var fsm = target || cfg.target || {};
			var events = cfg.events || [];
			var callbacks = cfg.callbacks || {};
			var map = {};

			var add = function(e) {
				var from = (e.from instanceof Array) ? e.from
						: (e.from ? [ e.from ] : [ StateMachine.WILDCARD ]); // allow
																				// 'wildcard'
																				// transition
																				// if
																				// 'from'
																				// is
																				// not
																				// specified
				map[e.name] = map[e.name] || {};
				for ( var n = 0; n < from.length; n++)
					map[e.name][from[n]] = e.to || from[n]; // allow no-op
															// transition if
															// 'to' is not
															// specified
			};

			if (initial) {
				initial.event = initial.event || 'startup';
				add({
					name : initial.event,
					from : 'none',
					to : initial.state
				});
			}

			for ( var n = 0; n < events.length; n++)
				add(events[n]);

			for ( var name in map) {
				if (map.hasOwnProperty(name))
					fsm[name] = StateMachine.buildEvent(name, map[name]);
			}

			for ( var name in callbacks) {
				if (callbacks.hasOwnProperty(name))
					fsm[name] = callbacks[name]
			}

			fsm.current = 'none';
			fsm.is = function(state) {
				return (state instanceof Array) ? (state.indexOf(this.current) >= 0)
						: (this.current === state);
			};
			fsm.can = function(event) {
				return !this.transition
						&& (map[event].hasOwnProperty(this.current) || map[event]
								.hasOwnProperty(StateMachine.WILDCARD));
			}
			fsm.cannot = function(event) {
				return !this.can(event);
			};
			fsm.error = cfg.error
					|| function(name, from, to, args, error, msg, e) {
						throw e || msg;
					}; // default behavior when something unexpected happens is
						// to throw an exception, but caller can override this
						// behavior if desired (see github issue #3 and #17)

			fsm.isFinished = function() {
				return this.is(terminal);
			};

			if (initial && !initial.defer)
				fsm[initial.event]();

			return fsm;

		},

		// ===========================================================================

		doCallback : function(fsm, func, name, from, to, args) {
			if (func) {
				try {
					return func.apply(fsm, [ name, from, to ].concat(args));
				} catch (e) {
					return fsm
							.error(
									name,
									from,
									to,
									args,
									StateMachine.Error.INVALID_CALLBACK,
									"an exception occurred in a caller-provided callback function",
									e);
				}
			}
		},

		beforeAnyEvent : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onbeforeevent'], name,
					from, to, args);
		},
		afterAnyEvent : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onafterevent']
					|| fsm['onevent'], name, from, to, args);
		},
		leaveAnyState : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onleavestate'], name,
					from, to, args);
		},
		enterAnyState : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onenterstate']
					|| fsm['onstate'], name, from, to, args);
		},
		changeState : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onchangestate'], name,
					from, to, args);
		},

		beforeThisEvent : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onbefore' + name], name,
					from, to, args);
		},
		afterThisEvent : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onafter' + name]
					|| fsm['on' + name], name, from, to, args);
		},
		leaveThisState : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onleave' + from], name,
					from, to, args);
		},
		enterThisState : function(fsm, name, from, to, args) {
			return StateMachine.doCallback(fsm, fsm['onenter' + to]
					|| fsm['on' + to], name, from, to, args);
		},

		beforeEvent : function(fsm, name, from, to, args) {
			if ((false === StateMachine.beforeThisEvent(fsm, name, from, to,
					args))
					|| (false === StateMachine.beforeAnyEvent(fsm, name, from,
							to, args)))
				return false;
		},

		afterEvent : function(fsm, name, from, to, args) {
			StateMachine.afterThisEvent(fsm, name, from, to, args);
			StateMachine.afterAnyEvent(fsm, name, from, to, args);
		},

		leaveState : function(fsm, name, from, to, args) {
			var specific = StateMachine.leaveThisState(fsm, name, from, to,
					args), general = StateMachine.leaveAnyState(fsm, name,
					from, to, args);
			if ((false === specific) || (false === general))
				return false;
			else if ((StateMachine.ASYNC === specific)
					|| (StateMachine.ASYNC === general))
				return StateMachine.ASYNC;
		},

		enterState : function(fsm, name, from, to, args) {
			StateMachine.enterThisState(fsm, name, from, to, args);
			StateMachine.enterAnyState(fsm, name, from, to, args);
		},

		// ===========================================================================

		buildEvent : function(name, map) {
			return function() {

				var from = this.current;
				var to = map[from] || map[StateMachine.WILDCARD] || from;
				var args = Array.prototype.slice.call(arguments); // turn
																	// arguments
																	// into pure
																	// array

				if (this.transition)
					return this
							.error(
									name,
									from,
									to,
									args,
									StateMachine.Error.PENDING_TRANSITION,
									"event "
											+ name
											+ " inappropriate because previous transition did not complete");

				if (this.cannot(name))
					return this.error(name, from, to, args,
							StateMachine.Error.INVALID_TRANSITION, "event "
									+ name + " inappropriate in current state "
									+ this.current);

				if (false === StateMachine.beforeEvent(this, name, from, to,
						args))
					return StateMachine.Result.CANCELLED;

				if (from === to) {
					StateMachine.afterEvent(this, name, from, to, args);
					return StateMachine.Result.NOTRANSITION;
				}

				// prepare a transition method for use EITHER lower down, or by
				// caller if they want an async transition (indicated by an
				// ASYNC return value from leaveState)
				var fsm = this;
				this.transition = function() {
					fsm.transition = null; // this method should only ever be
											// called once
					fsm.current = to;
					StateMachine.enterState(fsm, name, from, to, args);
					StateMachine.changeState(fsm, name, from, to, args);
					StateMachine.afterEvent(fsm, name, from, to, args);
					return StateMachine.Result.SUCCEEDED;
				};
				this.transition.cancel = function() { // provide a way for
														// caller to cancel
														// async transition if
														// desired (issue #22)
					fsm.transition = null;
					StateMachine.afterEvent(fsm, name, from, to, args);
				}

				var leave = StateMachine.leaveState(this, name, from, to, args);
				if (false === leave) {
					this.transition = null;
					return StateMachine.Result.CANCELLED;
				} else if (StateMachine.ASYNC === leave) {
					return StateMachine.Result.PENDING;
				} else {
					if (this.transition) // need to check in case user
											// manually called transition() but
											// forgot to return
											// StateMachine.ASYNC
						return this.transition();
				}

			};
		}

	}; // StateMachine

	// ===========================================================================

	if ("function" === typeof define) {
		define(function(require) {
			return StateMachine;
		});
	} else {
		window.StateMachine = StateMachine;
	}

}(this));

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Simulation de la lecture du tableau ID
var data = new Array("Titre", "500", "250", "250", "750", "750", "300");
var nbData = data.length;

var row;

var fsm = StateMachine.create({
	initial : 'Initial',
	events : [{
		name : 'StartDown',
		from : 'Initial',
		to : 'BeginDown'
	}, {
		name : 'StartUp',
		from : 'Initial',
		to : 'BeginUp'
	}, {
		name : 'StartEqual',
		from : 'Initial',
		to : 'BeginEqual'
	}, {
		name : 'BeginDownToDown',
		from : 'BeginDown',
		to : 'Down'
	}, {
		name : 'BeginDownToEqual',
		from : 'BeginDown',
		to : 'EndDownToEqual'
	}, {
		name : 'BeginDownToUp',
		from : 'BeginDown',
		to : 'EndDownToUp'
	}, {
		name : 'DownToEqual',
		from : 'Down',
		to : 'EndDownToEqual'
	}, {
		name : 'DownToDown',
		from : 'Down',
		to : 'Down'
	}, {
		name : 'DownToUp',
		from : 'Down',
		to : 'EndDownToUp'
	}, {
		name : 'BeginEqualToDown',
		from : 'BeginEqual',
		to : 'EndEqualToDown'
	}, {
		name : 'BeginEqualToEqual',
		from : 'BeginEqual',
		to : 'Equal'
	}, {
		name : 'BeginEqualToUp',
		from : 'BeginEqual',
		to : 'EndEqualToUp'
	}, {
		name : 'EqualToDown',
		from : 'Equal',
		to : 'EndEqualToDown'
	}, {
		name : 'EqualToEqual',
		from : 'Equal',
		to : 'Equal'
	}, {
		name : 'EqualToUp',
		from : 'Equal',
		to : 'EndEqualToUp'
	}, {
		name : 'BeginUpToEqual',
		from : 'BeginUp',
		to : 'EndUpToEqual'
	}, {
		name : 'BeginUpToDown',
		from : 'BeginUp',
		to : 'EndUpToDown'
	}, {
		name : 'BeginUpToUp',
		from : 'BeginUp',
		to : 'Up'
	}, {
		name : 'UpToUp',
		from : 'Up',
		to : 'Up'
	}, {
		name : 'UpToDown',
		from : 'Up',
		to : 'EndUpToDown'
	}, {
		name : 'UpToEqual',
		from : 'Up',
		to : 'EndUpToEqual'
	}],

	callbacks: {
		onenterbeginMerge: function(event, from, to) {
		},
		onentererge: function(event, from, to) {
		},
		onenterendMerge: function(event, from, to) {
			print("onenterendMerge");
			lastRow = row;
			print("lastRow : " + lastRow);
		}
	}
});

function Compare(i) {
	if(i < data.length-1) {
		if(data[i1] > data[i2]) {
			return 1;
		} else if (data[i1] < data[i2]) {
			return -1;
		} else {
			return 0;
		}
	} else {
		return -2;
	}
}

//print(nbRows);
var SlopeArray = [];
var maxiLocal, miniLocal;
var up, down;
var comp;

for (var i = 1; i < nbData-1; i++) {

	var X = {up:false, down:false, maxiLocal: false, miniLocal: false};

	comp = Compare(i);
//	print("Before :: row : " + row + " - Current state : " + fsm.current + " - Content : " + rowsArray[row]);
	switch(fsm.current) {
	case 'Initial':
		switch(comp) {
		case -1:
			X.maxiLocal = true;
			X.down = true;
			fsm.BeginDown();
			break;
		case 1:
			X.miniLocal = true;
			x.up = true;
			fsm.BeginUp();
			break;
		case 0:
			x.up = true;
			fsm.BeginEqual();
			break;
		}
		break;
	case 'BeginDown':
		X.down = true;
		switch(comp) {
		case -1:
			fsm.Down();
			break;
		case 1:
			fsm.EndDownToUp();
			break;
		case 0:
			fsm.EndDownToEqual();
			break;
		}
		break;
	case 'Down':
		X.down = true;
		switch(comp) {
		case -1:
			fsm.Down();
			break;
		case 1:
			fsm.EndDownToUp();
			break;
		case 0:
			fsm.EndDownToEqual();
			break;
		}
		break;
	case 'BeginUp':
		X.up = true;
		switch(comp) {
		case -1:
			X.maxiLocal = true;
			break;
		case 1:
			fsm.Up();
			break;
		case 0:
			fsm.EndUpToEqual();
			break;
		}
		break;
	case 'Up':
		X.up = true;
		switch(comp) {
		case -1:
			X.maxiLocal = true;
			break;
		case 1:
			fsm.Up();
			break;
		case 0:
			fsm.EndUpToEqual();
			break;
		}
		break;
	case 'BeginEqual':
		var x = SlopeArray.pop();
		up = x.up;
		down = x.down;
		SlopeArray.push(x);
		switch(comp) {
		case -1:
			fsm.EndEqualToDown();
			break;
		case 1:
			fsm.EndEqualToUp();
			break;
		case 0:
			fsm.Equal();
			break;
		}
		break;
	case 'Equal':
		var x = SlopeArray.pop();
		up = x.up;
		down = x.down;
		SlopeArray.push(x);
		switch(comp) {
		case -1:
			fsm.EndEqualToDown();
			break;
		case 1:
			fsm.EndEqualToUp();
			break;
		case 0:
			fsm.Equal();
			break;
		}
		break;
	case 'EndDownToEqual':
		var x = SlopeArray.pop();
		x.maxiLocal = false;
		x.miniLocal = false;
		SlopeArray.push(x);
		fsm.BeginEqual();
		break;
	case 'EndDownToUp':
		var x = SlopeArray.pop();
		x.maxiLocal = false;
		x.miniLocal = true;
		SlopeArray.push(x);
		fsm.BeginUp();
		break;
	case 'EndEqualToDown':
		var x = SlopeArray.pop();
		if(x.up) { x.maxiLocal = true; x.miniLocal = false; }
		if(x.down) { x.maxiLocal = false; x.miniLocal = true; }
		SlopeArray.push(x);
		fsm.BeginDown();
		break;
	case 'EndEqualToUp':
		var x = SlopeArray.pop();
		if(x.up) { x.maxiLocal = false; x.miniLocal = true; }
		if(x.down) { x.maxiLocal = true; x.miniLocal = false; }
		SlopeArray.push(x);
		fsm.BeginUp();
		break;
	case 'EndUpToEqual':
		var x = SlopeArray.pop();
		x.maxiLocal = false;
		x.miniLocal = false;
		SlopeArray.push(x);
		fsm.BeginEqual();
		break;
	case 'EndUpToDown':
		fsm.BeginDown();
		break;
	case 'Finish':
		break;
	}

	SlopeArray.push(X);

//	print("After :: row : " + row + " - Current state : " + fsm.current + " - Content : " + rowsArray[row]);
//	print("");
}