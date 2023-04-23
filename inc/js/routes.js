// imports
import Router from 'koa-router'
import { about, index, register } from './functions.js'
// variables
const router = new Router()
//	system routes
router.get('/', index)
router.get('/about', about)
router.get('/register', register)
router.get('/getMemberSession',
	ctx => {
		ctx.body = ctx.session.mylifeMemberCoreData
	}
)
//	exports
export { router }