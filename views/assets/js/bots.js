document.addEventListener('DOMContentLoaded', function() {
    fetchBots();
});
document.querySelectorAll('.bot-container').forEach(container => {
    container.addEventListener('click', function(_event) {
        _event.stopPropagation();
        // First, close any currently open containers and rotate their dropdowns back
        console.log('bot-container::onClick', _event.target)
        const _itemIdSnippet = _event.target.id.split('-').pop()
        switch(_itemIdSnippet){
            case 'create':
                console.log('bot-create', _event.target)
                return
            case 'name':
            case 'ticker':
                // start/stop ticker
                // @todo: double-click to edit in place
                const _span = this.querySelector('span')
                    ? this.querySelector('span')
                    : _event.target;
                _span.classList.toggle('no-animation');
                return
            case 'status':
            case 'type':
            case 'dropdown':
                console.log('bot-status', _event.target)
                document.querySelectorAll('.bot-container').forEach(otherContainer => {
                    if (otherContainer !== this) {
                        // Close the bot options
                        var otherContent = otherContainer.querySelector('.bot-options');
                        if (otherContent) {
                            otherContent.classList.remove('open');
                        }
                        // Rotate back the dropdowns
                        var otherDropdown = otherContainer.querySelector('.bot-options-dropdown');
                        if (otherDropdown) {
                            otherDropdown.classList.remove('open');
                        }
                    }
                });
                // Then, toggle the visibility of the clicked container's content
                var content = this.querySelector('.bot-options');
                if (content) {
                    content.classList.toggle('open');
                }
                // Also toggle the dropdown rotation
                var dropdown = this.querySelector('.bot-options-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('open');
                }
                return
            default:
                break
        }
    });
});
async function fetchBots(){
    try {
        const _url = window.location.origin + '/members/bots';
        const response = await fetch(_url); // Replace with your actual endpoint
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const bots = await response.json();
        // Process and display the bots here
        updateBotContainers(bots);
    } catch (error) {
        console.log('Error fetching bots:', error);
    }
}
function getBotStatus(_bot, _botIcon){
    switch (true) {
        case (_bot?.thread_id?.length>0 || false): // activated
            _botIcon.classList.add('active');
            _botIcon.classList.remove('inactive');
            return 'active'
        case ( _bot?.bot_id?.length>0 || false): // unactivated
            _botIcon.classList.add('inactive');
            _botIcon.classList.remove('active');
            return 'inactive'
        default:
            _botIcon.classList.remove('active', 'inactive');
            return 'none'
    }
}
function updateBotContainers(_bots){
	_bots.forEach(_bot => {
        console.log('bot-initialization', _bot)
        const _botContainer = document.getElementById(_bot.type)
        if (_botContainer) {
            const _botStatus = _botContainer.querySelector(`#${_bot.type}-status`)
            const _botOptions = _botContainer.querySelector(`#${_bot.type}-options`)
            const _botIcon = _botStatus.querySelector(`#${_bot.type}-icon`)
            const _botOptionsDropdown = _botStatus.querySelector(`#${_bot.type}-options-dropdown`);
            const _botName = _botOptions.querySelector(`#${_bot.type}-bot_name`);
            const _botNameInput = _botName.querySelector('input');
            console.log('updateBotContainers', _botNameInput);
            // based on _bot.thread_id, check if bot is active
            _bot.status = getBotStatus(_bot, _botIcon);
            _botNameInput.placeholder = _bot.name;
        } else {
            // @todo: push to home-grown bots
        }
    });
}