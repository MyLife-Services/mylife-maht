//	data service connector for mylife-embedding-services
//	imports
import chalk from 'chalk'
import axios from 'axios'
import { _ } from 'ajv'
//	define class
class PgvectorManager {
	#mylifeEmbeddingServerUrl = process.env.MYLIFE_EMBEDDING_SERVER_URL+':'+process.env.MYLIFE_EMBEDDING_SERVER_PORT+'/'
	#header = {
		headers: {
			Authorization: `Bearer ${process.env.MYLIFE_EMBEDDING_SERVER_BEARER_TOKEN}`,
			'Content-Type': 'application/json',
		}
	}
	//	getter/setter property functions
	//	public functions
	async getLocalRecords(_question) {	//	get local records given question
		//	_question -> proper format for embedder
		_question = {
			"queries": [
					{
					"query": `${ _question }`,
					"filter": {
						"source": "corporate"
					},
					"top_k": 1
					}
				]
		}
		return await axios.post(
			this.#mylifeEmbeddingServerUrl+'query',
			_question,
			this.#header
		)
			.then(res=>{
				res = res.data.results[0]
				if(res.results.length && res.results[0].score > 0.5){
					return res.results[0].text
				}
			})
			.catch(err=>{
				console.error('ERROR: ',err)
				return ''
			})	
	}
}
/* STRUCTURE OF embedder query
{
	"queries": [
			{
			"query": "string",
			"filter": {
				"document_id": "string",
				"source": "email",
				"source_id": "string",
				"author": "string",
				"start_date": "string",
				"end_date": "string"
			},
			"top_k": 3
			}
		]
}
*/
/* STRUCTURE query response object:
response object:
{
	"results": [
		{
			query: '{Text of question}',
			results: [
				id: '{id}',
				text: '{content}',
				metadata: {object}
				score: {-float-score}
			]
		}
	]
}
*/
//	exports
export default PgvectorManager