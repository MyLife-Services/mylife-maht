// imports
import EventEmitter from 'events'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
// define global constants
const guid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i	//	regex for GUID validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/	//	regex for email validation
// modular classes
class Globals extends EventEmitter {
	constructor() {
		//	essentially this is a coordinating class wrapper that holds all of the sensitive data and functionality; as such, it is a singleton, and should either _be_ the virtual server or instantiated on one at startup
		super()
	}
	//	public utility functions
	getRegExp(str, isGlobal = false) {
		if (typeof str !== 'string' || !str.length)
			throw new Error('Expected a string')
		return new RegExp(str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), isGlobal ? 'g' : '')
	}
	isValidEmail(_email){
		return emailRegex.test(_email)
	}
	isValidGuid(_str='') {
		return (typeof _str === 'string' && guid_regex.test(_str))
	}
	sysId(_mbr_id){
		if(!typeof _mbr_id==='string' || !_mbr_id.length || !_mbr_id.includes('|'))
			throw new Error('expected MyLife member id string')
		return _mbr_id.split('|')[1]
	}
	sysName(_mbr_id){
		return _mbr_id.split('|')[0]
	}
	toString(_obj){
		return Object.entries(_obj).map(([k, v]) => `${k}: ${v}`).join(', ')
	}
	//	getters/setters
	get uploadPath(){
		return './.uploads/.tmp/'
	}
	get newGuid(){	//	this.newGuid
		return Guid.newGuid().toString()
	}
}
//	exports
export default Globals