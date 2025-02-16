console.log('content.js 开始执行');

// 初始化资源检测器
let detector = null;

// 确保在页面完全加载后初始化
window.addEventListener('load', async () => {
  if (!detector) {
    const config = await getConfig();
    detector = new ResourceDetector(config);
    console.log('ResourceDetector 已初始化 (load)');
    detector.checkElementForResources(document.body);
    setupMutationObserver();
  }
});

// DOMContentLoaded 时也尝试初始化
document.addEventListener('DOMContentLoaded', async () => {
  if (!detector) {
    const config = await getConfig();
    detector = new ResourceDetector(config);
    console.log('ResourceDetector 已初始化 (DOMContentLoaded)');
    detector.checkElementForResources(document.body);
    setupMutationObserver();
  }
});

// 初始检查页面
setTimeout(() => {
  if (!detector) {
    detector = new ResourceDetector();
    console.log('ResourceDetector 已初始化 (setTimeout)');
  }
  detector.checkElementForResources(document.body);  // 使用实例方法
}, 1000);

// 监听页面加载完成
document.addEventListener('DOMContentLoaded', () => {
  // 监听页面中的链接
  document.querySelectorAll('a').forEach(link => {
    const url = link.href;
    if (url) {
      detector.addResource(url);
    }
  });
  
  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 检查新添加的链接
          node.querySelectorAll('a').forEach(link => {
            const url = link.href;
            if (url) {
              detector.addResource(url);
            }
          });
        }
      });
    });
  });
  
  // 开始观察 DOM 变化
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});

// 监听配置变更
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enableSniffing || changes.fileTypes) {
    // 配置发生变化时重新初始化
    getConfig().then(config => {
      detector = new ResourceDetector(config);
    });
  }
});

// 检查元素中的资源链接
function checkElementForResources(element) {
  if (!detector) {
    console.error('ResourceDetector 未初始化');
    return;
  }

  try {
    // 检查 a 标签
    element.querySelectorAll('a').forEach(link => {
      if (link.href) {
        console.log('检查链接:', link.href);
        detector.addResource(link.href);
      }
    });

    // 检查 video 和 source 标签
    element.querySelectorAll('video, source').forEach(media => {
      if (media.src) {
        console.log('检查媒体:', media.src);
        detector.addResource(media.src);
      }
    });
  } catch (error) {
    console.error('资源检测失败:', error);
  }
}

// 从 background 获取配置
async function getConfig() {
  try {
    const config = await chrome.storage.sync.get(null);
    return config;
  } catch (error) {
    console.error('获取配置失败:', error);
    return null;
  }
}

// 初始化
async function init() {
  const config = await getConfig();
  if (config) {
    // 初始化资源检测器
    const detector = new ResourceDetector(config);
    // ... 其他初始化代码 ...
  }
}

init();

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RESOURCE_DETECTED') {
    console.log('收到资源检测消息:', message.url);
    if (window.ResourceDetector) {
      window.ResourceDetector.addResource(message.url);
    }
  }
});

// 添加 MutationObserver 监听DOM变化
function setupMutationObserver() {
  if (!detector) return;
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { // ELEMENT_NODE
          detector.checkElementForResources(node);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'href', 'data']
  });
}

// 添加全局样式
const style = document.createElement('style');
style.textContent = `
  .gdownloader-btn {
    position: absolute;
    z-index: 999999;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    opacity: 0.9;
    transition: opacity 0.2s;
  }
  .gdownloader-btn:hover {
    opacity: 1;
  }
`;
document.head.appendChild(style); 