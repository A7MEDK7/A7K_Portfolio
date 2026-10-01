document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const rubber = (o, l) => l * (1 - Math.exp(-o / l)); // resistance beyond the limit

    /* =====================================================
       Spring physics engine
       ===================================================== */
    class Spring {
        constructor(v = 0, k = 300, z = 0.8, eps = 0.05) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.z = z; this.eps = eps; }
        to(t) { this.t = t; if (RM) { this.v = t; this.vel = 0; } }
        snap(v) { this.v = this.t = v; this.vel = 0; }
        step(h) {
            const a = -this.k * (this.v - this.t) - 2 * this.z * Math.sqrt(this.k) * this.vel;
            this.vel += a * h;
            this.v += this.vel * h;
        }
        get rest() { return Math.abs(this.v - this.t) < this.eps && Math.abs(this.vel) < this.eps * 10; }
    }

    const running = new Set();
    let raf = 0, last = 0;
    function run(o) {
        running.add(o);
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }
    function loop(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const n = Math.max(1, Math.ceil(dt / 0.006)), h = dt / n; // sub-stepping keeps springs stable
        running.forEach((o) => {
            for (let i = 0; i < n; i++) o.step(h);
            o.render();
            if (o.done()) { running.delete(o); if (o.settle) o.settle(); }
        });
        raf = running.size ? requestAnimationFrame(loop) : 0;
    }

    /* =====================================================
       Elastic buttons: press → grab → pull → stretch → release → spring
       ===================================================== */
    // How much buttons can be pulled/stretched: 0 = no pull (press + hover scale only), 0.25 = very subtle, 1 = full
    const BUTTON_PULL = 0.15;

    function elastic(el, limit = 34 * BUTTON_PULL) {
        el.classList.add('elastic');
        el.draggable = false;
        el.addEventListener('dragstart', (e) => e.preventDefault());

        const X = new Spring(0, 360, 0.6), Y = new Spring(0, 360, 0.6), S = new Spring(1, 420, 0.72, 0.0008);
        let down = false, drag = false, id = null, x0 = 0, y0 = 0, lastT = 0, wasDrag = false;

        const o = {
            step(h) {
                if (!drag) { X.step(h); Y.step(h); }
                else { const d = Math.exp(-10 * h); X.vel *= d; Y.vel *= d; }
                S.step(h);
            },
            render() {
                const x = X.v, y = Y.v, d = Math.hypot(x, y), sp = Math.hypot(X.vel, Y.vel);
                const st = clamp(d / 150 + sp / 5000, 0, 0.26) * BUTTON_PULL;          // stretch from pull + speed
                const a = d > 0.5 ? Math.atan2(y, x) : Math.atan2(Y.vel, X.vel);
                el.style.transform = `translate3d(${x}px,${y}px,0) rotate(${a}rad) scale(${(1 + st) * S.v},${(1 - st * 0.45) * S.v}) rotate(${-a}rad)`;
            },
            done() { return !drag && X.rest && Y.rest && S.rest; },
            settle() { if (S.t === 1) el.style.transform = ''; }
        };

        el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !down) { S.to(1.03); run(o); } });
        el.addEventListener('pointerleave', () => { if (!down) { S.to(1); run(o); } });

        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            down = true; drag = false; wasDrag = false; id = e.pointerId; x0 = e.clientX; y0 = e.clientY;
            try { el.setPointerCapture(id); } catch (err) { }
            S.to(0.95); run(o);
        });

        el.addEventListener('pointermove', (e) => {
            if (!down || e.pointerId !== id) return;
            const dx = e.clientX - x0, dy = e.clientY - y0, d = Math.hypot(dx, dy);
            if (!drag && d > 6 && BUTTON_PULL > 0) { drag = true; lastT = e.timeStamp; }
            if (!drag) return;
            const r = rubber(d, limit);
            const nx = (dx / d) * r, ny = (dy / d) * r;
            const dt = Math.max(0.001, (e.timeStamp - lastT) / 1000);
            lastT = e.timeStamp;
            X.vel = clamp(X.vel + ((nx - X.v) / dt - X.vel) * 0.35, -4000, 4000);
            Y.vel = clamp(Y.vel + ((ny - Y.v) / dt - Y.vel) * 0.35, -4000, 4000);
            X.v = nx; Y.v = ny;
            run(o);
        });

        const end = (e) => {
            if (!down || e.pointerId !== id) return;
            down = false;
            if (drag) wasDrag = true;
            drag = false;
            try { el.releasePointerCapture(id); } catch (err) { }
            S.to(e.pointerType === 'mouse' && el.matches(':hover') ? 1.03 : 1);
            run(o);
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);

        // a pulled-and-released control is not a click
        el.addEventListener('click', (e) => {
            if (wasDrag && e.detail > 0) { e.preventDefault(); e.stopImmediatePropagation(); }
            wasDrag = false;
        }, true);
    }

    document.querySelectorAll('.btn, .socials a, .icon-btn').forEach((el) => elastic(el));

    /* =====================================================
       Theme switch: drag the knob, rubber-band at the ends, spring to state
       ===================================================== */
    const sw = document.getElementById('theme-toggle');
    const knob = sw.querySelector('.knob');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const PAD = 3;
    let travel = 30, isDark = root.getAttribute('data-theme') !== 'light';
    const P = new Spring(0, 420, 0.72), G = new Spring(0, 560, 0.8, 0.001);
    let sDown = false, sDrag = false, sId = null, sx0 = 0, sp0 = 0, sLastX = 0, sLastT = 0;

    const swObj = {
        step(h) {
            if (!sDrag) P.step(h); else P.vel *= Math.exp(-10 * h);
            G.step(h);
        },
        render() {
            const x = P.v, v = P.vel, w = knob.offsetWidth || 30;
            const over = x < 0 ? x : x > travel ? x - travel : 0;
            const st = clamp(Math.abs(v) / 3400, 0, 0.15) + Math.min(Math.abs(over) / 90, 0.06);
            const sx = (1 + st) * (1 + G.v * 0.14), sy = (1 - st * 0.5) * (1 + G.v * 0.045);
            const shift = clamp(v / 500, -1, 1) * st * w / 2;           // keep the trailing edge anchored
            const half = w * sx / 2;                                           // may peek out of the track by a few px, never more
            const cx = clamp(PAD + x + shift + w / 2, half - 3, sw.clientWidth + 3 - half);
            knob.style.transform = `translate3d(${cx - w / 2}px,0,0) scale(${sx},${sy})`;
            sw.style.setProperty('--p', clamp(x / (travel || 1), 0, 1).toFixed(3));
        },
        done() { return !sDrag && P.rest && G.rest; }
    };

    function measure() { travel = Math.max(0, sw.clientWidth - (knob.offsetWidth || 30) - PAD * 2); }

    function applyTheme(theme, save) {
        root.setAttribute('data-theme', theme);
        isDark = theme === 'dark';
        sw.setAttribute('aria-checked', String(isDark));
        if (themeMeta) themeMeta.setAttribute('content', isDark ? '#05070f' : '#eaf0fb');
        if (save) { try { localStorage.setItem('theme', theme); } catch (e) { } }
        measure(); P.to(isDark ? travel : 0); run(swObj);
    }
    function setDark(b) {
        if (b !== isDark) applyTheme(b ? 'dark' : 'light', true);
        else { P.to(isDark ? travel : 0); run(swObj); }
    }

    applyTheme(isDark ? 'dark' : 'light', false);
    P.snap(isDark ? travel : 0); swObj.render();

    sw.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        sDown = true; sDrag = false; sId = e.pointerId; sx0 = sLastX = e.clientX; sp0 = P.v; sLastT = e.timeStamp;
        try { sw.setPointerCapture(sId); } catch (err) { }
        G.to(1); run(swObj);
    });
    sw.addEventListener('pointermove', (e) => {
        if (!sDown || e.pointerId !== sId) return;
        const dx = e.clientX - sx0;
        if (!sDrag && Math.abs(dx) > 3) sDrag = true;
        if (!sDrag) return;
        const raw = sp0 + dx;
        const x = raw < 0 ? -rubber(-raw, 9) : raw > travel ? travel + rubber(raw - travel, 9) : raw;
        const dt = Math.max(0.001, (e.timeStamp - sLastT) / 1000);
        sLastT = e.timeStamp;
        P.vel = clamp(P.vel + ((x - P.v) / dt - P.vel) * 0.35, -4000, 4000);
        P.v = x;
        run(swObj);
    });
    const swEnd = (e) => {
        if (!sDown || e.pointerId !== sId) return;
        sDown = false; G.to(0);
        const dragged = sDrag; sDrag = false;
        try { sw.releasePointerCapture(sId); } catch (err) { }
        if (dragged) setDark(Math.abs(P.vel) > 450 ? P.vel > 0 : P.v > travel / 2); // flick or threshold
        else setDark(!isDark);                                                      // tap
        run(swObj);
    };
    sw.addEventListener('pointerup', swEnd);
    sw.addEventListener('pointercancel', (e) => {
        if (!sDown || e.pointerId !== sId) return;
        sDown = false; sDrag = false; G.to(0);
        try { sw.releasePointerCapture(sId); } catch (err) { }
        setDark(isDark);
    });
    sw.addEventListener('click', (e) => { if (e.detail === 0) setDark(!isDark); }); // keyboard

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        let saved = null;
        try { saved = localStorage.getItem('theme'); } catch (err) { }
        if (!saved) applyTheme(e.matches ? 'light' : 'dark', false);
    });

    /* =====================================================
       Liquid segmented control (leading edge races ahead, trailing edge lags)
       ===================================================== */
    function segmented(container, axis, onPick) {
        const horiz = axis === 'x';
        const ind = container.querySelector('.nav-indicator');
        const links = [...container.querySelectorAll('.nav-link')];
        const A = new Spring(0, 300, 0.9), B = new Spring(0, 300, 0.9), Gr = new Spring(0, 520, 0.8, 0.001);
        let active = 0, down = false, drag = false, pid = null, p0 = 0, off = 0, ptr = 0, lastP = 0, lastT = 0, vel = 0, nearest = 0, wasDrag = false;

        const pos = (e) => (horiz ? e.clientX : e.clientY);
        const origin = () => { const r = container.getBoundingClientRect(); return horiz ? r.left : r.top; };
        const span = (i) => { const l = links[i]; return horiz ? [l.offsetLeft, l.offsetLeft + l.offsetWidth] : [l.offsetTop, l.offsetTop + l.offsetHeight]; };
        const mid = (i) => { const s = span(i); return (s[0] + s[1]) / 2; };
        const nearestTo = (c) => { let b = 0, bd = 1e9; links.forEach((_, i) => { const d = Math.abs(mid(i) - c); if (d < bd) { bd = d; b = i; } }); return b; };
        const mark = (i) => links.forEach((l, j) => l.classList.toggle('active', j === i));
        links.forEach((l) => { l.draggable = false; });                       // stops native link-drag from cancelling the gesture
        container.addEventListener('dragstart', (e) => e.preventDefault());

        function dragTargets() {
            const first = mid(0), lastM = mid(links.length - 1);
            const near = nearestTo(ptr);
            const c0 = ptr < first ? first - rubber(first - ptr, 18) : ptr > lastM ? lastM + rubber(ptr - lastM, 18) : ptr;
            const c = c0 + (mid(near) - c0) * 0.25;                          // gentle magnetic pull toward the closest option
            const s = span(near), size = s[1] - s[0];
            const ext = clamp(Math.abs(vel) / 40, 0, 16);                   // stretch toward the direction of travel
            A.t = c - size / 2 - (vel < 0 ? ext : 0);
            B.t = c + size / 2 + (vel > 0 ? ext : 0);
            if (near !== nearest) { nearest = near; mark(near); }
        }

        const o = {
            step(h) {
                if (drag) { vel *= Math.exp(-6 * h); dragTargets(); }
                else {
                    const dir = Math.sign((A.t + B.t) / 2 - (A.v + B.v) / 2);
                    const lead = dir >= 0 ? B : A, trail = dir >= 0 ? A : B;
                    lead.k = 560; lead.z = 0.8; trail.k = 280; trail.z = 0.95;
                }
                A.step(h); B.step(h); Gr.step(h);
            },
            render() {
                const g = Gr.v, sp = (A.vel + B.vel) / 2;
                const cs = 1 - clamp(Math.abs(sp) / 7000, 0, 0.07) + g * 0.08;  // squash on acceleration
                const start = A.v - g * 4, size = B.v - A.v + g * 8;
                if (horiz) { ind.style.transform = `translate3d(${start}px,0,0) scaleY(${cs})`; ind.style.width = size + 'px'; }
                else { ind.style.transform = `translate3d(0,${start}px,0) scaleX(${cs})`; ind.style.height = size + 'px'; }
            },
            done() { return !drag && A.rest && B.rest && Gr.rest; }
        };

        function setActive(i, snap) {
            active = nearest = i; mark(i);
            const s = span(i);
            A.to(s[0]); B.to(s[1]);
            if (snap) { A.snap(s[0]); B.snap(s[1]); }
            run(o);
        }
        function sync(snap) {
            if (!links[0].offsetParent) return;                               // hidden (closed mobile menu)
            const l = links[active];
            if (horiz) { ind.style.top = l.offsetTop + 'px'; ind.style.height = l.offsetHeight + 'px'; }
            else { ind.style.left = l.offsetLeft + 'px'; ind.style.width = l.offsetWidth + 'px'; }
            setActive(active, snap);
        }

        container.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            down = true; drag = false; wasDrag = false; pid = e.pointerId; p0 = lastP = pos(e); lastT = e.timeStamp; vel = 0;
            const pc = p0 - origin();
            const onInd = pc >= A.v && pc <= B.v;
            off = onInd ? (A.v + B.v) / 2 - pc : 0;                           // keep the grab point under the finger
            if (onInd) { ind.classList.add('grabbed'); Gr.to(1); run(o); }
        });

        container.addEventListener('pointermove', (e) => {
            if (!down || e.pointerId !== pid) return;
            const p = pos(e);
            if (!drag && Math.abs(p - p0) > 4) {
                drag = true;
                try { container.setPointerCapture(pid); } catch (err) { }
                container.classList.add('dragging'); ind.classList.add('grabbed'); Gr.to(1);
                A.k = B.k = 1800; A.z = B.z = 0.9;                              // stiff = glued to the finger
            }
            if (!drag) return;
            const dt = Math.max(0.001, (e.timeStamp - lastT) / 1000);
            lastT = e.timeStamp;
            vel = clamp(vel + ((p - lastP) / dt - vel) * 0.3, -3000, 3000);
            lastP = p;
            ptr = p - origin() + off;
            run(o);
        });

        const end = (e) => {
            if (!down || e.pointerId !== pid) return;
            down = false; Gr.to(0);
            ind.classList.remove('grabbed'); container.classList.remove('dragging');
            try { container.releasePointerCapture(pid); } catch (err) { }
            if (drag) {
                drag = false; wasDrag = true;
                const idx = nearestTo(ptr + vel * 0.1);                         // a flick carries a little further
                setActive(idx, false);
                onPick(idx);
            }
            run(o);
        };
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);

        container.addEventListener('click', (e) => {
            if (wasDrag && e.detail > 0) { e.preventDefault(); e.stopImmediatePropagation(); wasDrag = false; return; }
            const a = e.target.closest('.nav-link');
            if (a) setActive(links.indexOf(a), false);
        }, true);

        return {
            sync,
            select(href) { const i = links.findIndex((l) => l.getAttribute('href') === href); if (i > -1 && i !== active && !down) setActive(i, false); }
        };
    }

    const navbar = document.getElementById('navbar');
    const menuBtn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');

    /* ---------- Liquid mobile menu: height + staggered items driven by one spring ---------- */
    const menuInner = menu.querySelector('.menu-inner');
    const menuLinks = [...menuInner.querySelectorAll('.nav-link')];
    const menuInd = menuInner.querySelector('.nav-indicator');
    const menuIcon = menuBtn.querySelector('i');
    const MS = new Spring(0, 230, 0.72, 0.002);
    let menuOpen = false, menuFull = 0, iconOpen = false;

    const menuObj = {
        step(h) { MS.step(h); },
        render() {
            const m = MS.v;
            menu.style.height = (Math.max(0, m) * menuFull) + 'px';
            menu.style.visibility = m > 0.002 ? 'visible' : 'hidden';
            menuLinks.forEach((l, i) => {
                const p = clamp((m - i * 0.05) / 0.55, 0, 1);          // items emerge one after another
                l.style.opacity = p;
                l.style.transform = p < 1 ? `translate3d(0,${(1 - p) * -16}px,0) scale(${0.94 + 0.06 * p})` : '';
                l.style.filter = p < 1 ? `blur(${(1 - p) * 7}px)` : '';
            });
            menuInd.style.opacity = clamp(m / 0.4, 0, 1);
            menuIcon.style.transform = `rotate(${clamp(m, 0, 1) * 90}deg)`;
            const o = m > 0.5;
            if (o !== iconOpen) { iconOpen = o; menuIcon.className = o ? 'fas fa-xmark' : 'fas fa-bars'; }
        },
        done() { return MS.rest; }
    };

    function setMenu(open) {
        if (open === menuOpen) return;
        menuOpen = open;
        menuBtn.setAttribute('aria-expanded', String(open));
        if (open) { menuFull = menuInner.offsetHeight; mob.sync(true); }
        MS.to(open ? 1 : 0);
        run(menuObj);
    }

    /* ---------- Smooth scrolling (spy is paused while a nav pick scrolls) ---------- */
    let spyLock = false, lockT = 0;
    function lockSpy(ms) {
        spyLock = true; clearTimeout(lockT);
        lockT = setTimeout(() => { spyLock = false; onScroll(); }, ms);
    }
    function goTo(hash, lock) {
        const t = document.querySelector(hash);
        if (!t) return;
        if (lock) lockSpy(1200);
        window.scrollTo({ top: t.offsetTop - 20, behavior: RM ? 'auto' : 'smooth' });
    }

    const desk = segmented(document.querySelector('.nav-links'), 'x',
        (i) => goTo(document.querySelectorAll('.nav-links .nav-link')[i].getAttribute('href'), true));
    const mob = segmented(menuInner, 'y', (i) => {
        goTo(menu.querySelectorAll('.nav-link')[i].getAttribute('href'), true);
        setTimeout(() => setMenu(false), 260);
    });

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
            const id = a.getAttribute('href');
            if (id === '#') return;
            e.preventDefault();
            goTo(id, a.classList.contains('nav-link'));
        });
    });

    menuBtn.addEventListener('click', () => setMenu(!menuOpen));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setTimeout(() => setMenu(false), 200)));
    document.addEventListener('click', (e) => { if (!navbar.contains(e.target)) setMenu(false); });

    const resync = () => {
        menuFull = menuInner.offsetHeight;
        if (window.innerWidth >= 900 && menuOpen) { menuOpen = false; MS.snap(0); }
        menuObj.render();
        measure(); P.snap(isDark ? travel : 0); swObj.render(); desk.sync(true); mob.sync(true); };
    let lastW = window.innerWidth;
    window.addEventListener('resize', () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; resync(); } });
    window.addEventListener('load', resync);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resync);
    resync();

    /* =====================================================
       Typing effect
       ===================================================== */
    const texts = ['Full Stack Developer', 'Software Engineering', 'React.js Developer', 'ASP.NET Developer'];
    const typed = document.getElementById('typed-text');
    let textIndex = 0, charIndex = 0, isDeleting = false;

    function typeEffect() {
        const current = texts[textIndex];
        if (!typed) return;
        typed.textContent = current.substring(0, isDeleting ? --charIndex : ++charIndex);
        if (!isDeleting && charIndex === current.length) { isDeleting = true; setTimeout(typeEffect, 700); return; }
        if (isDeleting && charIndex === 0) { isDeleting = false; textIndex = (textIndex + 1) % texts.length; }
        setTimeout(typeEffect, isDeleting ? 50 : 90);
    }
    if (RM && typed) typed.textContent = texts[0]; else setTimeout(typeEffect, 1000);

    /* =====================================================
       Glass: light that follows the pointer
       ===================================================== */
    document.addEventListener('pointermove', (e) => {
        const glass = e.target.closest && e.target.closest('.glass');
        if (!glass) return;
        const r = glass.getBoundingClientRect();
        glass.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        glass.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });

    /* =====================================================
       Reveal on scroll
       ===================================================== */
    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                el.classList.add('is-visible');
                io.unobserve(el);
                setTimeout(() => el.classList.remove('reveal', 'is-visible'), 1000);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        reveals.forEach((el) => io.observe(el));
    } else reveals.forEach((el) => el.classList.add('is-visible'));

    /* =====================================================
       Scroll: navbar state, scroll spy, background parallax
       ===================================================== */
    const sections = document.querySelectorAll('section[id]');
    const blobs = document.querySelectorAll('.blob');
    let ticking = false;

    function onScroll() {
        const y = window.scrollY;
        navbar.classList.toggle('scrolled', y > 40);

        if (!spyLock) {
            let current = 'home';
            sections.forEach((s) => { if (y >= s.offsetTop - 220) current = s.id; });
            if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1].id;
            if (current === 'experience-education') current = 'projects';
            desk.select('#' + current);
            mob.select('#' + current);
        }
        if (!RM) blobs.forEach((b, i) => { b.style.translate = `0 ${-(y * (0.04 + i * 0.03))}px`; });
        ticking = false;
    }
    window.addEventListener('scroll', () => {
        if (spyLock) { clearTimeout(lockT); lockT = setTimeout(() => { spyLock = false; onScroll(); }, 160); }
        if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();
});