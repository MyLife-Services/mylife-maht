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
	extractId(_mbr_id){
		return _mbr_id?.split('|')[1]??_mbr_id
	}
	extractSysName(_mbr_id){
		return _mbr_id.split('|')[0]
	}
	isValidEmail(_email){
		return emailRegex.test(_email)
	}
	isValidGUID(_str) {
		return guid_regex.test(_str)
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