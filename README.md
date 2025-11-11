## NCM Convertor
部分代码和原理~~照搬~~借鉴自：[NCM2MP3](https://github.com/charlotte-xiao/NCM2MP3)

一个把网易云ncm文件解密为mp3、flac的npm包
> **只能在node环境中使用，浏览器中无效**

### 安装
```shell
npm i install @lengineerc/ncm-convertor
```

### 使用
```ts
import { NcmConvertor } from '@lengineerc/ncm-convertor'; // ESM
const { NcmConvertor } = require('@lengineerc/ncm-convertor'); //CJS

const convertor = new NcmConvertor(ncmPath, outputPath);
convertor.dump();
```
极简api设计，只需调用`NcmConvertor.dump`方法即可自动处理转换

`NcmConvertor`构造函数传入两个参数:
- `ncmPath`: 待解密的ncm文件路径
- `outputPath`: 文件输出路径

### **注意事项：**
- `.flac`格式的音频元信息会丢失（没找到比较好的flac metadata写入方式，~~懒得做跨语言调用~~），作为替代方案，会把图片和音频输出到同一目录下。`.mp3`不受影响