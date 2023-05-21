class Menu {
	#menu
	constructor(_Agent){
		this.#menu = this.#setMenu(_Agent)
	}
	get menu(){
		return this.#menu
	}
	#setMenu(_Agent){
		return [
			{ display: `Meet ${ _Agent.agentName }`, route: '/', icon: 'home' },
			{ display: `about`, route: '/about', icon: 'about' },
			{ display: `membership`, route: '/members', icon: 'membership' },
			{ display: `register`, route: '/register', icon: 'register' },
		]
	}
}
//	exports
export default Menu