(function (global) {
  'use strict';
  global.RA2.platform = {
    name: 'xhs',
    saveImage: async function (data) {
      var bridge = global.xhs && global.xhs.miniTool;
      if (!bridge || typeof bridge.writeTempFile !== 'function' || typeof bridge.saveImageToPhotosAlbum !== 'function') {
        return '当前环境没有相册入口，请使用系统截图保存预览';
      }
      var result = await bridge.writeTempFile({ data: data });
      if (!result || !result.filePath) throw new Error('未取得图片临时文件，请重试');
      await bridge.saveImageToPhotosAlbum({ filePath: result.filePath });
      return '图片已保存到相册';
    },
    hint: '点击保存图片存入相册；若权限被拒，预览仍会保留。'
  };
})(window);
