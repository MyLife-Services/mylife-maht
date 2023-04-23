// imports
import Router from 'koa-router'
import { about, board, index, register } from './functions.js'
// variables
const router = new Router()
//	top-level system routes
router.get('/', index)
router.get('/about', about)
router.get('/board', board)
router.get('/register', register)
//	exports
export { router }