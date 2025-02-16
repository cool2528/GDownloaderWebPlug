console.log('content.js 开始执行');

// 初始化资源检测器
let detector = null;

// 确保在页面完全加载后初始化
window.addEventListener('load', () => {
  if (!detector) {
    detector = new ResourceDetector();
    console.log('ResourceDetector 已初始化 (load)');
  }
});

// DOMContentLoaded 时也尝试初始化
document.addEventListener('DOMContentLoaded', () => {
  if (!detector) {
    detector = new ResourceDetector();
    console.log('ResourceDetector 已初始化 (DOMContentLoaded)');
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
    detector = new ResourceDetector();
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

async function loadConfig() {
  this.config = await chrome.storage.sync.get({
    serverUrl: 'ws://localhost:16888/jsonrpc',
    apiKey: 'GDownload_secret'
  });
} 