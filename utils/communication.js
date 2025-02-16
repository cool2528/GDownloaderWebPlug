class CommunicationManager {
  constructor() {
    this.ws = null;
    this.config = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.loadConfig();
  }

  async loadConfig() {
    this.config = await chrome.storage.sync.get({
      serverUrl: 'ws://localhost:8080',
      apiKey: ''
    });
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.config.serverUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket连接成功');
        this.reconnectAttempts = 0;
        this.authenticate();
      };

      this.ws.onclose = () => {
        console.log('WebSocket连接关闭');
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    } catch (error) {
      console.error('WebSocket连接失败:', error);
      this.reconnect();
    }
  }

  authenticate() {
    this.sendMessage({
      type: 'AUTH',
      apiKey: this.config.apiKey
    });
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, 1000 * Math.min(this.reconnectAttempts, 5));
  }

  sendMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket未连接');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  sendDownloadTask(downloadInfo) {
    this.sendMessage({
      type: 'NEW_DOWNLOAD',
      data: downloadInfo
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'DOWNLOAD_PROGRESS':
        // 发送下载进度到content script
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'UPDATE_PROGRESS',
            data: message.data
          });
        });
        break;
      
      case 'DOWNLOAD_COMPLETE':
        // 处理下载完成事件
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon48.png',
          title: '下载完成',
          message: `文件 ${message.data.filename} 已下载完成`
        });
        break;

      case 'ERROR':
        console.error('服务器错误:', message.error);
        break;
    }
  }
}

// 创建全局实例
window.communicationManager = new CommunicationManager();
console.log('CommunicationManager 已定义到全局'); 