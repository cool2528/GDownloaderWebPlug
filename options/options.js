// 默认配置
const DEFAULT_CONFIG = {
  downloadPath: '',  // 移除默认值,保持为空
  maxThreads: 4,
  apiKey: 'GDownload_secret',
  serverUrl: 'ws://localhost:16888/jsonrpc',
  fileTypes: 'mp4,mkv,avi,mov,wmv,flv,webm,' + // 视频
            'mp3,wav,aac,ogg,flac,m4a,' +      // 音频
            'jpg,jpeg,png,gif,bmp,webp,svg,' +  // 图片
            'pdf,doc,docx,xls,xlsx,ppt,pptx,' + // 文档
            'txt,md,json,xml,csv,' +            // 文本
            'zip,rar,7z,tar,gz,xz,' +           // 压缩包
            'exe,msi,dmg,pkg,deb,rpm',          // 安装包
  enableSniffing: true,
  takeOverDownloads: false
};

// 显示状态消息
function showStatus(message, type = 'success') {
  const status = document.createElement('div');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    border-radius: 4px;
    background: ${type === 'success' ? '#2196F3' : '#f44336'};
    color: white;
    z-index: 1000;
  `;
  
  document.body.appendChild(status);
  setTimeout(() => status.remove(), 3000);
}

// 初始化国际化文本
function initializeI18n() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageKey = element.getAttribute('data-i18n');
    const translatedText = chrome.i18n.getMessage(messageKey);
    if (translatedText) {
      element.textContent = translatedText;
    }
  });
}

// 添加文件类型分类显示函数
function getFileTypesCategories() {
  return {
    video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'],
    audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
    document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
    text: ['txt', 'md', 'json', 'xml', 'csv'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'xz'],
    executable: ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm']
  };
}

// 添加文件类型提示显示
function updateFileTypesHelp() {
  const categories = getFileTypesCategories();
  const helpText = document.getElementById('fileTypesHelp');
  const currentLang = chrome.i18n.getUILanguage();
  
  let helpHtml = '';
  for (const [category, extensions] of Object.entries(categories)) {
    helpHtml += `<div class="file-type-category">
      <strong>${chrome.i18n.getMessage(category + 'Files')}</strong>: 
      ${extensions.join(', ')}
    </div>`;
  }
  
  helpText.innerHTML = helpHtml;
}

// 保存配置
async function saveOptions() {
  try {
    const config = {
      maxThreads: parseInt(document.getElementById('maxThreads').value),
      apiKey: document.getElementById('apiKey').value,
      serverUrl: document.getElementById('serverUrl').value,
      fileTypes: document.getElementById('fileTypes').value.trim(),
      enableSniffing: document.getElementById('enableSniffing').checked,
      takeOverDownloads: document.getElementById('takeOverDownloads').checked
    };

    // 验证配置
    if (config.maxThreads < 1 || config.maxThreads > 32) {
      throw new Error(chrome.i18n.getMessage('invalidThreadCount'));
    }

    if (!config.serverUrl.startsWith('ws://') && !config.serverUrl.startsWith('wss://')) {
      throw new Error(chrome.i18n.getMessage('invalidServerUrl'));
    }

    await chrome.storage.sync.set(config);
    showStatus(chrome.i18n.getMessage('configSaved'));
  } catch (error) {
    console.error('保存配置失败:', error);
    showStatus(error.message, 'error');
  }
}

// 加载配置
async function loadOptions() {
  try {
    initializeI18n();
    const config = await chrome.storage.sync.get(DEFAULT_CONFIG);
    
    // 填充表单
    document.getElementById('maxThreads').value = config.maxThreads;
    document.getElementById('apiKey').value = config.apiKey;
    document.getElementById('serverUrl').value = config.serverUrl;
    document.getElementById('enableSniffing').checked = config.enableSniffing;
    document.getElementById('takeOverDownloads').checked = config.takeOverDownloads;
    document.getElementById('fileTypes').value = config.fileTypes;
    
    // 添加文件类型帮助信息
    updateFileTypesHelp();
    
    // 添加文件类型输入框的自动完成功能
    const fileTypesInput = document.getElementById('fileTypes');
    fileTypesInput.addEventListener('focus', () => {
      if (!fileTypesInput.value) {
        fileTypesInput.value = DEFAULT_CONFIG.fileTypes;
      }
    });
    
  } catch (error) {
    console.error('加载配置失败:', error);
    showStatus(chrome.i18n.getMessage('loadConfigError'), 'error');
  }
}

// 重置配置
async function resetOptions() {
  try {
    await chrome.storage.sync.set(DEFAULT_CONFIG);
    await loadOptions();
    showStatus(chrome.i18n.getMessage('configReset'));
  } catch (error) {
    showStatus(error.message, 'error');
  }
}

// 测试服务器连接
async function testConnection() {
  const serverUrl = document.getElementById('serverUrl').value;
  const apiKey = document.getElementById('apiKey').value;

  if (!serverUrl) {
    showStatus(chrome.i18n.getMessage('invalidServerUrl'), 'error');
    return;
  }

  try {
    const ws = new WebSocket(serverUrl);
    let timeoutId = setTimeout(() => {
      ws.close();
      showStatus(chrome.i18n.getMessage('connectionTimeout'), 'error');
    }, 5000);  // 5秒超时
    
    ws.onopen = () => {
      const testRequest = {
        jsonrpc: '2.0',
        method: 'aria2.getVersion',
        id: Date.now(),
        params: apiKey ? [`token:${apiKey}`] : []
      };
      
      ws.send(JSON.stringify(testRequest));
    };

    ws.onmessage = (event) => {
      clearTimeout(timeoutId);
      try {
        const response = JSON.parse(event.data);
        if (response.result && response.result.version) {
          showStatus(chrome.i18n.getMessage('connectionTestSuccess') + `: Aria2 ${response.result.version}`);
        } else if (response.error) {
          showStatus(chrome.i18n.getMessage('connectionTestFailed') + `: ${response.error.message}`, 'error');
        }
      } catch (error) {
        showStatus(chrome.i18n.getMessage('invalidResponse') + `: ${error.message}`, 'error');
      }
      ws.close();
    };

    ws.onerror = (error) => {
      clearTimeout(timeoutId);
      showStatus(chrome.i18n.getMessage('websocketConnectionFailed'), 'error');
      ws.close();
    };
  } catch (error) {
    showStatus(chrome.i18n.getMessage('connectionTestFailed') + `: ${error.message}`, 'error');
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  loadOptions();
  document.getElementById('saveButton').addEventListener('click', saveOptions);
  document.getElementById('resetButton').addEventListener('click', resetOptions);
  document.getElementById('testButton').addEventListener('click', testConnection);
}); 