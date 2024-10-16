//	definitions
class Config{
	constructor(_mbr_id){
		this.endpoint=process.env.MYLIFE_DB_ENDPOINT
		this.rw_id=process.env.MYLIFE_DB_RW
		this.rx_id=process.env.MYLIFE_DB_RX
		this.members={
			id: process.env.MYLIFE_DB_NAME,
			container: {
				id: process.env.MYLIFE_DB_CONTAINER_NAME,
				partitionId: _mbr_id,
				coreId: _mbr_id.split('|')[1],	//	second object is core item id
			}
		}
		this.registration={
			id: process.env.MYLIFE_DB_NAME,
			container: {
				id: process.env.MYLIFE_REGISTRATION_DB_CONTAINER_NAME,
				partitionId: _mbr_id,
			}
		}
		this.system={
			id: process.env.MYLIFE_DB_NAME,
			container: {
				id: process.env.MYLIFE_SYSTEM_DB_CONTAINER_NAME,
				partitionId: _mbr_id,
			}
		}
	}
}
//	exports
export default Config