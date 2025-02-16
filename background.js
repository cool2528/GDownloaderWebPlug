// 直接在 background.js 中定义配置
const DEFAULT_CONFIG = {
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

let config = DEFAULT_CONFIG;
let wsConnection = null;
let isConnecting = false;
let reconnectTimer = null;

// 验证配置
async function validateConfig(config) {
  const errors = [];
  
  if (!config.serverUrl?.match(/^wss?:\/\//)) {
    errors.push(chrome.i18n.getMessage('invalidServerUrl'));
  }
  
  return errors;
}

// 修改配置加载逻辑
async function loadAndInitConfig() {
  try {
    // 从 storage 加载已保存的配置
    const savedConfig = await chrome.storage.sync.get(null);
    
    // 合并配置，使用已保存的配置
    config = {
      ...DEFAULT_CONFIG,
      ...savedConfig
    };
    
    console.log('加载的配置:', config);
    
    // 验证配置
    const errors = await validateConfig(config);
    if (errors.length > 0) {
      console.error('配置验证失败:', errors);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: chrome.i18n.getMessage('configError'),
        message: errors.join('\n')
      });
      return false;
    }
    
    // 初始化 WebSocket 连接
    await initializeWebSocket();
    return true;
    
  } catch (error) {
    console.error('加载配置失败:', error);
    return false;
  }
}

// 初始化配置
async function initConfig() {
  try {
    const savedConfig = await chrome.storage.sync.get(DEFAULT_CONFIG);
    config = { ...DEFAULT_CONFIG, ...savedConfig };
    console.log('加载配置:', config);
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 启动时初始化
initConfig();

// 监听配置变化
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    for (let [key, { newValue }] of Object.entries(changes)) {
      if (config.hasOwnProperty(key)) {
        config[key] = newValue;
      }
    }
    console.log('配置已更新:', config);
  }
});

// 初始化 WebSocket 连接
async function initializeWebSocket() {
  if (isConnecting || (wsConnection && wsConnection.readyState === WebSocket.OPEN)) {
    return wsConnection;  // 如果正在连接或已连接，直接返回
  }

  try {
    isConnecting = true;
    wsConnection = new WebSocket(config.serverUrl);
    
    wsConnection.onopen = () => {
      console.log('WebSocket 连接成功');
      isConnecting = false;
      // 连接成功后，清除之前的重连定时器
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    wsConnection.onclose = () => {
      console.log('WebSocket 连接断开，5秒后重试');
      isConnecting = false;
      wsConnection = null;
      
      // 设置重连定时器
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          initializeWebSocket();
        }, 5000);
      }
    };

    wsConnection.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      isConnecting = false;
      
      // 错误时也尝试重连
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          initializeWebSocket();
        }, 5000);
      }
    };

    wsConnection.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('处理 WebSocket 消息失败:', error);
      }
    };

    return wsConnection;
  } catch (error) {
    console.error('初始化 WebSocket 失败:', error);
    isConnecting = false;
    
    // 连接失败时也尝试重连
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initializeWebSocket();
      }, 5000);
    }
    
    throw error;
  }
}

// 添加心跳检测
function startHeartbeat() {
  // 每30秒发送一次心跳
  setInterval(() => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      const heartbeat = {
        jsonrpc: '2.0',
        method: 'aria2.getVersion',
        id: 'heartbeat'
      };
      wsConnection.send(JSON.stringify(heartbeat));
    }
  }, 30000);
}

// 在初始化时启动心跳检测
chrome.runtime.onInstalled.addListener(() => {
  initializeWebSocket().then(() => {
    startHeartbeat();
  });
});

// 处理 WebSocket 消息
function handleWebSocketMessage(message) {
  try {
    // aria2c 的响应格式
    if (message.method === 'aria2.onDownloadStart') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: chrome.i18n.getMessage('downloadStarted'),
        message: chrome.i18n.getMessage('downloadStartMessage')
      });
    } else if (message.method === 'aria2.onDownloadComplete') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: chrome.i18n.getMessage('downloadComplete'),
        message: chrome.i18n.getMessage('downloadCompleteMessage')
      });
    } else if (message.method === 'aria2.onDownloadError') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: chrome.i18n.getMessage('downloadError'),
        message: chrome.i18n.getMessage('downloadErrorMessage')
      });
    }
  } catch (error) {
    console.error('处理 aria2 消息失败:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: chrome.i18n.getMessage('error'),
      message: chrome.i18n.getMessage('processMessageError')
    });
  }
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  switch (message.type) {
    case 'DOWNLOAD_RESOURCE':
      handleDownloadRequest(message, sendResponse);
      break;
  }
  
  // 保持消息通道开放以支持异步响应
  return true;
});

// 辅助函数：获取下载所需的 cookies
async function getCookiesForDownload(resource) {
  try {
    // 检查 URL 是否有效
    if (!resource?.url) {
      console.warn('无效的资源 URL');
      return '';
    }

    // 尝试解析 URL
    try {
      new URL(resource.url);
    } catch (e) {
      console.warn('无效的 URL 格式:', resource.url);
      return '';
    }

    const downloadUrlCookies = await chrome.cookies.getAll({ url: resource.url });
    let pageUrlCookies = [];
    
    if (resource.pageUrl) {
      try {
        pageUrlCookies = await chrome.cookies.getAll({ url: resource.pageUrl });
      } catch (e) {
        console.warn('获取页面 cookies 失败:', e);
      }
    }
    
    const allCookies = [...downloadUrlCookies];
    pageUrlCookies.forEach(cookie => {
      if (!allCookies.some(c => c.name === cookie.name)) {
        allCookies.push(cookie);
      }
    });
    
    return allCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    console.warn('获取 cookies 失败:', error);
    // 即使获取 cookies 失败，返回空字符串继续下载
    return '';
  }
}

