export const JS = `
document.addEventListener('click', function(e) {
  var header = e.target.closest('.card-header');
  if (header) {
    header.parentElement.classList.toggle('expanded');
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
`;
