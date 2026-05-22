/**
 * Build scripts/locale-seeds/zh-TW.json from zh-CN.json (Simplified → Traditional, Taiwan).
 * Run: node scripts/generate-zh-tw.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenCC from 'opencc-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedsDir = join(__dirname, 'locale-seeds');
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });

/** Taiwan vocabulary (longest phrases first). */
const TW_PHRASES = [
    ['武器数据库', '武器資料庫'],
    ['武器數據庫', '武器資料庫'],
    ['服务器错误', '伺服器錯誤'],
    ['服務器錯誤', '伺服器錯誤'],
    ['服务器超时', '伺服器逾時'],
    ['服務器超時', '伺服器逾時'],
    ['服务器', '伺服器'],
    ['服務器', '伺服器'],
    ['数据库', '資料庫'],
    ['數據庫', '資料庫'],
    ['用户数据', '使用者資料'],
    ['用戶數據', '使用者資料'],
    ['用户', '使用者'],
    ['用戶', '使用者'],
    ['加载', '載入'],
    ['加載', '載入'],
    ['数据', '資料'],
    ['數據', '資料'],
    ['搜索', '搜尋'],
    ['设置', '設定'],
    ['設置', '設定'],
    ['窗口', '視窗'],
    ['订阅', '訂閱'],
    ['软件', '軟體'],
    ['网络', '網路'],
    ['信息', '資訊'],
    ['默认', '預設'],
    ['程序', '程式'],
    ['视频', '影片'],
    ['鼠标', '滑鼠'],
    ['账号', '帳號'],
    ['账户', '帳戶'],
    ['下载', '下載'],
    ['文件夹', '資料夾'],
    ['文件', '檔案'],
    ['日志', '日誌'],
    ['应用程序', '應用程式'],
    ['应用', '應用程式'],
    ['應用教程', '應用程式教學'],
    ['应用教程', '應用程式教學'],
    ['本应用', '本應用程式'],
    ['本應用', '本應用程式'],
    ['教程', '教學'],
    ['刷新', '重新整理'],
    ['获取', '取得'],
    ['獲取', '取得'],
    ['网络', '網路'],
    ['網絡', '網路'],
    ['运行', '執行'],
    ['運行', '執行'],
    ['了解', '瞭解'],
    ['加入服务器', '加入伺服器'],
    ['加入服務器', '加入伺服器'],
];

let zhTw = converter(readFileSync(join(seedsDir, 'zh-CN.json'), 'utf8'));
for (const [from, to] of TW_PHRASES) {
    zhTw = zhTw.split(from).join(to);
}
writeFileSync(join(seedsDir, 'zh-TW.json'), zhTw);
console.log('Wrote locale-seeds/zh-TW.json');
