import xml2json from 'xml2json'	//	https://www.npmjs.com/package/xml2json

const parseXml=(xml)=>{
	//	https://www.npmjs.com/package/xml2json
	//	https://www.npmjs.com/package/xml2json#options
	var xml2jsonOptions = {
		object: true,
		reversible: false,
		coerce: false,
		sanitize: true,
		trim: false,
		arrayNotation: false,
		alternateTextNode: true
	}
	let oData = xml2json
		.toJson(xml,xml2jsonOptions)
	return oData
}
//	export entities
export {
	//	public functions
	parseXml,
}