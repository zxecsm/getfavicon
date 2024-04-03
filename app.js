const express = require('express');

const os = require('os');

const fs = require('fs');

const app = express();

const cheerio = require('cheerio');

const { resolve } = require('path');

const sharp = require('sharp');

const { default: axios } = require('axios');

const dataDir = '/home/favicon';
const port = 8080;

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
function base64ToBuffer(data) {
  const base64 = data.replace(/^data:image\/\w+;base64,/, ''); //去掉图片base64码前面部分data:image/png;base64
  return Buffer.from(base64, 'base64'); //把base64码转成buffer对象，
}
async function downFile(url, path) {
  const res = await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
    timeout: 5000,
  });
  fs.writeFileSync(path, res.data);
  return Promise.resolve();
}
app.get('/getfavicon', async (req, res) => {
  try {
    const u = new URL(req.query.u);
    const eu = encodeURIComponent(u.host);
    const p = decodeURI(`${dataDir}/${eu}.png`);
    if (fs.existsSync(p)) {
      res.sendFile(p);
      return;
    }
    fs.mkdirSync(dataDir, { recursive: true });
    let result = await axios({
      method: 'get',
      url: `${u.protocol}//${u.host}`,
      timeout: 5000,
    });
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
    if (!icon) {
      await downFile(`${u.protocol}//${u.host}/favicon.ico`, p);
    } else {
      let iconUrl = icon.attribs.href;
      if (/^data\:image/i.test(iconUrl)) {
        const buf = base64ToBuffer(iconUrl);
        fs.writeFileSync(p, buf);
      } else {
        if (iconUrl.startsWith('//')) {
          // '//aa.com/img/xxx.png
          iconUrl = u.protocol + iconUrl;
        } else if (!iconUrl.startsWith('http')) {
          let str = `${u.protocol}//${u.host}`;
          if (iconUrl.startsWith('/')) {
            // '/img/xxx.png'
            iconUrl = str + iconUrl;
          } else if (iconUrl.startsWith('.')) {
            // './img/xxx.png'
            iconUrl = str + iconUrl.slice(1);
          } else {
            // 'img/xxx.png'
            iconUrl = str + '/' + iconUrl;
          }
        }
        await downFile(iconUrl, p);
      }
    }
    if (fs.existsSync(p)) {
      try {
        const buf = await compressionImg(p);
        fs.writeFileSync(p, buf);
      } catch (error) {}
      res.sendFile(p);
    } else {
      throw new Error();
    }
    res.sendFile(p);
  } catch (error) {
    res.sendFile(resolve(__dirname, 'mrlogo.png'));
  }
});
async function compressionImg(path, x = 400, y = 400, quality) {
  try {
    const inputBuf = fs.readFileSync(path);
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
    return Promise.resolve(buf);
  } catch (error) {
    return Promise.reject(error);
  }
}
