// imports
import Router from 'koa-router'
import { about, board, challenge, chat, feedback, index, members, register } from './route-functions.js'
class Routes {
	#Router = new Router({
		prefix: '/mylife',
	})
	constructor(){
		this.#Router.get('/', index)
		this.#Router.get('/about', about)
		this.#Router.get('/board', board)
		this.#Router.get('/board/:bid', board)
		this.#Router.get('/members', members)
		this.#Router.get('/members/:mid', members)
		this.#Router.get('/register', register)
		this.#Router.post('/', chat)
		this.#Router.post('/board', chat)
		this.#Router.post('/challenge', challenge)
		this.#Router.post('/feedback', feedback)

		return this.#Router
	}
}
// exports
export default Routes