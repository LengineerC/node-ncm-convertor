## NCM Convertor
部分代码和原理~~照搬~~借鉴自：[NCM2MP3](https://github.com/charlotte-xiao/NCM2MP3)

一个把网易云ncm文件解密为mp3、flac的npm包
> **只能在node环境中使用，浏览器中无效**

### 安装（暂未上传至npm）
```shell
npm install @lengineerc/ncm-convertor
```

### 使用
```ts
import NcmConvertor from '@lengineerc/ncm-convertor';

const convertor = new NcmConvertor(ncmFilePath, outputPath);
convertor.dump();
```
极简api设计，只需调用`dump()`方法即可自动处理转换

### **注意事项：**
`.flac`格式的音频元信息会丢失（没找到比较好的flac metadata写入方式，~~懒得做跨语言调用~~），`.mp3`不受影响