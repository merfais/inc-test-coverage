/* eslint-disable  no-param-reassign, arrow-body-style, newline-per-chained-call */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

module.exports = class IncCov {
  constructor(params) {
    params = params || {};
    this.workspacePath = params.workspacePath || process.cwd();
    this.lcovPath = params.lcovPath || 'coverage/lcov.info';
    this.lcovPrefix = params.lcovPrefix || '';
    this.extension = params.extension || 'js,ts,jsx,tsx';
    this.whiteList = params.whiteList || 'src/.*';
    this.blackList = params.blackList || '\\.d\\.ts';
    this.sourceBranch = params.sourceBranch || '';
    this.targetBranch = params.targetBranch || 'master';
    this.calcNotHit = params.calcNotHit;
    if (this.calcNotHit === 'true') {
      this.calcNotHit = true;
    } else if (this.calcNotHit === 'false') {
      this.calcNotHit = false;
    } else if (this.calcNotHit === undefined) {
      this.calcNotHit = true;
    }
    this.enableLog = params.enableLog;
    if (this.enableLog === undefined) {
      this.enableLog = true;
    }
  }

  exec(command, options) {
    return new Promise((resolve, reject) => {
      if (!options || !options.cwd) {
        options = {
          cwd: this.workspacePath,
        };
      }
      cp.exec(command, options, (error, stdout, stderr) => {
        if (error || stderr) {
          reject(error || stderr);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  readFile(...args) {
    return new Promise((resolve, reject) => {
      this.log(`readFile: ${args[0]}`);
      fs.readFile(...args, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    });
  }

  log(...args) {
    if (this.enableLog) {
      if (typeof this.enableLog === 'function') {
        this.enableLog.apply(this.enableLog, args);
      } else {
        console.info(...args);
      }
    }
  }

  split(str, trim = true) {
    const splitReg = /,|，/;
    return str.split(splitReg).reduce((acc, s) => {
      if (trim) {
        s = s.trim();
      }
      if (s) {
        acc.push(s);
      }
      return acc;
    }, []);
  }

  getDiff(sourceBranch, targetBranch) {
    const script = 'git diff'
      + ` ${targetBranch}`
      + ` ${sourceBranch}`
      + ' --unified=0'
      + ' | grep -Po \'^\\+\\+\\+ ./\\K.*|^@@ -[0-9]+(,[0-9]+)? \\+\\K[0-9]+(,[0-9]+)?(?= @@)\''
      + ' || true';
    return this.exec('git fetch --prune').then((data) => {
      this.log(data);
      this.log(script);
      return this.exec(script);
    }).then((data) => {
      if (!data) {
        return '';
      }
      data = data.split('\n');
      this.log(data);
      return data;
    }).catch((err) => {
      console.error('git diff 出错: ', err);
      return '';
    });
  }

  genReg(list = []) {
    if (list.length === 1) {
      return new RegExp(list[0]);
    }
    const str = list.map(str => `(${str})`).join('|');
    return new RegExp(str);
  }

  genExtReg(extension = '') {
    extension = this.split(extension).map(ext => `\\.${ext}$`);
    const reg = this.genReg(extension);
    this.log('扩展名正则：', reg);
    return reg;
  }

  genWhiteReg(whiteList = '') {
    whiteList = this.split(whiteList);
    const reg = this.genReg(whiteList);
    this.log('白名单正则：', reg);
    return reg;
  }

  genBlackReg(blackList = '') {
    blackList = this.split(blackList);
    const reg = this.genReg(blackList);
    this.log('黑名单正则：', reg);
    return reg;
  }

  calcRowNumber(str) {
    let [start, len] = str.split(',');
    if (len === undefined) {
      len = 1;
    }
    start = Number(start);
    len = Number(len);
    if (len === 0) {
      return [];
    }
    const row = [start];
    let i = 1;
    while (i < len) {
      row.push(start + i);
      i += 1;
    }
    return row;
  }

  getModifyRow({
    extension,
    blackList,
    whiteList,
    sourceBranch,
    targetBranch,
  }) {
    const extReg = this.genExtReg(extension);
    const whiteReg = this.genWhiteReg(whiteList);
    const blackReg = this.genBlackReg(blackList);
    this.log();
    return this.getDiff(sourceBranch, targetBranch).then((list) => {
      if (!list) {
        this.log(`sourceBranch【${sourceBranch}】与targetBranch【${targetBranch}】之间未发生变化\n`);
        return {};
      }
      let currentFile = '';
      const map = list.reduce((acc, str) => {
        const last = acc[currentFile];
        if (/^[0-9, ]+$/.test(str)      // 命中数字
          && last                       // 最后一个有值
        ) {   // 增加或修改的行号，行数
          const rowNunbers = this.calcRowNumber(str);
          if (rowNunbers.length) {
            last.push(...rowNunbers);
          }
        } else {  // 文件路径
          currentFile = str;
          if (extReg.test(str)
            && whiteReg.test(str)
            && !blackReg.test(str)
          ) {
            acc[str] = [];
          }
        }
        return acc;
      }, {});
      this.log('------------------ 修改或新增的行 -----------------\n');
      Object.keys(map).forEach((key) => {
        this.log(`${key}: ${map[key].join()}`);
      });
      this.log();
      return map;
    });
  }

  getNotCoverRow(lcovPath, lcovPrefix) {
    const prefixArr = this.split(lcovPrefix);
    return Promise.all(this.split(lcovPath).map((filePath, index) => {
      if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(this.workspacePath, filePath);
      }
      return this.readFile(filePath, 'utf8').then((data) => {
        const dataArr = data.split('\n');
        const prefix = prefixArr[index] || '';
        return { dataArr, filePath, prefix };
      });
    })).then((lcovDataList) => {
      return lcovDataList.reduce(({ map, list }, { dataArr, filePath, prefix }) => {
        this.log(`cat ${filePath}`);
        this.log(dataArr);
        let currentFile = '';
        const tmpMap = dataArr.reduce((acc, str) => {
          const last = acc[currentFile];
          if (/^SF:/.test(str)) {         // 文件路径
            currentFile = path.join(prefix, str.slice(3));
            if (map[currentFile]) {
              const msg = `【${currentFile}】已经在其他lcov.info文件中被统计过，`
                + `在【${filePath}】中再次被检出，请检查相关配置`;
              console.error(msg);
              console.error('如果引入了多个lcov.info的解析，'
                + '请检查多个lcov.info文件中是否有重复文件名(SF字段)，'
                + '是否配置了lcovPrefix进行路径区分。');
              throw new Error(msg);
            }
            acc[currentFile] = new Set();
          } else if (/^DA:[0-9, ]+$/.test(str)   // 命中DA字段
            && last                       // 最后一个有值
          ) {
            let [row, count] = str.slice(3).split(',');
            row = Number(row);             // 行号
            count = Number(count);         // 执行次数
            if (!count) {
              last.add(row);
            }
          }
          return acc;
        }, {});
        const tmpList = Object.keys(tmpMap);
        this.log('-------------------- 未覆盖的行 ---------------------\n');
        tmpList.forEach((key) => {
          this.log(`${key}: ${[...tmpMap[key]].join()}`);
        });
        this.log();
        Object.assign(map, tmpMap);
        list = list.concat(tmpList);
        return { map, list };
      }, { map: {}, list: [] });
    });
  }

  calcCoverage(changedFiles, notCoverFile, calcNotHit) {
    this.log('==================== 覆盖率计算 ==========================\n');
    let rowCount = 0;
    let notCoverCount = 0;
    Object.keys(changedFiles).forEach((file) => {
      const rows = changedFiles[file];
      const len = rows.length;
      const hitRow = [];
      if (len) {
        const fpath = notCoverFile.list.find(str => (str.indexOf(file) !== -1));
        if (fpath) {
          const set = notCoverFile.map[fpath];
          rows.forEach((num) => {
            if (set.has(num)) {   // 未覆盖
              hitRow.push(num);
            }
          });
          this.log(`${file}: 被测试覆盖，此次代码修改增量覆盖数据为：`);
          this.log(`修改或新增的行，  共计 ${len} 行，分别是：`, rows.join());
          this.log(`未被测试覆盖的行，共计 ${hitRow.length} 行，分别是：`, hitRow.join());
        } else {
          this.log(`${file}: 未被测试覆盖`);
          if (calcNotHit !== 'false') {
            hitRow.push(...rows);
            this.log(`修改或新增的行，  共计 ${len} 行，分别是：`, rows.join());
            this.log('未被测试覆盖的文件【需要】计算到统计结果中');
          } else {
            this.log('未被测试覆盖的文件【不需要】计算到统计结果中');
          }
        }
        const coverage = 1 - (hitRow.length / len);
        this.log('单文件覆盖率:', `${(coverage * 100).toFixed(2)}%\n`);
        rowCount += len;
        notCoverCount += hitRow.length;
      }
    });
    if (!rowCount) {
      return 1;
    }
    return 1 - (notCoverCount / rowCount);
  }

  run() {
    this.log('===============================================');
    this.log(`workspacePath: ${this.workspacePath}`);
    this.log(`lcovPath: ${this.lcovPath}`);
    this.log(`lcovPrefix: ${this.lcovPrefix}`);
    this.log(`extension: ${this.extension}`);
    this.log(`whiteList: ${this.whiteList}`);
    this.log(`blackList: ${this.blackList}`);
    this.log(`sourceBranch: ${this.sourceBranch}`);
    this.log(`targetBranch: ${this.targetBranch}`);
    this.log(`calcNotHit: ${this.calcNotHit}`);
    this.log('===============================================\n');
    return Promise.all([
      this.getModifyRow({
        extension: this.extension,
        whiteList: this.whiteList,
        blackList: this.blackList,
        sourceBranch: this.sourceBranch,
        targetBranch: this.targetBranch,
      }),
      this.getNotCoverRow(this.lcovPath, this.lcovPrefix),
    ]).then(([changedFiles, notCoverFile]) => {
      return this.calcCoverage(changedFiles, notCoverFile, this.calcNotHit);
    });
  }
};
