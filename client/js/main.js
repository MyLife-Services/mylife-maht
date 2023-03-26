const chatForm = document.getElementById('chat-form')
const messageInput = document.getElementById('message')
const responseDiv = document.getElementById('response')

chatForm.addEventListener(
	'submit', 
	async (event) => {
		event.preventDefault()
    const response = await fetch('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })
		try {
			const response = await fetch(`/chat?message=${encodeURIComponent(message)}`);
			const data = await response.json();
			responseDiv.textContent = `Maht's response: ${data.answer}`;
		} catch (error) {
			responseDiv.textContent = `Error: ${error.message}`;
		}
	}
)