//	import db_dotenv from 'dotenv'
//	db_dotenv.config()
//	definitions
class Config{
	constructor(){
		this.endpoint=process.env.MYLIFE_DB_ENDPOINT
		this.rw_id=process.env.MYLIFE_DB_RW
		this.rx_id=process.env.MYLIFE_DB_RX
		this.db={
			'id': process.env.MYLIFE_DB_NAME,
			'container': {
				'id': process.env.MYLIFE_DB_CONTAINER_NAME,
				'partitionId': process.env.MYLIFE_MBR_ID,
				'coreId': process.env.MYLIFE_MBR_ID.split('|')[1]	//	second object is core item id
			}
		}
	}
}
//	exports
export default Config