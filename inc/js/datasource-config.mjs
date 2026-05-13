//	definitions
class Config{
	constructor(_mbr_id){
		this.endpoint=process.env.MYLIFE_DB_ENDPOINT
		this.rw_id=process.env.MYLIFE_DB_RW
		this.campaigns={
			id: process.env.MYLIFE_DB_NAME,
			container: {
				id: process.env.MYLIFE_DB_CONTAINER_NAME_CAMPAIGNS,
				partitionId: 'campaign_id',
			}
		}
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
				id: process.env.MYLIFE_DB_CONTAINER_NAME_REGISTRATION,
				partitionId: _mbr_id,
			}
		}
		this.shares={
			id: process.env.MYLIFE_DB_NAME,
			container: {
				id: process.env.MYLIFE_DB_CONTAINER_NAME_SHARES,
				partitionId: 'shareType',
			}
		}
		this.system={
			id: process.env.MYLIFE_DB_NAME,
			container: {
				id: process.env.MYLIFE_DB_CONTAINER_NAME_SYSTEM,
				partitionId: _mbr_id,
			}
		}
	}
}
//	exports
export default Config