爬取网站图标

```bash
http://127.0.0.1:8080/getfavicon?u=https://baidu.com
```

获取随机壁纸

```bash
# 读取bigBg中的壁纸文件
http://127.0.0.1:8080/bg
# 读取smallBg中的壁纸文件
http://127.0.0.1:8080/bg?s=y
```

```bash
docker run -d -p 8080:8080 -v /home/data:/home/data --name getfavicon zxecsm/getfavicon:latest
```
