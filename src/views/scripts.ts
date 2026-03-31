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
})();
`;
