class Menu {
	#menu
	constructor(_Agent){
		this.#menu = [
			{ display: `Meet ${ _Agent.agentName }`, route: '/', icon: 'home' },
			{ display: `about`, route: '/about', icon: 'about' },
			{ display: `membership`, route: '/members', icon: 'membership' },
			{ display: `register`, route: '/register', icon: 'register' },
		]
	}
	get menu(){
		return this.#menu
	}
}
//	exports
export default Menu