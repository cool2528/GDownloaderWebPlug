class ResourceDetector {
  constructor(config) {
    this.resources = new Set();
    this.config = config;
    this.downloadButtons = new Map(); // 存储已创建的下载按钮
    this.hideTimeouts = new Map(); // 存储每个按钮的超时计时器
    console.log('ResourceDetector 初始化，配置:', config);
    
    // 立即加载配置
    (async () => {
      await this.loadConfig();
      console.log('ResourceDetector 配置加载完成:', this.config);
      
      // 配置加载完成后，检查当前页面
      if (document.body) {
        this.checkElementForResources(document.body);
      }

      // 添加 MutationObserver 监听 DOM 变化
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // ELEMENT_NODE
              this.checkElementForResources(node);
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    })();
  }

  async loadConfig() {
    try {
      // 使用与 options.js 相同的默认配置
      const DEFAULT_FILE_TYPES = 'mp4,mkv,avi,mov,wmv,flv,webm,' + // 视频
                                'mp3,wav,aac,ogg,flac,m4a,' +      // 音频
                                'jpg,jpeg,png,gif,bmp,webp,svg,' +  // 图片
                                'pdf,doc,docx,xls,xlsx,ppt,pptx,' + // 文档
                                'txt,md,json,xml,csv,' +            // 文本
                                'zip,rar,7z,tar,gz,xz,' +           // 压缩包
                                'exe,msi,dmg,pkg,deb,rpm';          // 安装包

      const config = await chrome.storage.sync.get({
        fileTypes: DEFAULT_FILE_TYPES,  // 使用完整的默认值
        enableSniffing: true
      });
      
      this.config = config;
      console.log('已加载资源检测配置:', config);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  isValidResource(url) {
    if (!url) return false;
    
    try {
      const fileTypes = (this.config?.fileTypes || '').split(',')
        .map(type => type.trim().toLowerCase());
      
      // 添加调试日志
      console.log('检查URL:', url);
      console.log('支持的文件类型:', fileTypes);
      
      // 修改检测逻辑，支持更多URL格式
      const hasValidExtension = fileTypes.some(type => {
        // 1. 检查标准文件扩展名
        if (url.toLowerCase().endsWith(`.${type}`)) return true;
        
        // 2. 检查URL参数中的文件类型
        if (url.toLowerCase().includes(`/images/`) && url.toLowerCase().includes(`.${type}`)) return true;
        
        // 3. 检查特定的资源URL模式
        if (url.toLowerCase().includes(`image`) || url.toLowerCase().includes(`photo`)) return true;
        
        return false;
      });
      
      console.log('URL匹配结果:', hasValidExtension);
      return hasValidExtension;
    } catch (error) {
      console.error('验证资源失败:', error);
      return false;
    }
  }

  addResource(url, sourceElement) {
    // 转换为绝对路径
    const absoluteUrl = this.getAbsoluteUrl(url);
    
    // 先检查是否已经添加过这个资源
    if (this.resources.has(absoluteUrl)) {
      return;
    }

    // 检查是否是有效的资源类型
    if (this.isValidResource(absoluteUrl)) {
      this.resources.add(absoluteUrl);
      console.log('添加资源:', absoluteUrl);
      
      // 为资源元素添加鼠标事件监听
      if (sourceElement) {
        this.setupHoverEvents(absoluteUrl, sourceElement);
      }
      
      // 通知 background script
      chrome.runtime.sendMessage({
        type: 'NEW_RESOURCE',
        url: absoluteUrl
      });
    } else {
      console.log('资源类型不匹配，跳过:', absoluteUrl);
    }
  }

  setupHoverEvents(url, sourceElement) {
    let button = null;

    const showButton = () => {
      // 清除之前的隐藏计时器
      if (this.hideTimeouts.has(url)) {
        clearTimeout(this.hideTimeouts.get(url));
        this.hideTimeouts.delete(url);
      }

      if (!button) {
        button = this.createDownloadButton(url);
      }

      // 确保元素存在且是 DOM 元素
      if (sourceElement && sourceElement instanceof Element) {
        const rect = sourceElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        button.style.top = `${rect.top + scrollTop}px`;
        button.style.left = `${rect.right + scrollLeft + 5}px`;
        button.style.display = 'block';
      }
    };

    const hideButton = (event) => {
      if (button && button instanceof Element) {
        const timeout = setTimeout(() => {
          // 确保按钮元素存在
          if (button && button.getBoundingClientRect) {
            const buttonRect = button.getBoundingClientRect();
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            
            if (!(mouseX >= buttonRect.left && 
                  mouseX <= buttonRect.right && 
                  mouseY >= buttonRect.top && 
                  mouseY <= buttonRect.bottom)) {
              button.style.display = 'none';
            }
          }
        }, 300);
        
        this.hideTimeouts.set(url, timeout);
      }
    };

    // 确保元素存在再添加事件监听
    if (sourceElement && sourceElement instanceof Element) {
      sourceElement.addEventListener('mouseenter', showButton);
      sourceElement.addEventListener('mouseleave', (e) => hideButton(e));
    }

    return this.createDownloadButton(url);
  }

  createDownloadButton(url) {
    const button = document.createElement('button');
    button.className = 'gdownloader-btn';
    button.innerHTML = '⬇️ 下载';
    button.title = '使用 GDownloader 下载';

    // 按钮鼠标事件
    button.addEventListener('mouseenter', () => {
      if (this.hideTimeouts.has(url)) {
        clearTimeout(this.hideTimeouts.get(url));
        this.hideTimeouts.delete(url);
      }
      button.style.opacity = '1';
    });

    button.addEventListener('mouseleave', (e) => {
      button.style.opacity = '0.9';
      button.style.display = 'none';
    });

    // 点击事件
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        // 获取资源信息
        const resourceInfo = {
          url: url,
          filename: url.split('/').pop() || '',
          referrer: document.referrer || document.location.href,
          pageUrl: window.location.href
        };
        
        // 发送下载请求
        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_RESOURCE',
          resource: resourceInfo
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('发送下载请求失败:', chrome.runtime.lastError);
            this.showError('下载请求失败，请重试');
          } else if (response && response.success) {
            this.showSuccess('已添加到下载队列');
          } else {
            this.showError(response?.error || '下载失败，请重试');
          }
        });
      } catch (error) {
        console.error('处理下载请求失败:', error);
        this.showError('处理下载请求失败，请重试');
      }
      
      button.style.display = 'none';
    });

    document.body.appendChild(button);
    button.style.display = 'none';
    return button;
  }

  async getResourceInfo(url) {
    try {
      // 构造并返回资源信息对象
      return {
        url: url,
        filename: url.split('/').pop() || '',
        referrer: document.referrer || document.location.href,
        pageUrl: window.location.href
      };
    } catch (error) {
      console.error('获取资源信息失败:', error);
      // 即使出错也返回基本的资源信息
      return {
        url: url,
        filename: url.split('/').pop() || '',
        referrer: document.referrer || ''
      };
    }
  }

  isMatchingFileType(url) {
    if (!url || !this.config?.fileTypes) return false;
    
    try {
      const fileTypes = this.config.fileTypes.split(',')
        .map(type => type.trim().toLowerCase());
      
      // 添加调试日志
      console.log('检查URL:', url);
      console.log('支持的文件类型:', fileTypes);
      
      const match = fileTypes.some(type => 
        url.toLowerCase().endsWith(`.${type}`)
      );
      
      console.log('匹配结果:', match);
      return match;
    } catch (error) {
      console.error('检查文件类型失败:', error);
      return false;
    }
  }

  getResourceSelector() {
    if (!this.config || !this.config.fileTypes) return '';
    
    const fileExtensions = this.config.fileTypes.split(',')
      .map(ext => ext.trim())
      .filter(ext => ext)
      .map(ext => `a[href$=".${ext}"]`);
    
    return fileExtensions.join(', ');
  }

  findMatchingElements(url) {
    const selector = this.getResourceSelector();
    if (!selector) return [];

    return Array.from(document.querySelectorAll(selector))
      .filter(el => {
        const href = el.href.toLowerCase();
        // 排除包含特定关键词的链接
        const excludeKeywords = ['about', 'policy', 'contact', 'help', 'support'];
        return !excludeKeywords.some(keyword => href.includes(keyword));
      })
      .filter(el => el.href === url);
  }

  showError(message) {
    console.error(message);
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    console.log(message);
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `gdownloader-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // 添加检查元素资源的方法
  checkElementForResources(element) {
    try {
      // 根据 fileTypes 配置构建选择器
      const fileTypes = (this.config?.fileTypes || '').split(',')
        .map(type => type.trim())
        .filter(type => type);
      
      // 构建完整的选择器字符串
      const selectors = [
        // 图片资源
        'img[src], img[data-src], img[data-original], img[data-original-src]',
        'img[data-lazy-src], img[data-url], img[data-thumb]',
        'picture source[srcset]',
        
        // 视频资源
        'video[src], video source[src], video[poster]',
        'iframe[src*="player"], iframe[src*="video"]',
        'div[data-video-url], div[data-video-src]',
        
        // 音频资源
        'audio[src], audio source[src]',
        
        // 基于文件类型的动态选择器
        ...fileTypes.map(type => [
          // 直接下载链接
          `a[href$=".${type}"]`,
          `a[href*=".${type}?"]`,
          `a[href*=".${type}&"]`,
          
          // 资源链接
          `[src$=".${type}"]`,
          `[src*=".${type}?"]`,
          `[data-src$=".${type}"]`,
          
          // 下载按钮和链接
          `a[download][href*=".${type}"]`,
          `[data-download-url*=".${type}"]`,
          
          // 特殊属性
          `[data-url$=".${type}"]`,
          `[data-original$=".${type}"]`
        ]).flat(),
        
        // 通用下载链接
        'a[href][download]',
        'a[href*="/download/"], a[href*="/downloads/"]',
        'a[href*="/media/"], a[href*="/resource/"]',
        
        // 应用程序资源
        'link[href][type^="application"]',
        'object[data][type^="application"]'
      ].join(', ');

      const resourceElements = element.querySelectorAll(selectors);

      resourceElements.forEach(el => {
        const urls = new Set();
        
        // 获取所有可能的资源URL
        if (el.src) urls.add(el.src);
        if (el.href) urls.add(el.href);
        if (el.srcset) {
          el.srcset.split(',').forEach(src => {
            const url = src.trim().split(' ')[0];
            if (url) urls.add(url);
          });
        }
        if (el.dataset) {
          Object.values(el.dataset).forEach(value => {
            if (typeof value === 'string' && this.isValidResource(value)) {
              urls.add(value);
            }
          });
        }

        // 处理每个URL
        urls.forEach(url => {
          if (this.shouldProcessUrl(url)) {
            this.addResource(url, el);
          }
        });
      });
    } catch (error) {
      console.error('检查元素资源失败:', error);
    }
  }

  // 添加URL过滤方法
  shouldProcessUrl(url) {
    try {
      // 排除无效URL
      if (!url || url === '#' || url.startsWith('javascript:')) {
        return false;
      }

      // 排除常见的导航链接
      const excludePatterns = [
        /\/(about|contact|help|support|login|register|signup|signin|signout|profile)\/?$/i,
        /\.(html|php|asp|jsp)$/i,
        /\?(page|id|category|tag)=/i
      ];

      if (excludePatterns.some(pattern => pattern.test(url))) {
        return false;
      }

      // 检查是否是支持的文件类型
      const fileTypes = (this.config?.fileTypes || '').split(',')
        .map(type => type.trim().toLowerCase());
      
      return fileTypes.some(type => url.toLowerCase().endsWith(`.${type}`));

    } catch (error) {
      console.error('URL检查失败:', error);
      return false;
    }
  }

  // 添加一个处理 URL 的辅助方法
  getAbsoluteUrl(url) {
    try {
      // 如果已经是完整的 URL,直接返回
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // 如果是以 // 开头的协议相对 URL
      if (url.startsWith('//')) {
        return window.location.protocol + url;
      }
      
      // 如果是以 / 开头的绝对路径
      if (url.startsWith('/')) {
        return window.location.origin + url;
      }
      
      // 处理相对路径
      const base = window.location.href;
      return new URL(url, base).href;
    } catch (error) {
      console.warn('URL 处理失败:', error);
      return url;
    }
  }
}

// 确保类在全局范围内可用
window.ResourceDetector = ResourceDetector;
console.log('ResourceDetector 已定义到全局'); 