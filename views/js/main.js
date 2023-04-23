// set vars and constants
const awaitDiv = document.getElementById('await')
const chatForm = document.getElementById('chat-form')
const messageInput = document.getElementById('message')
const responseDiv = document.getElementById('response')
// Read the value of the 'boardMember' URL parameter
const urlParams = new URLSearchParams(window.location.search)
const selectedBoardMember = urlParams.get('boardMember')
const emulator='Q'
// Add a 'selected' class to the button that matches the selected board member
const buttons = document.querySelectorAll('.board-member-button')
let urlEndpoint = '/chat'
buttons.forEach(button => {
  if (button.dataset.boardMember === selectedBoardMember) {
    button.classList.add('selected')
  }
})
// Toggle the 'selected' class when a button is clicked
buttons.forEach(button => {
  button.addEventListener('click', () => {
	// assign selected class to button with boardMember
    buttons.forEach(b => b.classList.remove('selected'))
	if (boardMember === selectedBoardMember) {
		button.classList.add('selected')
		button.classList.add('btn-primary')
		button.classList.remove('btn-outline-primary')
	}
  })
})

chatForm.addEventListener(
	'submit', 
	async (event) => {
		event.preventDefault()
		awaitDiv.getElementsByTagName('p')[0].innerText=`Connecting with ${emulator}...`	//	could shift for fun
		awaitDiv.style.display='block'
    	const url = window.location.origin + urlEndpoint
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

function toggleBoard() {
	var boardButtons = document.getElementById("board-buttons")
	var boardToggle = document.getElementById("board-toggle")
	
	if (boardButtons.style.display === "none") {
		boardButtons.style.display = "block"
		boardToggle.style.display = "none"
		urlEndpoint = '/board'
	} else {
		boardButtons.style.display = "none"
		boardToggle.style.display = "block"
		urlEndpoint = '/chat'
	}
}

function process() {
	// logic to handle click event
	window.location.reload()
}