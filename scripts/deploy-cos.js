// 部署 lunar-app (v2) 到用户自有腾讯云 COS 静态网站托管
// 用法（在 WorkBuddy 内执行）：
//   COS_SECRET_ID=xxx COS_SECRET_KEY=yyy COS_APPID=1234567890 \
//   [COS_BUCKET=lunar-app-v2] [COS_REGION=ap-guangzhou] \
//   node scripts/deploy-cos.js
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');

const SECRET_ID = process.env.COS_SECRET_ID;
const SECRET_KEY = process.env.COS_SECRET_KEY;
const APPID = process.env.COS_APPID;
const REGION = process.env.COS_REGION || 'ap-guangzhou';
const BASE = process.env.COS_BUCKET || 'lunar-app-v2';
// COS 桶名格式必须为 <自定义名>-<APPID>
const BUCKET = `${BASE}-${APPID}`;

if (!SECRET_ID || !SECRET_KEY || !APPID) {
  console.error('缺少环境变量：COS_SECRET_ID / COS_SECRET_KEY / COS_APPID');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..'); // ~/Desktop/lunar-app
const cos = new COS({ SecretId: SECRET_ID, SecretKey: SECRET_KEY });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// 只上传静态站必需文件；排除 .git / scripts / node_modules / *.zip
const INCLUDE_FILES = ['index.html', 'data.js', 'lunar.js', 'version.txt'];
const INCLUDE_DIRS = ['lib'];

function collect() {
  const out = [];
  for (const f of INCLUDE_FILES) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) out.push(p);
  }
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['.git', 'scripts', 'node_modules'].includes(e.name)) continue;
        if (!INCLUDE_DIRS.includes(e.name)) continue;
        walk(full);
      } else {
        out.push(full);
      }
    }
  };
  for (const d of INCLUDE_DIRS) {
    const p = path.join(ROOT, d);
    if (fs.existsSync(p)) walk(p);
  }
  return out;
}

(async () => {
  // 1. 建桶（不存在则建）
  try {
    await cos.headBucket({ Bucket: BUCKET, Region: REGION });
    console.log('· 桶已存在：', BUCKET);
  } catch (e) {
    if (e.statusCode === 404) {
      await cos.putBucket({ Bucket: BUCKET, Region: REGION });
      console.log('· 已建桶：', BUCKET);
    } else throw e;
  }

  // 2. 开静态网站托管（入口 index.html，错误页也走 index.html 以兼容 SPA 回退）
  await cos.putBucketWebsite({
    Bucket: BUCKET,
    Region: REGION,
    WebsiteConfiguration: {
      IndexDocument: { Suffix: 'index.html' },
      ErrorDocument: { Key: 'index.html' },
    },
  });
  console.log('· 已开静态网站托管');

  // 3. 设公共读
  await cos.putBucketAcl({ Bucket: BUCKET, Region: REGION, ACL: 'public-read' });
  console.log('· 已设公共读');

  // 4. 上传文件
  const files = collect();
  console.log(`· 准备上传 ${files.length} 个文件...`);
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const key = path.relative(ROOT, f).split(path.sep).join('/');
    const buf = fs.readFileSync(f);
    await cos.putObject({
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
      Body: buf,
      ContentLength: buf.length,
      ContentType: MIME[ext] || 'application/octet-stream',
      // 关键：显式设 inline，避免浏览器把 index.html 当文件下载而非渲染网页。
      // 必须用 Buffer（而非 fs.createReadStream）上传——SDK 在 stream 模式下会静默丢弃
      // ContentDisposition 等自定义响应头元数据，导致线上仍返回 attachment。
      ContentDisposition: 'inline',
    });
    console.log('  ↑', key);
  }

  console.log('\n✅ 部署完成');
  console.log('  静态网站访问域名(HTTP)：', `http://${BUCKET}.cos-website.${REGION}.myqcloud.com`);
  console.log('  源站域名(HTTPS)：       ', `https://${BUCKET}.cos.${REGION}.myqcloud.com`);
  console.log('\n  提示：默认域名无需备案即可访问；若要绑你自己的域名(如 xxx.com)，');
  console.log('  需在腾讯云「域名管理」加自定义域名 + 配 CDN，且国内节点需 ICP 备案。');
})().catch((e) => {
  console.error('❌ 部署失败：', e && e.message ? e.message : e);
  process.exit(1);
});
