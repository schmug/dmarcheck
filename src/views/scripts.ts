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
    landing.textContent = '';
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
})();
`;
