export const JS = `
function toggleCard(header) {
  var card = header.parentElement;
  card.classList.toggle('expanded');
  var isExpanded = card.classList.contains('expanded');
  header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
}

/* Guard: document-level listeners persist across document.replaceChild
   (used by the loading→report transition), so only register them once. */
if (!window.__dmarcheckBound) {
  window.__dmarcheckBound = true;

  document.addEventListener('click', function(e) {
    var header = e.target.closest('.card-header');
    if (header) toggleCard(header);
  });

  document.addEventListener('keydown', function(e) {
    var header = e.target.closest('.card-header');
    if (header && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggleCard(header);
    }
  });

  function toggleSpfNode(node) {
    var li = node.parentElement;
    var sub = li.querySelector('ul');
    if (sub) {
      var isHidden = sub.style.display === 'none';
      sub.style.display = isHidden ? '' : 'none';
      node.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    }
  }

  document.addEventListener('click', function(e) {
    var node = e.target.closest('.spf-node.include');
    if (node) {
      toggleSpfNode(node);
    }
  });

  document.addEventListener('keydown', function(e) {
    var node = e.target.closest('.spf-node.include');
    if (node && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggleSpfNode(node);
    }
  });

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.copy-btn');
    if (btn) {
      var text = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(text).then(function() {
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
      });
    }
  });

  document.addEventListener('submit', function(e) {
    var form = e.target.closest('form[action="/check"]');
    if (!form) return;
    var btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Scanning...';
    }
    var landing = document.querySelector('.landing-main');
    if (landing) {
      var domain = form.querySelector('input[name="domain"]').value;
      var wrapper = document.createElement('div');
      wrapper.className = 'loading';
      var spinner = document.createElement('div');
      spinner.className = 'spinner';
      var msg = document.createElement('p');
      msg.textContent = 'Scanning ' + domain + '...';
      wrapper.appendChild(spinner);
      wrapper.appendChild(msg);
      Array.from(landing.children).forEach(function(child) { child.style.display = 'none'; });
      landing.appendChild(wrapper);
    }
  });
}

(function() {
  var report = document.querySelector('.report');
  if (report) {
    var heading = report.querySelector('.domain-name');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }
  var timeEl = document.querySelector('.report-meta time[datetime]');
  if (timeEl) {
    var iso = timeEl.getAttribute('datetime');
    function updateRelative() {
      var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diff < 5) timeEl.textContent = 'Scanned just now';
      else if (diff < 60) timeEl.textContent = 'Scanned ' + diff + 's ago';
      else if (diff < 3600) timeEl.textContent = 'Scanned ' + Math.floor(diff / 60) + 'm ago';
      else timeEl.textContent = 'Scanned ' + new Date(iso).toUTCString().replace('GMT', 'UTC');
    }
    updateRelative();
    setInterval(updateRelative, 10000);
  }

  /* Confetti celebration */
  function launchConfetti(count, colors, originEl) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var rect = originEl ? originEl.getBoundingClientRect() : { left: canvas.width / 2, top: canvas.height / 3 };
    var ox = rect.left + (rect.width || 0) / 2;
    var oy = rect.top + (rect.height || 0) / 2;
    var particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: ox, y: oy,
        vx: (Math.random() - 0.5) * 12,
        vy: -(Math.random() * 8 + 4),
        r: Math.random() * Math.PI * 2,
        rv: (Math.random() - 0.5) * 0.2,
        w: 6 + Math.random() * 4,
        h: 4 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1
      });
    }
    var start = Date.now();
    function frame() {
      if (Date.now() - start > 4000 || particles.length === 0) {
        canvas.remove();
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var j = particles.length - 1; j >= 0; j--) {
        var p = particles[j];
        p.vy += 0.15;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.rv;
        if (p.y > canvas.height * 0.8) p.alpha -= 0.02;
        if (p.alpha <= 0 || p.y > canvas.height) { particles.splice(j, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var sGradeInterval = null;

  function fireConfetti(grade, originEl) {
    var letter = grade.charAt(0).toUpperCase();
    var plus = grade.indexOf('+') !== -1;
    var greens = ['#22c55e', '#4ade80', '#86efac'];
    var oranges = ['#f97316', '#fb923c'];
    var golds = ['#facc15', '#fde68a'];
    var ambers = ['#f59e0b', '#fbbf24', '#d97706'];

    if (grade === 'S') {
      var sColors = ['#facc15', '#fde68a', '#f59e0b', '#d97706', '#22c55e', '#4ade80', '#f97316'];
      launchConfetti(40, sColors, originEl);
      setTimeout(function() { launchConfetti(35, sColors, originEl); }, 300);
      setTimeout(function() { launchConfetti(30, sColors, originEl); }, 600);
      sGradeInterval = setInterval(function() {
        launchConfetti(25, sColors, originEl);
        setTimeout(function() { launchConfetti(20, sColors, originEl); }, 300);
      }, 4000);
      return;
    }

    if (letter === 'A' && plus) {
      launchConfetti(35, greens.concat(oranges, golds), originEl);
      setTimeout(function() { launchConfetti(35, greens.concat(oranges, golds), originEl); }, 300);
      setTimeout(function() { launchConfetti(30, greens.concat(golds), originEl); }, 600);
    } else if (letter === 'A') {
      launchConfetti(30, greens.concat(oranges), originEl);
      setTimeout(function() { launchConfetti(30, greens.concat(oranges), originEl); }, 400);
    } else if (letter === 'B') {
      launchConfetti(30, greens, originEl);
    } else if (letter === 'C') {
      launchConfetti(12, ambers, originEl);
    }
  }

  var toggleBtn = document.querySelector('.confetti-toggle');
  if (toggleBtn) {
    var grade = toggleBtn.getAttribute('data-grade');
    var gradeEl = document.querySelector('.overall-grade');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var disabled = localStorage.getItem('confetti-disabled') === 'true' || reducedMotion;

    if (disabled) {
      toggleBtn.classList.add('disabled');
      toggleBtn.setAttribute('aria-pressed', 'false');
    } else {
      toggleBtn.setAttribute('aria-pressed', 'true');
      fireConfetti(grade, gradeEl);
    }

    toggleBtn.addEventListener('click', function() {
      disabled = !disabled;
      localStorage.setItem('confetti-disabled', disabled ? 'true' : 'false');
      toggleBtn.classList.toggle('disabled', disabled);
      toggleBtn.setAttribute('aria-pressed', disabled ? 'false' : 'true');
      if (disabled) {
        if (sGradeInterval) { clearInterval(sGradeInterval); sGradeInterval = null; }
      } else {
        fireConfetti(grade, gradeEl);
      }
    });
  }
})();

/* Theme toggle */
(function() {
  var toggles = document.querySelectorAll('.theme-toggle');
  if (!toggles.length) return;
  var sunIcon = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>';
  var moonIcon = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z"/></svg>';
  var autoIcon = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="14" height="10" rx="1.5"/><path d="M5 15h6M8 12v3"/></svg>';

  function updateToggles() {
    var stored = localStorage.getItem('theme');
    toggles.forEach(function(btn) {
      if (!stored) {
        btn.innerHTML = autoIcon;
        btn.setAttribute('aria-label', 'Using system theme, switch to light');
        btn.title = 'System theme';
      } else if (stored === 'light') {
        btn.innerHTML = sunIcon;
        btn.setAttribute('aria-label', 'Light mode, switch to dark');
        btn.title = 'Light mode';
      } else {
        btn.innerHTML = moonIcon;
        btn.setAttribute('aria-label', 'Dark mode, switch to system');
        btn.title = 'Dark mode';
      }
    });
  }

  function cycle() {
    var stored = localStorage.getItem('theme');
    if (!stored) {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (stored === 'light') {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      localStorage.removeItem('theme');
      document.documentElement.removeAttribute('data-theme');
    }
    updateToggles();
  }

  toggles.forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); cycle(); });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateToggles);
  updateToggles();
})();

/* @ Creature easter egg */
(function() {
  if (window.__dmarcheckCreature) return;
  window.__dmarcheckCreature = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var IDLE_MS = 60000;
  var COOLDOWN_MS = 120000;
  var WALK_SPEED = 120; /* pixels per second */
  var idleTimer = null;
  var creature = null;
  var eatenElements = [];
  var isActive = false;
  var useCooldown = false;

  function resetIdle() {
    clearTimeout(idleTimer);
    if (isActive) { panicAndRestore(); return; }
    idleTimer = setTimeout(spawnCreature, useCooldown ? COOLDOWN_MS : IDLE_MS);
  }

  ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(function(evt) {
    document.addEventListener(evt, resetIdle, { passive: true });
  });

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      clearTimeout(idleTimer);
      if (isActive) { panicAndRestore(); }
    } else {
      resetIdle();
    }
  });

  resetIdle();

  function spawnCreature() {
    if (isActive || creature) return;
    isActive = true;

    creature = document.createElement('div');
    creature.className = 'at-creature';
    creature.setAttribute('tabindex', '0');
    creature.setAttribute('role', 'button');
    creature.setAttribute('aria-label', 'Stop DMarcus');

    var body = document.createElement('div');
    body.className = 'creature-body';
    body.textContent = '@';

    var eyes = document.createElement('div');
    eyes.className = 'creature-eyes';
    for (var i = 0; i < 2; i++) {
      var eye = document.createElement('div');
      eye.className = 'creature-eye';
      var pupil = document.createElement('div');
      pupil.className = 'creature-pupil';
      eye.appendChild(pupil);
      eyes.appendChild(eye);
    }
    body.appendChild(eyes);

    var legs = document.createElement('div');
    legs.className = 'creature-legs';
    for (var j = 0; j < 3; j++) {
      var leg = document.createElement('div');
      leg.className = 'creature-leg';
      legs.appendChild(leg);
    }

    creature.appendChild(body);
    creature.appendChild(legs);
    document.body.appendChild(creature);

    /* announce for screen readers */
    var announce = document.createElement('div');
    announce.setAttribute('aria-live', 'polite');
    announce.setAttribute('style', 'position:absolute;left:-9999px;');
    announce.textContent = 'DMarcus appeared!';
    document.body.appendChild(announce);
    setTimeout(function() { announce.remove(); }, 3000);

    /* start from the logo @ if present, otherwise from a random edge */
    var logoAt = document.querySelector('.logo .creature');
    var vw = window.innerWidth, vh = window.innerHeight;
    var startX, startY;

    if (logoAt) {
      var logoRect = logoAt.getBoundingClientRect();
      startX = logoRect.left;
      startY = logoRect.top;
      logoAt.style.opacity = '0';
    } else {
      var edge = Math.floor(Math.random() * 4);
      if (edge === 0) { startX = -60; startY = Math.random() * vh * 0.6 + vh * 0.1; }
      else if (edge === 1) { startX = vw + 10; startY = Math.random() * vh * 0.6 + vh * 0.1; }
      else if (edge === 2) { startX = Math.random() * vw * 0.6 + vw * 0.1; startY = -60; }
      else { startX = Math.random() * vw * 0.6 + vw * 0.1; startY = vh + 10; }
    }

    creature.style.left = startX + 'px';
    creature.style.top = startY + 'px';

    creature.addEventListener('click', function(e) { e.stopPropagation(); panicAndRestore(); });
    creature.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); panicAndRestore(); }
    });

    walkToNextTarget();
  }

  function getTargets() {
    var selectors = [
      '.logo', '.tagline', '.search-box', '.advanced-options', '.examples',
      '.api-hint', '.foss-callout', '.learn-link',
      '.report-header', '.score-snippet', '.report-meta',
      '.card', '.confetti-toggle'
    ];
    var targets = [];
    selectors.forEach(function(sel) {
      var els = document.querySelectorAll(sel);
      els.forEach(function(el) {
        if (!el.dataset.eaten && el.offsetParent !== null) targets.push(el);
      });
    });
    /* sort by vertical position */
    targets.sort(function(a, b) {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });
    return targets;
  }

  function updatePupils(targetX, targetY) {
    if (!creature) return;
    var rect = creature.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = targetX - cx, dy = targetY - cy;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = (dx / dist) * 2;
    var py = (dy / dist) * 2;
    var pupils = creature.querySelectorAll('.creature-pupil');
    pupils.forEach(function(p) {
      p.style.left = (3 + px) + 'px';
      p.style.top = (3 + py) + 'px';
    });
  }

  function walkTo(x, y, callback) {
    if (!creature) return;
    var rect = creature.getBoundingClientRect();
    var dx = x - rect.left, dy = y - rect.top;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var duration = Math.max(0.4, dist / WALK_SPEED);

    creature.classList.add('walking');
    updatePupils(x, y);
    creature.style.transition = 'left ' + duration + 's linear, top ' + duration + 's linear';
    creature.style.left = x + 'px';
    creature.style.top = y + 'px';

    setTimeout(function() {
      if (creature) creature.classList.remove('walking');
      if (callback) callback();
    }, duration * 1000 + 50);
  }

  function walkToNextTarget() {
    if (!isActive || !creature) return;
    var targets = getTargets();
    if (targets.length === 0) {
      /* nothing left to eat — wander off */
      var vw = window.innerWidth;
      walkTo(vw + 100, creature.getBoundingClientRect().top, function() {
        cleanup();
      });
      return;
    }

    var target = targets[0];
    var tRect = target.getBoundingClientRect();
    var approachX = tRect.left - 60;
    var approachY = tRect.top + tRect.height / 2 - 30;

    walkTo(approachX, approachY, function() {
      eatElement(target);
    });
  }

  function eatElement(el) {
    if (!isActive || !creature) return;

    /* chomp animation */
    var body = creature.querySelector('.creature-body');
    if (body) body.classList.add('chomping');
    setTimeout(function() {
      if (body) body.classList.remove('chomping');
    }, 300);

    setTimeout(function() {
      if (!isActive || !creature) return;

      var rect = el.getBoundingClientRect();
      var original = {
        el: el,
        position: el.style.position,
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        transition: el.style.transition,
        zIndex: el.style.zIndex,
        transform: el.style.transform,
        visibility: el.style.visibility,
        margin: el.style.margin
      };
      eatenElements.push(original);
      el.dataset.eaten = 'true';

      /* fix the element in place */
      el.style.position = 'fixed';
      el.style.left = rect.left + 'px';
      el.style.top = rect.top + 'px';
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';
      el.style.margin = '0';
      el.style.zIndex = '9997';
      el.style.transition = 'left 0.6s ease-in, top 0.6s ease-in, opacity 0.6s ease-in';

      /* find nearest edge to drag toward */
      var vw = window.innerWidth, vh = window.innerHeight;
      var toLeft = rect.left, toRight = vw - rect.right;
      var toTop = rect.top, toBottom = vh - rect.bottom;
      var min = Math.min(toLeft, toRight, toTop, toBottom);
      var destX = rect.left, destY = rect.top;

      if (min === toLeft) destX = -(rect.width + 20);
      else if (min === toRight) destX = vw + 20;
      else if (min === toTop) destY = -(rect.height + 20);
      else destY = vh + 20;

      /* creature walks alongside */
      creature.classList.add('walking');
      updatePupils(destX, destY);
      creature.style.transition = 'left 0.6s ease-in, top 0.6s ease-in';
      creature.style.left = (destX + (min === toLeft ? -60 : min === toRight ? 60 : 0)) + 'px';
      creature.style.top = (destY + (min === toTop ? -60 : min === toBottom ? 60 : 0)) + 'px';

      /* drag the element */
      requestAnimationFrame(function() {
        el.style.left = destX + 'px';
        el.style.top = destY + 'px';
      });

      setTimeout(function() {
        if (!isActive) return;
        el.style.visibility = 'hidden';
        el.style.position = original.position || '';
        el.style.left = original.left || '';
        el.style.top = original.top || '';
        el.style.width = original.width || '';
        el.style.height = original.height || '';
        el.style.margin = original.margin || '';
        el.style.zIndex = original.zIndex || '';
        el.style.transition = original.transition || '';
        if (creature) creature.classList.remove('walking');

        /* walk back to visible area before next target */
        if (isActive && creature) {
          var vw2 = window.innerWidth, vh2 = window.innerHeight;
          var reenterX = Math.random() * vw2 * 0.4 + vw2 * 0.1;
          var reenterY = Math.random() * vh2 * 0.3 + vh2 * 0.1;
          walkTo(reenterX, reenterY, function() {
            walkToNextTarget();
          });
        }
      }, 700);
    }, 350);
  }

  function panicAndRestore() {
    if (!creature) { isActive = false; return; }

    /* panic animation */
    creature.classList.add('panicking', 'walking');
    var vw = window.innerWidth;
    var rect = creature.getBoundingClientRect();
    var exitX = rect.left < vw / 2 ? -80 : vw + 80;
    var midY1 = rect.top + (Math.random() > 0.5 ? -60 : 60);
    var midY2 = rect.top + (Math.random() > 0.5 ? 40 : -40);

    /* zigzag keyframes via sequential transitions */
    creature.style.transition = 'left 0.15s ease-in, top 0.15s ease-in';
    creature.style.left = (rect.left + (exitX > 0 ? 30 : -30)) + 'px';
    creature.style.top = midY1 + 'px';

    setTimeout(function() {
      if (!creature) return;
      creature.style.left = (rect.left + (exitX > 0 ? 60 : -60)) + 'px';
      creature.style.top = midY2 + 'px';
    }, 150);

    setTimeout(function() {
      if (!creature) return;
      creature.style.transition = 'left 0.2s ease-in, top 0.2s ease-in';
      creature.style.left = exitX + 'px';
      creature.style.top = midY1 + 'px';
    }, 300);

    setTimeout(function() {
      cleanup();
      restoreElements();
    }, 500);
  }

  function restoreElements() {
    eatenElements.forEach(function(item, i) {
      var el = item.el;
      setTimeout(function() {
        el.style.position = item.position || '';
        el.style.left = item.left || '';
        el.style.top = item.top || '';
        el.style.width = item.width || '';
        el.style.height = item.height || '';
        el.style.margin = item.margin || '';
        el.style.zIndex = item.zIndex || '';
        el.style.transition = item.transition || '';
        el.style.visibility = item.visibility || '';
        el.style.transform = item.transform || '';
        delete el.dataset.eaten;
      }, i * 80);
    });
    eatenElements = [];
    /* restore the logo @ */
    var logoAt = document.querySelector('.logo .creature');
    if (logoAt) logoAt.style.opacity = '';
    useCooldown = true;
    resetIdle();
  }

  function cleanup() {
    if (creature) {
      creature.remove();
      creature = null;
    }
    isActive = false;
  }
})();
`;
