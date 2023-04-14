class MylifeSystemError {
//	public functions
	constructor(err){
		this.error = {}
	}
	handleError(){
		//	mylife error wrapper
		console.log('here',this.error.message)
	}
}
//	exports
export default MylifeSystemError