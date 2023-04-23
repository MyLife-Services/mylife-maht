class Menu {
	#menu = this.#setMenu()
	constructor(){
	}
	get menu(){
		return this.#menu
	}
	#setMenu(){
		return [
			{ display: `Meet ${ global.ServerAgent.agentName }`, route: '/', icon: 'home', active: true },
			{ display: `about`, route: '/about', icon: 'about' },
			{ display: `membership`, route: '/membership', icon: 'membership' },
			{ display: `summary`, route: '/summary', icon: 'summary' },
			{ display: `register`, route: '/register', icon: 'register' },
		]
	}
}
//	exports
export default Menu