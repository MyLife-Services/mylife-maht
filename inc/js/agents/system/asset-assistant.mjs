//	imports
import fs from 'fs'
import mime from 'mime-types'
import FormData from 'form-data'
import axios from 'axios'
//	module constants
//	module constants
const { MYLIFE_EMBEDDING_SERVER_BEARER_TOKEN, MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT, MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN, MYLIFE_SERVER_MBR_ID: mylifeMbrId, } = process.env
const bearerToken = MYLIFE_EMBEDDING_SERVER_BEARER_TOKEN
const fileSizeLimit = parseInt(MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT) || 1048576
const fileSizeLimitAdmin = parseInt(MYLIFE_EMBEDDING_SERVER_FILESIZE_LIMIT_ADMIN) || 10485760
//	module class definition
class oAIAssetAssistant {
	#factory
	#uploadedFileList=[] // uploaded versions
	#globals
	#includeMyLife=false
	#llm
	#response
	#vectorstoreId
	#vectorstoreFileList // openai vectorstore versions
	constructor(factory, globals, llm){
		this.#factory = factory
		this.#globals = globals
		this.#llm = llm
		this.#vectorstoreId = this.#factory.vectorstoreId
	}
	/**
	 * Initializes the asset assistant by uploading the files to the vectorstore and optionally embedding and enacting the files.
	 * @param {string} vectorstoreId - The vectorstore id to upload the files into, if already exists (avatar would know).
	 * @param {boolean} includeMyLife - Whether to embed and enact the files.
	 * @returns {Promise<oAIAssetAssistant>} - The initialized asset assistant instance.
	 */
	async init(includeMyLife=false){
		await this.updateVectorstoreFileList() // sets `this.#vectorstoreFileList`
		this.#includeMyLife = includeMyLife
		return this
	}
	async updateVectorstoreFileList(){
		if(this.#vectorstoreId?.length){
			const updateList = (await this.#llm.files(this.#vectorstoreId)).data
				.filter(file=>!(this.#vectorstoreFileList ?? []).find(vsFile=>vsFile.id===file.id))
			if(updateList?.length){
				this.#vectorstoreFileList = await Promise.all(
					updateList.map(async file =>await this.#llm.file(file.id))
				)
			}
		}
	}
	async upload(files){
		if(!files || !files.length)
			throw new Error('No files found in request.')
		const newFiles = []
		files.forEach(file => {
			const hasFile = this.#uploadedFileList.some(_file=>_file.originalName===file.originalName)
			if(!hasFile)
				newFiles.push(this.#extractFile(file))
		})
		if(newFiles.length){ // only upload new files
			const vectorstoreId = this.#vectorstoreId
			this.#uploadedFileList.push(...newFiles)
			const fileStreams = newFiles.map(file=>fs.createReadStream(file.filepath))
			const dataRecord = await this.#llm.upload(vectorstoreId, fileStreams, this.mbr_id)
			const { response, vectorstoreId: newVectorstoreId, success } = dataRecord
			this.#response = response
			this.#vectorstoreId = newVectorstoreId
			if(!vectorstoreId && newVectorstoreId)
				this.#factory.vectorstoreId = newVectorstoreId // saves to datacore
			if(success && this.#vectorstoreId?.length)
				await this.updateVectorstoreFileList()
		}
		files.forEach(file=>fs.unlinkSync(file.filepath)) /* delete .tmp files */
	}
	//	getters
	get files(){
		return this.vectorstoreFileList
	}
	get mbr_id(){
		return this.#factory.mbr_id
	}
	get response(){
		return this.#response
	}
	get vectorstoreFileList(){
		return this.#vectorstoreFileList
	}
	get vectorstoreId(){
		return this.#vectorstoreId
	}
	//	setters
	//	private functions
	async #embedFile(){
		const file = this.#uploadedFileList[0]
		console.log(file)
		console.log('#embedFile() begin')
		const _metadata = {
			source: 'corporate',	//	logickify
			source_id: file.originalFilename,
			url: 'testing-0001',	//	may or may not use url
			author: 'MAHT',	//	convert to session member (or agent)
		}
		const _token = bearerToken
		const _data = new FormData()
		_data.append('file', fs.createReadStream(file.filepath), { contentType: file.mimetype })
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
			.then(response=>{
				if(this.#includeMyLife)
					return this.#enactFile(response.data)
				return response.data
			})
			.catch((error) => {
				console.error(error.message)
				return {'#embedFile() finished error': error.message }
			})
	}
	async #enactFile(file){	//	vitalizes by saving to MyLife database
		console.log('#enactFile() begin')
		const _fileContent = {
			...file,
			...{ mbr_id: this.mbr_id }
		}
		const oFile = new (AgentFactory.file)(_fileContent)
		console.log('testing factory',oFile.inspect(true))
		return oFile
	}
	/**
	 * Takes an uploaded file object and extracts relevant file properties.
	 * @param {File} file - File object
	 * @returns {object} - Extracted file object.
	 */
	#extractFile(file){
		if(!file)
			throw new Error('No file found in request.')
		const { lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size } = file
		this.#validateFile(file)
		return {
			...{ lastModifiedDate, filepath, newFilename, originalFilename, mimetype, size, localFilename: `${this.#globals.newGuid}.${mime.extension(mimetype)}` },
		}
	}
	/**
	 * Takes an array of uploaded file objects and extracts relevant file properties.
	 * @param {File[]} files - Array of file objects.
	 * @returns {File[]} - Array of extracted file objects.
	 */
	#extractFiles(files){
		if(!Array.isArray(files) || !files.length)
			throw new Error('No files found in request.')
		return files.map(file=>this.#extractFile(file))
	}
	/**
	 * Validates a file object, _throws error_ if file is invalid.
	 * @param {File} file - File object
	 * @returns {void}
	 */
	#validateFile(file){
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
		const { size, mimetype } = file
		const maxFileSize = this.mbr_id === mylifeMbrId
			?	fileSizeLimitAdmin
			:	fileSizeLimit
		if((size ?? 0) > maxFileSize)
			throw new Error(`File size too large: ${ size }. Maximum file size is 1MB.`)
		if(!allowedMimeTypes.includes(mimetype))
			throw new Error(`Unsupported media type: ${ mimetype }. File type not allowed.`)
	}
}
// exports
export default oAIAssetAssistant