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
			{ display: `About`, route: '/about', icon: 'about', },
			{ display: `Walkthrough`, route: 'https://medium.com/@ewbj/mylife-we-save-your-life-480a80956a24', icon: 'gear', },
			{ display: `Donate`, route: 'https://gofund.me/65013d6e', icon: 'donate', },
		]
	}
}
//	exports
export default Menu