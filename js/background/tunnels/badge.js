// Depends on [counters] at js/background/tunnels/counters.js
var badges = {};

var current_tab_id = undefined;

chrome.tabs.query({ currentWindow:true, active: true, lastFocusedWindow: true }, function(tabs) {
  if(tabs[0]) { current_tab_id = tabs[0].id.toString(); }
});

var badge_counter = {
  sum_by: 'executions',
  executions: 'allowed',
  kinds: {
    WebAPIs: false,
    addEventListener: true,
    handleEvent: true
  }
}

chrome.storage.sync.get(null, function(sync_options) {
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if(
      namespace == 'sync' && changes
      &&
      changes['badge_counter'] && changes['badge_counter'].newValue
    ) {
      badge_counter = changes['badge_counter'].newValue;
    }
  });

  badge_counter = sync_options['badge_counter'];
});

var calculate_badge_for_tab_id = function(tab_id) {
  var calls = 0;

  if(counters[tab_id] && counters[tab_id]['counters']) {
    for(key in counters[tab_id]['counters']) {
      for(sub_key in counters[tab_id]['counters'][key]) {
        var allowed = 0;
        var blocked = 0;

        if(badge_counter['sum_by'] == 'executions') {
          allowed = counters[tab_id]['counters'][key][sub_key]['allowed'];
          blocked = counters[tab_id]['counters'][key][sub_key]['blocked'];
        } else {
          if(counters[tab_id]['counters'][key][sub_key]['allowed'] > 0) {
            allowed = 1;
          }

          if(counters[tab_id]['counters'][key][sub_key]['blocked'] > 0) {
            blocked = 1;
          }
        }

        if(badge_counter['kinds'][key]) {
          if(
            badge_counter['executions'] == 'blocked'
            ||
            badge_counter['executions'] == 'allowed_blocked'
          ) {
            calls += blocked;
          }

          if(
            badge_counter['executions'] == 'allowed'
            ||
            badge_counter['executions'] == 'allowed_blocked'
          ) {
            calls += allowed;
          }
        }
      }
    }
  }

  badges[tab_id] = calls;
}

var update_badge_for_tab_id = function(tab_id) {
  if(badges[tab_id] > 0) {
    chrome.browserAction.setBadgeText(
      { text: short_number_for_badge(badges[tab_id]) }
    );

    chrome.browserAction.setBadgeBackgroundColor(
      { color: background_color_for_badge(badges[tab_id]) }
    );
  } else {
    chrome.browserAction.setBadgeText({ text: '' });
  }
}

chrome.tabs.onActivated.addListener(function (activeInfo) {
  current_tab_id = activeInfo.tabId.toString();
  
  setTimeout(function() {
    calculate_badge_for_tab_id(activeInfo.tabId.toString());
    update_badge_for_tab_id(activeInfo.tabId.toString());
  }, 0);
});

chrome.runtime.onMessage.addListener(function (message, _sender) {
  if(message.action == 'log_input') {
    if(message.tab_id == current_tab_id) {
      setTimeout(function() {
        calculate_badge_for_tab_id(message.tab_id);
        update_badge_for_tab_id(message.tab_id);
      }, 0);
    }
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    setTimeout(function() {
      var tab_id = details.tabId.toString();
      delete badges[tab_id];
      calculate_badge_for_tab_id(tab_id);
      update_badge_for_tab_id(tab_id);
    }, 0);
  },
  { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame'] }
);