// 默认文件类型配置
export const DEFAULT_FILE_TYPES = 'mp4,mkv,avi,mov,wmv,flv,webm,' + // 视频
                                'mp3,wav,aac,ogg,flac,m4a,' +      // 音频
                                'jpg,jpeg,png,gif,bmp,webp,svg,' +  // 图片
                                'pdf,doc,docx,xls,xlsx,ppt,pptx,' + // 文档
                                'txt,md,json,xml,csv,' +            // 文本
                                'zip,rar,7z,tar,gz,xz,' +           // 压缩包
                                'exe,msi,dmg,pkg,deb,rpm';          // 安装包

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

self.DEFAULT_CONFIG = DEFAULT_CONFIG; 