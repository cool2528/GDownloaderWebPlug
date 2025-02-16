document.addEventListener('DOMContentLoaded', async () => {
  // 设置国际化文本
  document.getElementById('appTitle').textContent = chrome.i18n.getMessage('appName');
  document.getElementById('checkingConnection').textContent = chrome.i18n.getMessage('checkingConnection');
  document.getElementById('openOptions').textContent = chrome.i18n.getMessage('openSettings');
  document.getElementById('toggleSniffing').textContent = chrome.i18n.getMessage('toggleSniffing');
  document.getElementById('reconnect').textContent = chrome.i18n.getMessage('reconnect');

  const connectionStatus = document.getElementById('connectionStatus');
  const toggleSniffingBtn = document.getElementById('toggleSniffing');
  const reconnectBtn = document.getElementById('reconnect');
  const openOptionsBtn = document.getElementById('openOptions');

  // 加载配置
  const config = await chrome.storage.sync.get({
    enableSniffing: true,
    serverUrl: 'ws://localhost:16888/jsonrpc',
    apiKey: 'GDownload_secret'
  });

  // 更新嗅探按钮状态
  updateSniffingStatus(config.enableSniffing);

  // 检查连接状态
  checkConnectionStatus();

  // 绑定事件处理
  toggleSniffingBtn.addEventListener('click', async () => {
    const { enableSniffing } = await chrome.storage.sync.get({ enableSniffing: true });
    const newStatus = !enableSniffing;
    
    await chrome.storage.sync.set({ enableSniffing: newStatus });
    updateSniffingStatus(newStatus);
  });

  reconnectBtn.addEventListener('click', () => {
    checkConnectionStatus();
  });

  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 更新嗅探状态UI
  function updateSniffingStatus(enabled) {
    toggleSniffingBtn.textContent = enabled ? 
      chrome.i18n.getMessage('disableSniffing') : 
      chrome.i18n.getMessage('enableSniffing');
    toggleSniffingBtn.style.background = enabled ? '#f44336' : '#2196F3';
  }

  // 检查服务器连接状态
  async function checkConnectionStatus() {
    connectionStatus.className = 'status';
    connectionStatus.textContent = '正在检查连接...';

    try {
      const ws = new WebSocket(config.serverUrl);
      
      ws.onopen = () => {
        // 使用 getVersion 方法测试连接
        const testRequest = {
          jsonrpc: '2.0',
          method: 'aria2.getVersion',
          id: Date.now(),
          params: config.apiKey ? [`token:${config.apiKey}`] : []
        };
        
        ws.send(JSON.stringify(testRequest));
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.result && response.result.version) {
            connectionStatus.className = 'status connected';
            connectionStatus.textContent = `已连接到 Aria2 ${response.result.version}`;
          } else {
            connectionStatus.className = 'status disconnected';
            connectionStatus.textContent = '连接测试失败';
          }
        } catch (error) {
          connectionStatus.className = 'status disconnected';
          connectionStatus.textContent = '无法解析响应';
        }
        ws.close();
      };
    } catch (error) {
      connectionStatus.className = 'status disconnected';
      connectionStatus.textContent = '连接错误: ' + error.message;
    }
  }
}); 