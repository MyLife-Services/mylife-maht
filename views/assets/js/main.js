/*
	Dopetrope by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/
// variables
const $ = jQuery,
	url = "https://www.zeffy.com/en-US/donation-form/donate-to-help-us-bring-rational-politics-back",
	features = [
		"popup=yes",
		"width=900",
		"height=950",
		"left=120",
		"top=80",
		"resizable=yes",
		"scrollbars=yes"
	].join(",");
const $window = $(window),
	$body = $('body');
// functions
function attachDonatePopup() {
  const donateLink = document.getElementById("donateLink");
  if(!donateLink)
    return;
  donateLink.addEventListener("click", function (e) {
    e.preventDefault();
    const w = window.open(url, "zeffyDonate", features);
    // Fallback if popup blocked
    if (!w) window.open(url, "_blank", "noopener");
  });
}
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
			else
				a.classList.add('current');
			a.setAttribute('aria-current', 'page');
			a.removeAttribute('href'); // make it not clickable
			a.style.cursor = 'default';
		}
	});
}
function navPanelCreate(){
	// Dropotron
	$('#nav > ul').dropotron({
		mode: 'fade',
		noOpenerFade: true,
		alignment: 'center'
	});
	// navPanel
	// icon
	$(
		'<div id="titleBar">' +
			'<a href="#navPanel" class="toggle"></a>' +
		'</div>'
	)
		.appendTo($body);
	// panel
	$(
		'<div id="navPanel">' +
			'<nav>' +
				$('#nav').navList() +
			'</nav>' +
		'</div>'
	)
		.appendTo($body)
		.panel({
			delay: 500,
			hideOnClick: true,
			hideOnSwipe: true,
			resetScroll: true,
			resetForms: true,
			side: 'left',
			target: $body,
			visibleClass: 'navPanel-visible'
		});
}
// execute
Promise.all([
	fetch('header.html')
		.then(r => r.text())
		.then(html => {
		document.getElementById('header').innerHTML = html;
		markAndDisableCurrentNavLink();
		navPanelCreate();
		}),
	fetch('footer.html')
		.then(r => r.text())
		.then(html => document.getElementById('footer').innerHTML = html),
	])
	.catch(err => console.error('Error loading header or footer:', err))
	.finally(() => {
		attachDonatePopup();
		document.body.classList.remove('is-loading');
		breakpoints({
			xlarge:  [ '1281px',  '1680px' ],
			large:   [ '981px',   '1280px' ],
			medium:  [ '737px',   '980px'  ],
			small:   [ null,      '736px'  ]
		});
	});
