const express = require('express');

const os = require('os');

const app = express();

const cheerio = require('cheerio');

const { resolve } = require('path');

const sharp = require('sharp');

const { default: axios } = require('axios');

const _f = require('./f');

const dataDir = {
  favicon: '/home/data/favicon',
  bigBg: '/home/data/bigBg',
  smallBg: '/home/data/smallBg',
};
const port = 8080;
_f.c.mkdirSync(dataDir.bigBg, { recursive: true });
_f.c.mkdirSync(dataDir.smallBg, { recursive: true });
_f.c.mkdirSync(dataDir.favicon, { recursive: true });
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Credentials', true);
  if (req.method == 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.listen(port, () => {
  let arr = getLocahost().map(
    (item) => `http://${item}${port == 80 ? '' : `:${port}`}`
  );
  console.log(`服务开启成功，访问地址为：\n${arr.join('\n')}`);
});
function getLocahost() {
  let obj = os.networkInterfaces();
  let arr = [];
  Object.keys(obj).forEach((item) => {
    let value = obj[item];
    if (Object.prototype.toString.call(value).slice(8, -1) === 'Array') {
      arr = [
        ...arr,
        ...value
          .filter((item) => item.family == 'IPv4')
          .map((item) => item.address),
      ];
    }
  });
  return arr;
}
// 删除超7天的缓存
setInterval(async () => {
  try {
    if (!_f.c.existsSync(dataDir.favicon)) return;
    const now = Date.now();
    (await _f.p.readdir(dataDir.favicon)).forEach(async (item) => {
      const f = `${dataDir.favicon}/${item}`;
      const s = await _f.p.stat(f);
      if (now - s.ctime.getTime() > 7 * 24 * 60 * 60 * 1000) {
        _f.del(f);
      }
    });
  } catch (error) {}
}, 12 * 60 * 60 * 1000);
async function downFile(url, path) {
  try {
    const res = await axios({
      method: 'get',
      url,
      responseType: 'arraybuffer',
      timeout: 5000,
      maxContentLength: 1024 * 200,
      maxBodyLength: 1024 * 200,
    });
    await _f.p.writeFile(path, res.data);
  } catch (error) {
    throw error;
  }
}
app.get('/getfavicon', async (req, res) => {
  let p = '';
  try {
    const u = new URL(req.query.u);
    const eu = encodeURIComponent(u.host);
    const p = decodeURI(`${dataDir.favicon}/${eu}.png`);
    if (_f.c.existsSync(p)) {
      res.sendFile(p);
      return;
    }
    const prefix = `${u.protocol}//${u.host}`;
    await _f.mkdir(dataDir.favicon);
    const result = await axios({
      method: 'get',
      url: prefix,
      timeout: 5000,
    });
    const contentType = result.headers['content-type'];
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error(`只允许获取HTML文件`);
    }
    const $ = cheerio.load(result.data);
    const arr = $('link');
    let icon = null;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i],
        { rel, href } = item.attribs;
      if (item.name === 'link' && href && rel && rel.includes('icon')) {
        icon = item;
        break;
      }
    }
    let iconUrl = `${prefix}/favicon.ico`;
    if (icon) {
      const href = icon.attribs.href;
      if (!/^data\:image/i.test(href)) {
        if (/^http/i.test(href)) {
          iconUrl = href;
        } else if (/^\/\//.test(href)) {
          // '//aa.com/img/xxx.png
          iconUrl = u.protocol + href;
        } else if (/^\//.test(href)) {
          // '/img/xxx.png'
          iconUrl = prefix + href;
        } else if (/^\./.test(href)) {
          // './img/xxx.png'
          iconUrl = prefix + href.slice(1);
        } else {
          // 'img/xxx.png'
          iconUrl = prefix + '/' + href;
        }
      }
    }
    await downFile(iconUrl, p);
    if (_f.c.existsSync(p)) {
      try {
        const buf = await compressionImg(p);
        await _f.p.writeFile(p, buf);
      } catch (error) {}
      res.sendFile(p);
    } else {
      throw new Error();
    }
  } catch (error) {
    const dPath = resolve(__dirname, 'mrlogo.png');
    if (p) {
      try {
        await _f.cp(dPath, p);
      } catch (error) {}
    }
    res.sendFile(dPath);
  }
});
async function compressionImg(path, x = 400, y = 400, quality) {
  try {
    const inputBuf = await _f.p.readFile(path);
    const img = sharp(inputBuf);
    const meta = await img.metadata();
    const buf = await img
      .resize(x, y, { fit: 'inside' }) // 保持比例
      .png(
        ['gif', 'raw', 'tile'].includes(meta.format) || !quality
          ? {}
          : { quality }
      )
      .toBuffer();
    return buf;
  } catch (error) {
    throw error;
  }
}
async function getAllFile(path) {
  try {
    const arr = [];
    async function getFile(path) {
      try {
        const s = await _f.p.stat(path);
        if (s.isDirectory()) {
          const list = await _f.p.readdir(path);
          for (let i = 0; i < list.length; i++) {
            await getFile(`${path}/${list[i]}`);
          }
        } else {
          arr.push(path);
        }
      } catch (error) {}
    }
    await getFile(path);
    return arr;
  } catch (error) {
    return [];
  }
}
function randomNum(x, y) {
  return Math.round(Math.random() * (y - x) + x);
}
app.get('/bg', async (req, res) => {
  const { s } = req.query;
  let list = [];
  if (s) {
    list = await getAllFile(dataDir.smallBg);
  } else {
    list = await getAllFile(dataDir.bigBg);
  }
  if (list.length > 0) {
    const idx = randomNum(0, list.length - 1);
    res.sendFile(list[idx]);
  } else {
    res.send('壁纸库为空');
  }
});
