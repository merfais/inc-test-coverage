# inc-test-coverage
计算分支间增量测试覆盖率

## 运行环境依赖

+ 系统支持 `git diff --unified=0` 命令
+ 系统支持 `grep -Po` 命令（POSIX系统支持的命令）

## 示例

```javascript
const IncCov = require('./index.js')

const codePath = path.resolve(__dirname, '.')    // 被检测代码的根目录

// 对比当前分支与master分支间的增量测试覆盖率
const incCov = new IncCov({
  workspacePath: codePath, // 代码更目录，`git fetch`, `git diff | grep`, lcov.info文件寻找都需要这个值，默认是 `process.cwd()`，进程所在路径
  lcovPath: path.resolve(codePath, 'coverage/lcov.info'), // lcov.info文件路径，如果使用相对路径，则需要相对于`codePath`, 默认是`'coverage/lcov.info'`
  lcovPrefix: '',         // 多个lcov.info同时解析，且lcov.info中SF字段使用相对路径，需要此参数为SF的路径增加前缀，多用于前后端同repo分目录管理情况，默认是 `''`
  extension: 'js',        // 文件后缀白名单，命中后缀的文件才计算，半角逗号分隔多个，默认是`'js,jsx,ts,tsx'`
  whiteList: 'src/.*',    // 文件白名单，使用正则表达式匹配，半角逗号分隔多个，默认是`'src/.*'`
  blackList: '\\.d\\.ts', // 文件黑名单，使用正则表达式匹配，半角逗号分隔多个，默认是`'\\.d\\.ts'`
  sourceBranch: '',       // 对比的源分支，默认是`''`，当前分支
  targetBranch: 'master', // 对比的目的分支，默认是`'master'`，master分支
  calcNotHit: true,       // 是否计算未被测试报告统计的源码文件，默认是`true`
  enableLog: true,        // 是否打印日志，默认是`true`, 可传函数，接管log的输出
})

incCov.run().then(coverage => {
  const coverageStr = `${(coverage * 100).toFixed(2)}%`;
  console.info('===============================================');
  console.info('总体增量覆盖率为: ', coverageStr);
  console.info('===============================================\n');
}).catch(err => {
  console.error('异常：', err)
})

```
