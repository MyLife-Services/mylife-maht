// set vars and constants
const awaitDiv = document.getElementById('await')
const chatForm = document.getElementById('chat-form')
const messageInput = document.getElementById('message')
const responseDiv = document.getElementById('response')
chatForm.addEventListener(
	'submit', 
	async (event) => {
		event.preventDefault()
		//awaitDiv.innerHTML='Connecting with Maht...'	//	could shift for fun
		awaitDiv.style.display='block'
		const url = 'http://localhost:3000/chat'
		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ message: messageInput.value }),
		}
    	await fetch(url,options)
			.then( async response => {
				awaitDiv.style.display='none'
				const data = await response.json()
				responseDiv.innerHTML = data.answer
			})
			.catch( err =>{
				awaitDiv.style.display='none'
				console.log('fatal error',err)
				responseDiv.innerHTML = `Error: ${err.message}`
			})
	}
)