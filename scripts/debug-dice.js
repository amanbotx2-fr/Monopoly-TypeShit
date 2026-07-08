// ── MOVE DEBUG v3 — paste into Chrome DevTools Console ───────────────────────
// Stores raw performance.now() timestamps. Computes durations from min/max.
(() => {
	var T0 = performance.now();
	var ms = function () {
		return (performance.now() - T0).toFixed(0);
	};
	var log = function (icon, msg) {
		console.log('%c[' + ms() + 'ms] ' + icon + ' ' + msg, 'font-weight:bold;color:#0cf');
	};

	var moveN = 0,
		timeline = [],
		doneTimer = 0;
	var add = function (what, detail) {
		timeline.push({ ms: performance.now(), what: what, detail: detail });
	};

	function wrapUp() {
		if (timeline.length === 0) return;
		var times = timeline.map(function (t) {
			return t.ms;
		});
		var t0 = Math.min.apply(null, times);
		var t1 = Math.max.apply(null, times);
		var dur = t1 - t0;
		var tokens = timeline.filter(function (t) {
			return t.what === 'token';
		});
		var firstTok = tokens.length ? tokens[0].ms : 0;
		var lastTok = tokens.length ? tokens[tokens.length - 1].ms : 0;
		var diceOn = null,
			diceOff = null;
		for (var i = 0; i < timeline.length; i++) {
			if (timeline[i].what === 'dice-on' && !diceOn) diceOn = timeline[i];
			if (timeline[i].what === 'dice-off') diceOff = timeline[i];
		}

		console.log(
			'\n%c=== MOVE #' + moveN + ' — ' + dur.toFixed(0) + 'ms ===',
			'font-size:15px;color:#ff0',
		);
		console.log(
			'  Token: ' + tokens.length + ' steps, ' + (lastTok - firstTok).toFixed(0) + 'ms',
		);
		console.log(
			'  Dice:  ' +
				(diceOn && diceOff ? (diceOff.ms - diceOn.ms).toFixed(0) : '?') +
				'ms spin',
		);
		console.log('  Total: ' + dur.toFixed(0) + 'ms (first -> last event)');
		console.table(
			timeline.map(function (t) {
				return { '+ms': (t.ms - t0).toFixed(0), what: t.what, detail: t.detail };
			}),
		);
		if (dur > 2000) log('WARN', 'SLOW >2s');
		else if (dur > 1200) log('INFO', 'OK 1.2-2s');
		else log('OK', 'FAST <1.2s');
		timeline = [];
	}

	// Dice: watch class changes
	var onCube = function (el, idx) {
		new MutationObserver(function (recs) {
			for (var ri = 0; ri < recs.length; ri++) {
				var r = recs[ri];
				if (r.attributeName !== 'class') continue;
				var wasRolling = (r.oldValue || '').indexOf('dice-spin') !== -1;
				var nowRolling = el.className.indexOf('dice-spin') !== -1;
				if (!wasRolling && nowRolling) {
					if (timeline.length === 0) {
						moveN++;
						log('START', 'MOVE #' + moveN);
					}
					add('dice-on', idx);
					log('DICE', 'Die#' + idx + ' ON');
					clearTimeout(doneTimer);
				}
				if (wasRolling && !nowRolling) {
					add('dice-off', idx);
					log('DICE', 'Die#' + idx + ' OFF');
					doneTimer = setTimeout(wrapUp, 500);
				}
			}
		}).observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
	};
	var scan = function () {
		document.querySelectorAll('.dice-cube').forEach(function (el, i) {
			if (!el.dataset.dbg3) {
				el.dataset.dbg3 = '1';
				onCube(el, i);
			}
		});
	};
	scan();
	new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });

	// Token: watch style changes
	var onTok = function (el) {
		var label = (el.textContent || '').trim() || '?';
		var last = '';
		new MutationObserver(function () {
			var pos = el.style.left + ',' + el.style.top;
			if (pos === last) return;
			last = pos;
			add('token', label);
			clearTimeout(doneTimer);
		}).observe(el, { attributes: true, attributeFilter: ['style'] });
	};
	var scanT = function () {
		document.querySelectorAll('.token').forEach(function (el) {
			if (!el.dataset.tdbg3) {
				el.dataset.tdbg3 = '1';
				onTok(el);
			}
		});
	};
	scanT();
	new MutationObserver(scanT).observe(document.body, { childList: true, subtree: true });

	log('OK', 'Debugger v3 — roll!');
})();
