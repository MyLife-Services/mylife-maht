//	definitions
class Config{
	constructor(_mbr_id){
		console.log('configuring datasource for member...',_mbr_id)
		this.endpoint=process.env.MYLIFE_DB_ENDPOINT
		this.rw_id=process.env.MYLIFE_DB_RW
		this.rx_id=process.env.MYLIFE_DB_RX
		this.db={
			'id': process.env.MYLIFE_DB_NAME,
			'container': {
				'id': process.env.MYLIFE_DB_CONTAINER_NAME,
				'partitionId': _mbr_id,
				'coreId': _mbr_id.split('|')[1]	//	second object is core item id
			}
		}
	}
}
//	exports
export default Config