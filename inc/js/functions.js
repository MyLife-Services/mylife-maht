async function commitRequest(_data={}) {
	console.log('received request',chalk.greenBright(_data))
	return await mylifeDataservices?.commit(_data)	//	mylifeDataservices known by parent 
}
// exports
export {
	commitRequest
}