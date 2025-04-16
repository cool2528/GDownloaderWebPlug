# GDownloader 下载助手浏览器插件

一个基于 Chrome Extension 的下载管理器，支持多线程下载和资源嗅探功能。

## 功能特性

- 多线程下载支持 (基于 aria2)
- 资源嗅探功能
- 浏览器下载接管
- WebSocket 实时通信
- 自动重连机制
- 支持自定义文件类型
- 国际化支持

## 使用方法

- 安装插件到Chrome 浏览器
- 需要安装Gdownloader下载助手请到[https://github.com/cool2528/GDownload](https://github.com/cool2528/GDownload) 下载


2. 启动 Gdownloader 下载助手:


3. 在 Chrome 中安装扩展:
   - 打开 Chrome 扩展管理页面 (chrome://extensions/)
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目目录

## 配置说明

1. 基本设置:
   - 最大线程数: 每个服务器的最大连接数 (1-32)
   - API 密钥: aria2 RPC 密钥
   - 服务器地址: aria2 WebSocket RPC 地址

2. 功能设置:
   - 资源嗅探: 自动检测页面中的下载资源
   - 接管下载: 接管浏览器默认下载行为
   - 文件类型: 设置需要管理的文件类型


### 快速使用

1. 创建新版本：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. 检查 GitHub Actions 标签页查看构建状态

3. 在 Releases 页面找到自动生成的扩展包


