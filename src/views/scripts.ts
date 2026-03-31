export const JS = `
function toggleCard(header) {
  var card = header.parentElement;
  card.classList.toggle('expanded');
  var isExpanded = card.classList.contains('expanded');
  header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
}

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

document.addEventListener('click', function(e) {
  var node = e.target.closest('.spf-node.include');
  if (node) {
    var li = node.parentElement;
    var sub = li.querySelector('ul');
    if (sub) sub.style.display = sub.style.display === 'none' ? '' : 'none';
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

  function fireConfetti(grade, originEl) {
    var letter = grade.charAt(0).toUpperCase();
    var plus = grade.indexOf('+') !== -1;
    var greens = ['#22c55e', '#4ade80', '#86efac'];
    var oranges = ['#f97316', '#fb923c'];
    var golds = ['#facc15', '#fde68a'];
    var ambers = ['#f59e0b', '#fbbf24', '#d97706'];

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
      if (!disabled) fireConfetti(grade, gradeEl);
    });
  }
})();
`;
