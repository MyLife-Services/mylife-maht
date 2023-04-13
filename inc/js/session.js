class MylifeMemberSession {
	constructor(_core){
		this.name = 'MylifeMemberSession'
		this.member = _core
	}
	//	PUBLIC functions
	getMemberCore(){
		return this.member
	}
}
export default MylifeMemberSession