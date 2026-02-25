Promise.all([
  fetch('header.html')
    .then(r => r.text())
    .then(html => {
      document.getElementById('header').innerHTML = html;
      markAndDisableCurrentNavLink();
    }),
  fetch('footer.html')
    .then(r => r.text())
    .then(html => document.getElementById('footer').innerHTML = html),
])
  .catch(err => console.error('Error loading header or footer:', err))
  .finally(() => {
    document.body.classList.remove('is-loading');
  });
// functions
function markAndDisableCurrentNavLink(){
  const nav = document.getElementById('nav');
  if(!nav)
    return;
  // current page file (normalize "/" -> "index.html")
  let current = window.location.pathname.split('/').pop() || 'index.html';
  current = current.split('?')[0].split('#')[0];
  // find all links in nav and mark the one that matches current page
  nav.querySelectorAll('a[href]').forEach(a => {
    const rawHref = a.getAttribute('href');
    if(!rawHref)
      return;
    // ignore external links, anchors, mailto, tel, etc.
    if(/^(https?:)?\/\//i.test(rawHref))
      return;
    if(/^(#|mailto:|tel:|javascript:)/i.test(rawHref))
      return;
    // normalize href to filename
    let href = rawHref.split('/').pop();
    href = href.split('?')[0].split('#')[0];
    if(href === '')
      href = 'index.html';
    if(href === current){
      const li = a.closest('li');
      if(li)
        li.classList.add('current');
      a.setAttribute('aria-current', 'page');
      a.removeAttribute('href'); // make it not clickable
      a.style.cursor = 'default';
    }
  });
}