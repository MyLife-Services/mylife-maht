document.addEventListener('DOMContentLoaded', function() {
    fetchBots();
});
document.querySelectorAll('.bot-options').forEach(options => {
    options.addEventListener('click', function(event) {
        event.stopPropagation();
    });
});
document.querySelectorAll('.bot-container').forEach(container => {
    container.addEventListener('click', function(_event) {
        // First, close any currently open containers and rotate their dropdowns back
        const _itemIdSnippet = _event.target.id.split('-').pop()
        switch(_itemIdSnippet){
            case 'create':
                console.log('bot-create', _event.target)
                return
            case 'name':
                // start/stop ticker
                // @todo: double-click to edit in place
                console.log('bot-name', _event.target)

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
        console.log('Fetching bots')
        const _url = window.location.origin + '/members/bots';
        console.log(_url)
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
            console.log('getBotStatus:active', _bot, _botIcon)
            _botIcon.classList.add('active');
            _botIcon.classList.remove('inactive');
            return 'active'
        case ( _bot?.bot_id?.length>0 || false): // unactivated
             console.log('getBotStatus:inactive', _bot, _botIcon)
            _botIcon.classList.add('inactive');
            _botIcon.classList.remove('active');
            return 'inactive'
        default:
            console.log('getBotStatus:none', _bot?.bot_id, _botIcon)
            _botIcon.classList.remove('active', 'inactive');
            return 'none'
    }
}
function updateBotContainers(_bots){
	_bots.forEach(_bot => {
        const _botContainer = document.getElementById(_bot.type);
        if (_botContainer) {
            const _botStatus = _botContainer.querySelector('.bot-status');
            const _botIcon = _botStatus.querySelector('.bot-icon');
            const _botOptions = _botContainer.querySelector('.bot-options');
            const _botOptionsDropdown = _botStatus.querySelector('.bot-options-dropdown');
            // based on _bot.thread_id, check if bot is active
            _bot.status = getBotStatus(_bot, _botIcon);
        } else {
            // @todo: push to home-grown bots
        }
    });
}