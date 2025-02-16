class ResourceDetector {
  constructor() {
    console.log('ResourceDetector 构造函数被调用');
    this.resources = new Set();
    this.config = null;
    
    // 立即加载配置
    (async () => {
      await this.loadConfig();
      console.log('ResourceDetector 配置加载完成:', this.config);
      
      // 配置加载完成后，检查当前页面
      if (document.body) {
        this.checkElementForResources(document.body);
      }
    })();
  }

  async loadConfig() {
    try {
      const config = await chrome.storage.sync.get({
        fileTypes: 'mp4,mp3,zip,rar,exe,pdf',  // 默认值
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
      // 确保 config 和 fileTypes 存在
      const fileTypes = (this.config?.fileTypes || '').split(',')
        .map(type => type.trim().toLowerCase());
      
      // 1. 检查文件扩展名
      const hasValidExtension = fileTypes.some(type => 
        url.toLowerCase().endsWith(`.${type}`)
      );
      
      if (!hasValidExtension) {
        return false;
      }
      
      // 2. 检查 URL 合法性
      const urlObj = new URL(url);
      
      // 3. 排除特定类型的链接
      const excludeKeywords = [
        'about', 'policy', 'contact', 'help', 'support',
        'login', 'signin', 'signup', 'register'
      ];
      
      if (excludeKeywords.some(keyword => 
        urlObj.pathname.toLowerCase().includes(keyword)
      )) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('验证资源失败:', error);
      return false;
    }
  }

  addResource(url) {
    try {
      if (!url || typeof url !== 'string') {
        console.warn('无效的URL:', url);
        return;
      }

      if (this.isValidResource(url)) {
        this.resources.add(url);
        this.createDownloadButton(url);
      }
    } catch (error) {
      console.error('添加资源失败:', error);
    }
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
      
      return fileTypes.some(type => 
        url.toLowerCase().endsWith(`.${type}`)
      );
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

  createDownloadButton(url) {
    try {
      console.log('检查URL是否匹配:', url);
      
      // 检查是否启用了嗅探
      if (!this.config?.enableSniffing) {
        console.log('资源嗅探已禁用');
        return;
      }

      // 检查是否匹配文件类型
      if (!this.isMatchingFileType(url)) {
        console.log('URL不匹配配置的文件类型');
        return;
      }

      console.log('创建下载按钮容器:', url);
      
      // 创建一个浮动容器
      const floatingButton = document.createElement('div');
      floatingButton.className = 'gdownloader-floating-button';
      floatingButton.style.cssText = `
        position: absolute;
        display: none;
        background: #2196F3;  /* 改为蓝色 */
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: opacity 0.3s;
      `;
      
      floatingButton.innerHTML = `
        <img src="${chrome.runtime.getURL('icons/icon16.png')}" 
             style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;">
        <span>使用GDownloader下载</span>
      `;
      
      floatingButton.onclick = async (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          console.log('准备发送下载请求...');
          
          // 获取完整的资源信息
          const resourceInfo = await this.getResourceInfo(url);
          console.log('获取到资源信息:', resourceInfo);
          
          if (!resourceInfo || !resourceInfo.url) {
            throw new Error('无效的资源信息');
          }
          
          // 发送下载请求
          const message = {
            type: 'DOWNLOAD_RESOURCE',
            resource: resourceInfo
          };
          
          console.log('发送消息:', message);
          chrome.runtime.sendMessage(message, (response) => {
            console.log('收到响应:', response);
            if (response?.success) {
              console.log('下载请求已发送');
            } else {
              console.error('下载请求失败:', response?.error);
            }
          });
        } catch (error) {
          console.error('处理下载请求失败:', error);
        }
      };

      // 添加到body
      document.body.appendChild(floatingButton);

      // 使用新的查找方法
      const elements = this.findMatchingElements(url);

      elements.forEach(element => {
        // 鼠标进入时显示按钮
        element.addEventListener('mouseenter', (e) => {
          const rect = element.getBoundingClientRect();
          floatingButton.style.top = `${window.scrollY + rect.bottom + 5}px`;
          floatingButton.style.left = `${window.scrollX + rect.left}px`;
          floatingButton.style.display = 'flex';
          floatingButton.style.alignItems = 'center';
        });

        // 鼠标离开时隐藏按钮
        element.addEventListener('mouseleave', (e) => {
          // 添加一个小延迟，允许用户移动到按钮上
          setTimeout(() => {
            if (!floatingButton.matches(':hover')) {
              floatingButton.style.display = 'none';
            }
          }, 100);
        });

        // 按钮本身的鼠标离开事件
        floatingButton.addEventListener('mouseleave', () => {
          floatingButton.style.display = 'none';
        });
      });
    } catch (error) {
      console.error('创建下载按钮失败:', error);
    }
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
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
      // 检查 a 标签
      element.querySelectorAll('a').forEach(link => {
        if (link.href) {
          console.log('检查链接:', link.href);
          this.addResource(link.href);
        }
      });

      // 检查 video 和 source 标签
      element.querySelectorAll('video, source').forEach(media => {
        if (media.src) {
          console.log('检查媒体:', media.src);
          this.addResource(media.src);
        }
      });
    } catch (error) {
      console.error('检查元素资源失败:', error);
    }
  }
}

// 创建全局实例
window.ResourceDetector = ResourceDetector;
console.log('ResourceDetector 已定义到全局'); 