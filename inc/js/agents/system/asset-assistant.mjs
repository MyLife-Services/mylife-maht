//	imports
import fs from 'fs'
import mime from 'mime-types'
import axios from 'axios'
//	modular constants
const aAdmins = JSON.parse(process.env.MYLIFE_HOSTED_MBR_ID)
//	modular variables
let AgentFactory
let Globals
//	modular class definition
class oAIAssetAssistant {
	//	pseudo-constructor
	#ctx
	#file
	constructor(_ctx){
		//	primary direct assignment
		this.#ctx = _ctx
		//	modular direct assignment
		if(!AgentFactory) AgentFactory = this.#ctx.AgentFactory
		if(!Globals) Globals = this.#ctx.Globals
		//	secondary direct assignment
		this.#file = this.#extractFile(this.#ctx)
		//	validate asset construction
		this.#validateFile()
	}
	//	getters
	get ctx(){
		return this.#ctx
	}
	get session(){
		return this.#ctx.session?.MemberSession??null
	}
	//	setters
	//	private functions
	async embedFile(){
		console.log('#embedFile() begin')
		const _uploadDestination = Globals.uploadPath + this.#file.localFilename
		console.log(_uploadDestination)
		const reader = fs.createReadStream(this.#file.filepath)	// create a read stream
		//	upload to server
		//	file
		//	metadata
		let _url = 'http://localhost:8000/upsert-file'	//	AgentFactory.urlEmbeddingServer
		return await axios.post(_url, reader, {
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			})
			.then(response => {
				console.log('File uploaded successfully', response.data)
				// Additional processing based on response
			})
			.catch(error => {
				console.error('Error uploading file:', error)
				// Error handling
			})
	}
	//	private functions
	#extractFile(){
		if(!this.#ctx.request?.files?.file??false) throw new Error('No file found in request.')
		const { lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size } = this.#ctx.request.files.file
		return {
			...{ lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size, localFilename: `${Globals.newGuid}.${mime.extension(mimetype)}` },
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
		let _mbr_id = this.#ctx.state.member.mbr_id
		let _maxFileSize = (aAdmins.includes(_mbr_id) || _mbr_id === process.env.MYLIFE_SERVER_MBR_ID)
			?	process.env.MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN
			:	process.env.MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT
		if (this.#file.size > _maxFileSize) throw new Error(`File size too large: ${this.#file.size}. Maximum file size is 1MB.`)
		//	reject mime-type
		if (!allowedMimeTypes.includes(this.#file.mimetype)) throw new Error(`Unsupported media type: ${this.#file.mimetype}. File type not allowed.`)
	}
}
// exports
export default oAIAssetAssistant