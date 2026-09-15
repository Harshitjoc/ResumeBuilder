chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "OPEN_TRACKER" && typeof message.payload === "string") {
    chrome.tabs.create({ url: message.payload, active: true })
  }
})

export {}