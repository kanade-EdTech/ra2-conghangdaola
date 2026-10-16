(function (global) {
  'use strict';
  global.RA2.platform = {
    name: 'toy',
    saveImage: function (data, filename) {
      var link = document.createElement('a');
      if (!('download' in link)) return Promise.resolve('当前环境请使用系统截图保存预览');
      link.href = data; link.download = filename; link.style.display = 'none';
      document.body.appendChild(link); link.click(); link.remove();
      return Promise.resolve('已发起图片下载；若 App 未响应，可使用系统截图');
    },
    hint: '保存可尝试下载图片；App 内未响应时，可用系统截图。'
  };
})(window);
