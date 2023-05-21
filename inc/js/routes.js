// imports
import Router from 'koa-router'
import { about, board, challenge, chat, index, members, register } from './functions.js'
// variables
const _Router = new Router()
function connectRoutes(_Agent,_Menu){
	_Router.get('/', index)
	_Router.get('/about', about)
	_Router.get('/board', board)
	_Router.get('/board/:bid', board)
	_Router.get('/members', members)
	_Router.get('/members/:mid', members)
	_Router.get('/register', register)
	_Router.post('/', chat)
	_Router.post('/board', chat)
	_Router.post('/challenge', challenge)

	return _Router
}
// exports
export default function init(_Agent,_Menu) {
	connectRoutes(_Agent,_Menu)
	return _Router
}
