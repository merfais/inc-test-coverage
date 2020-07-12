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
  workspacePath: codePath,
  lcovPath: path.resolve(codePath, 'coverage/lcov.info'),
  lcovPrefix: '',
  extension: 'js',
  whiteList: 'src/.*',
  blackList: '\\.d\\.ts',
  sourceBranch: '',
  targetBranch: 'master',
  calcNotHit: true,
  enableLog: true,
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