// 处理下载请求
async function handleDownloadRequest(message, sendResponse) {
  try {
    // 1. 首先加载并验证配置
    const result = await chrome.storage.sync.get(DEFAULT_CONFIG);
    const config = result || DEFAULT_CONFIG;
    console.log('当前配置:', config);

    // 2. 验证 WebSocket 连接
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
      await initializeWebSocket();
      if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        throw new Error(chrome.i18n.getMessage('websocketConnectionFailed'));
      }
    }

    // 3. 验证资源信息
    if (!message?.resource?.url) {
      throw new Error(chrome.i18n.getMessage('invalidResource'));
    }

    // 4. 获取 cookies（即使失败也继续）
    let headers = [`User-Agent: ${navigator.userAgent}`];
    let cookieString = '';
    try {
      cookieString = await getCookiesForDownload(message.resource);
      if (cookieString) {
        headers.push(`Cookie: ${cookieString}`);
      }
    } catch (error) {
      console.warn('获取 cookies 失败，继续下载:', error);
    }
    
    if (message.resource.pageUrl) {
      headers.push(`Referer: ${message.resource.pageUrl}`);
    }
    
    // 5. 构建下载请求
    const downloadRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'aria2.addUri',
      params: [`token:${config.apiKey}`, [message.resource.url], {
        'max-connection-per-server': config.maxThreads?.toString() || '4',
        header: headers,
        out: message.resource.filename || '',
        'allow-overwrite': 'true'
      }]
    };

    // 6. 发送请求并等待响应
    console.log('发送下载请求:', downloadRequest);
    wsConnection.send(JSON.stringify(downloadRequest));

    // 7. 发送成功响应
    sendResponse({ 
      success: true,
      message: '下载任务已添加'
    });

  } catch (error) {
    console.error('下载请求处理失败:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// 初始化下载拦截规则
chrome.runtime.onInstalled.addListener(() => {
  // 清除所有已存在的规则
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    // 添加新规则
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            css: ['a[href*=".exe"], a[href*=".zip"], a[href*=".rar"]']
          })
        ],
        actions: [new chrome.declarativeContent.ShowAction()]
      }
    ]);
  });
});

// 监听下载事件
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  console.log('检测到下载:', downloadItem);
  
  // 检查是否需要接管
  chrome.storage.sync.get(['takeOverDownloads', 'maxThreads', 'apiKey'], async (config) => {
    console.log('当前下载配置:', config);
    
    if (config.takeOverDownloads) {
      console.log('准备接管下载:', downloadItem.url);
      
      try {
        // 获取当前标签页的 cookies
        const cookies = await chrome.cookies.getAll({ url: downloadItem.url });
        const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        // 构造下载请求
        const downloadRequest = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'aria2.addUri',
          params: [`token:${config.apiKey}`, [downloadItem.url], {
            'max-connection-per-server': config.maxThreads?.toString() || '4',
            header: [
              `Cookie: ${cookieHeader}`,
              `User-Agent: ${navigator.userAgent}`,
              `Referer: ${downloadItem.referrer || ''}`
            ],
            out: downloadItem.filename,
            'allow-overwrite': 'true'
          }]
        };
        
        // 检查 WebSocket 连接
        if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
          await initializeWebSocket();
        }
        
        if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
          throw new Error(chrome.i18n.getMessage('websocketConnectionFailed'));
        }
        
        // 发送到 aria2
        wsConnection.send(JSON.stringify(downloadRequest));
        console.log('已发送到 aria2:', downloadRequest);
        
        // 显示通知
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: chrome.i18n.getMessage('downloadStarted'),
          message: chrome.i18n.getMessage('addedToAria2', [downloadItem.filename])
        });
        
        // 先取消下载
        chrome.downloads.cancel(downloadItem.id, () => {
          console.log('已取消浏览器下载:', downloadItem.id);
          // 立即清理这条下载记录
          chrome.downloads.erase({ id: downloadItem.id }, () => {
            console.log('已清理当前下载记录:', downloadItem.id);
          });
        });
        
        // 然后阻止默认下载行为
        suggest({ cancel: true });
        return true;
        
      } catch (error) {
        console.error('下载处理失败:', error);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: chrome.i18n.getMessage('error'),
          message: error.message
        });
        
        // 发生错误时使用默认下载行为
        suggest({ filename: downloadItem.filename });
        return true;
      }
    } else {
      // 不接管时使用默认行为
      suggest({ filename: downloadItem.filename });
      return true;
    }
  });
  
  return true; // 保持异步处理
});

// 添加清理下载记录的功能
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    // 检查是否启用了下载接管
    chrome.storage.sync.get(['takeOverDownloads'], (config) => {
      if (config.takeOverDownloads) {
        // 延迟一点再清理下载记录
        setTimeout(() => {
          chrome.downloads.erase({ id: delta.id }, () => {
            if (chrome.runtime.lastError) {
              console.error('清理下载记录失败:', chrome.runtime.lastError);
            } else {
              console.log('已清理下载记录:', delta.id);
            }
          });
        }, 500);
      }
    });
  }
});

// 获取文件扩展名
function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}
