// imports
import EventEmitter from 'events'
import { Guid } from 'js-guid'	//	usage = Guid.newGuid().toString()
// define global constants
// modular classes
class Globals extends EventEmitter {
	constructor() {
		//	essentially this is a coordinating class wrapper that holds all of the sensitive data and functionality; as such, it is a singleton, and should either _be_ the virtual server or instantiated on one at startup
		super()
	}
	//	public utility functions
	extractId(_mbr_id){
		return _mbr_id.split('|')[1]
	}
	extractSysName(_mbr_id){
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