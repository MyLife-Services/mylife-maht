//	imports
import fs from 'fs'
import mime from 'mime-types'
import FormData from 'form-data'
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
	get file(){
		return this.#file
	}
	get session(){
		return this.#ctx.session?.MemberSession??null
	}
	//	setters
	//	private functions
	async embedFile(){
		console.log('#embedFile() begin', this.file)
		const _metadata = {
			source: 'corporate',	//	logickify this
			source_id: this.file.originalFilename,
			url: 'testing-0001',	//	may or may not use url
			author: 'MAHT',	//	convert to session member (or agent)
		}
		const _token = process.env.MYLIFE_EMBEDDING_SERVER_BEARER_TOKEN
		const _data = new FormData()
		_data.append('file', fs.createReadStream(this.file.filepath), { contentType: this.file.mimetype })
		_data.append('metadata', JSON.stringify(_metadata))
		const _request = {
			method: 'post',
			maxBodyLength: Infinity,
			url: 'http://localhost:8000/upsert-file',
			headers: { 
				'Authorization': `Bearer ${_token}`, 
				..._data.getHeaders()
			},
			data : _data
		}
		return await axios.request(_request)
			.then((response) => {
				console.log(`#embedFile() finished: ${response.data.ids}`)
				return response.data
			})
			.catch((error) => {
				console.error(error.message)
				return {'error': error.message }
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