class Menu {
	#menu = this.#setMenu()
	constructor(){
	}
	get menu(){
		return this.#menu
	}
	#setMenu(){
		return [
			{ display: `Meet ${ global.Maht.agentName }`, route: '/', icon: 'home' },
			{ display: `about`, route: '/about', icon: 'about' },
			{ display: `membership`, route: '/membership', icon: 'membership' },
			{ display: `register`, route: '/register', icon: 'register' },
		]
	}
}
//	exports
export default Menu