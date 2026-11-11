(function () {
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var controls = document.querySelectorAll(".publication-resource, .publication-venue-card, .author__urls_sm a, .author__urls a, .greedy-nav > button, .greedy-nav a, .back-to-top, .avatar-glass");
    var states = [];
    var moving = [];
    var frame = null;
    var lastTime = 0;
    var pressed = null;

    function spring(value, stiffness, damping) {
        return { value: value, target: value, velocity: 0, stiffness: stiffness, damping: damping };
    }

    function write(state, name, value) {
        if (state.painted[name] === value) return;
        state.painted[name] = value;
        state.surface.style.setProperty(name, value);
    }

    function paint(state) {
        var hover = Math.max(0, Math.min(1, state.hover.value));
        var pressure = Math.max(-0.15, Math.min(1.1, state.pressure.value));
        var compression = Math.max(0, Math.min(1, pressure));
        write(state, "--glass-x", (state.x.value * 100).toFixed(2) + "%");
        write(state, "--glass-y", (state.y.value * 100).toFixed(2) + "%");
        write(state, "--glass-hover", hover.toFixed(4));
        write(state, "--glass-pressure", pressure.toFixed(4));
        write(state, "--glass-compression", compression.toFixed(4));
        write(state, "--glass-contact", Math.max(hover, Math.sqrt(compression) * 0.9).toFixed(4));
        write(state, "--glass-shadow-x", ((0.5 - state.x.value) * hover * 2).toFixed(3) + "px");
        if (state.portrait) {
            write(state, "--portrait-tilt-x", ((0.5 - state.y.value) * 2).toFixed(4));
            write(state, "--portrait-tilt-y", ((state.x.value - 0.5) * 2).toFixed(4));
        }
    }

    function tick(time) {
        var elapsed = Math.max(0, Math.min((time - lastTime) / 1000, 1 / 30));
        lastTime = time;
        var steps = Math.max(1, Math.ceil(elapsed * 120));
        var dt = elapsed / steps;
        // Batch geometry reads before any style writes, once per frame.
        moving.forEach(function (state) {
            if (!state.point) return;
            var rect = state.surface.getBoundingClientRect();
            if (rect.width && rect.height) {
                state.x.target = Math.max(0.06, Math.min(0.94, (state.point.x - rect.left) / rect.width));
                state.y.target = Math.max(0.06, Math.min(0.94, (state.point.y - rect.top) / rect.height));
            }
            state.point = null;
        });
        moving = moving.filter(function (state) {
            var settled = true;
            state.springs.forEach(function (value) {
                for (var step = 0; step < steps; step += 1) {
                    value.velocity += ((value.target - value.value) * value.stiffness - value.velocity * value.damping) * dt;
                    value.value += value.velocity * dt;
                }
                if (Math.abs(value.target - value.value) < 0.001 && Math.abs(value.velocity) < 0.01) {
                    value.value = value.target;
                    value.velocity = 0;
                } else {
                    settled = false;
                }
            });
            paint(state);
            state.moving = !settled;
            return !settled;
        });
        frame = moving.length ? window.requestAnimationFrame(tick) : null;
    }

    function wake(state) {
        if (reducedMotion.matches || document.hidden) return;
        write(state, "--glass-raised", state.hover.target > 0 ? "1" : "0");
        if (!state.moving) {
            state.moving = true;
            moving.push(state);
        }
        if (frame === null) {
            lastTime = performance.now();
            frame = window.requestAnimationFrame(tick);
        }
    }

    function point(state, event) {
        state.point = { x: event.clientX, y: event.clientY };
    }

    function release(event) {
        if (!pressed) return;
        if (event && event.pointerId !== undefined && pressed.pointerId !== event.pointerId) return;
        pressed.pressure.target = 0;
        pressed.hover.target = pressed.inside || pressed.focused ? 1 : 0;
        wake(pressed);
        pressed = null;
    }

    function press(state, pointerId) {
        release();
        pressed = state;
        state.pointerId = pointerId;
        state.pressure.target = 1;
        state.pressure.velocity = Math.min(state.portrait ? 8 : 14, Math.max(0, state.pressure.velocity) + (state.portrait ? 6 : 10));
        wake(state);
    }

    Array.prototype.forEach.call(controls, function (control) {
        var surface = control.matches(".author__urls a") ? control.querySelector("i") : control;
        if (!surface) return;
        var portrait = control.matches(".avatar-glass");
        var state = {
            surface: surface,
            x: spring(0.5, 210, 28),
            y: spring(portrait ? 0.5 : 0.2, 210, 28),
            hover: spring(0, 180, 26),
            pressure: spring(0, 420, portrait ? 32 : 25),
            inside: false,
            focused: false,
            moving: false,
            point: null,
            painted: {},
            portrait: portrait
        };
        state.springs = [state.x, state.y, state.hover, state.pressure];
        states.push(state);
        surface.classList.toggle("has-glass-motion", !reducedMotion.matches);

        control.addEventListener("pointerenter", function (event) {
            if (event.pointerType === "touch") return;
            state.inside = true;
            point(state, event);
            state.hover.target = 1;
            if (pressed === state) state.pressure.target = 1;
            wake(state);
        });
        control.addEventListener("pointermove", function (event) {
            if (reducedMotion.matches || (event.pointerType === "touch" && pressed !== state)) return;
            point(state, event);
            wake(state);
        }, { passive: true });
        control.addEventListener("pointerleave", function () {
            state.inside = false;
            state.hover.target = state.focused ? 0.65 : 0;
            state.pressure.target = 0;
            state.point = null;
            state.x.target = 0.5;
            state.y.target = state.portrait ? 0.5 : 0.2;
            wake(state);
        });
        control.addEventListener("pointerdown", function (event) {
            if (event.button !== 0 || !event.isPrimary || reducedMotion.matches) return;
            point(state, event);
            press(state, event.pointerId);
        });
        control.addEventListener("focus", function () {
            state.focused = control.matches(":focus-visible");
            if (!state.focused) return;
            state.hover.target = 0.65;
            state.x.target = 0.5;
            state.y.target = state.portrait ? 0.5 : 0.2;
            wake(state);
        });
        control.addEventListener("blur", function () {
            state.focused = false;
            state.hover.target = state.inside ? 1 : 0;
            state.pressure.target = 0;
            wake(state);
        });
        control.addEventListener("keydown", function (event) {
            if (event.repeat || reducedMotion.matches) return;
            if (event.key !== "Enter" && !(event.key === " " && (control.tagName === "BUTTON" || control.tagName === "SUMMARY"))) return;
            press(state, null);
        });
        control.addEventListener("keyup", function (event) {
            if (event.key === "Enter" || event.key === " ") release();
        });
        control.addEventListener("click", function () {
            // A disabled button may no longer receive the corresponding keyup.
            if (control.disabled && pressed === state) release();
        });
    });

    function reset() {
        window.cancelAnimationFrame(frame);
        frame = null;
        moving = [];
        pressed = null;
        states.forEach(function (state) {
            state.inside = false;
            state.focused = false;
            state.moving = false;
            state.point = null;
            state.springs.forEach(function (value, index) {
                value.target = value.value = index === 0 ? 0.5 : index === 1 ? (state.portrait ? 0.5 : 0.2) : 0;
                value.velocity = 0;
            });
            state.surface.classList.toggle("has-glass-motion", !reducedMotion.matches);
            write(state, "--glass-raised", "0");
            paint(state);
        });
    }

    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) reset();
    });
    reducedMotion.addEventListener("change", reset);
})();
