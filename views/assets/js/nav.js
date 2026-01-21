fetch('nav.html')
    .then(r => r.text())
    .then(html => {
        document.getElementById('header').innerHTML = html
        const currentPage = window.location.pathname.split('/').pop()
        document.querySelectorAll('nav li')
            .forEach(link=>{
                // select the a under link
                const a = link.querySelector('a')
                const linkPage = a.getAttribute('href').split('/').pop()
                if(linkPage===currentPage){
                    link.classList.add('current')
                    a.removeAttribute('href')
                }
            })
    })