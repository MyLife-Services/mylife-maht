//	imports
import fs from 'fs'
import mime from 'mime-types'
import { koaBody } from 'koa-body'
//	variable definition
//	class definition
class oAIAssetAssistant {
	//	pseudo-constructor
	#ctx
	#file
	#globals
	constructor(_ctx){
		//	direct assignments
		this.#ctx = _ctx
		this.#globals = this.#ctx.session.MemberSession.globals
		//	validate asset construction
		this.#file = this.#extractFile(this.#ctx)
		this.#validateFile()
		const _uploadDestination = `./.uploads/.tmp/${this.#file.localFilename}`
		const reader = fs.createReadStream(this.#file.filepath)	// create a read stream
		const stream = fs.createWriteStream(_uploadDestination)	// create a write stream
		reader.pipe(stream)	// pipe the file to the destination
		console.log('File uploaded successfully', _uploadDestination)
	}
	//	getters
	get ctx(){
		return this.#ctx
	}
	//	setters
	//	private functions
	#extractFile(){
		if(!this.#ctx.request?.files?.file??false) throw new Error('No file found in request.')
		const { lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size } = this.#ctx.request.files.file
		return {
			...{ lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size, localFilename: `${this.#globals.newGuid}.${mime.extension(mimetype)}` },
			...this.#ctx.request.body
		}
	}
	#validateFile(){
		const allowedMimeTypes = [
			'application/json',
			'application/msword',
			'application/pdf',
			'application/rtf',
			'application/vnd.ms-powerpoint',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'text/csv',
			'text/html',
			'text/markdown',
			'text/plain',
		]
		// reject size
		if (this.#file.size > 1024*1024) throw new Error(`File size too large: ${this.#file.size}. Maximum file size is 1MB.`)
		//	reject mime-type
		if (!allowedMimeTypes.includes(this.#file.mimetype)) throw new Error(`Unsupported media type: ${this.#file.mimetype}. File type not allowed.`)
	}
}
// exports
export default oAIAssetAssistant