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
