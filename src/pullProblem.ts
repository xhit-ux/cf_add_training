import https from 'https';
import zlib from 'zlib';
import querystring from 'querystring';

/**
 * 拉题操作函数
 * @param cookieHeader 已提取的 cookie 请求头字符串
 * @param csrfToken 提取的 csrf_token
 * @param contestName 比赛名称
 * @param contestDuration 比赛时长（单位分钟）
 * @param problems 题目数组，每个元素包含 id 和 index，如 { id: '3442674', index: 'A' }
 */
export async function pullProblem(
  cookieHeader: string,
  csrfToken: string,
  contestName: string,
  contestDuration: number,
  problems: { id: string; index: string }[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      action: 'saveMashup',
      isCloneContest: 'false',
      parentContestIdAndName: '',
      parentContestId: '',
      contestName,
      contestDuration: contestDuration.toString(),
      problemsJson: JSON.stringify(problems),
      csrf_token: csrfToken
    });

    const options: https.RequestOptions = {
      hostname: 'codeforces.com',
      path: '/data/mashup',
      method: 'POST',
      headers: {
        'Host': 'codeforces.com',
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData),
        'Referer': 'https://codeforces.com/mashup/new',
        'X-Csrf-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://codeforces.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Te': 'trailers'
      }
    };

    const req = https.request(options, res => {
      const chunks: Buffer[] = [];

      res.on('data', chunk => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let responseBody: string;

        const encoding = res.headers['content-encoding'];
        if (encoding === 'br') {
          responseBody = zlib.brotliDecompressSync(buffer).toString();
        } else if (encoding === 'gzip') {
          responseBody = zlib.gunzipSync(buffer).toString();
        } else if (encoding === 'deflate') {
          responseBody = zlib.inflateSync(buffer).toString();
        } else {
          responseBody = buffer.toString();
        }

        console.log('[+] 拉题请求响应:');
        console.log(responseBody);
        resolve();
      });
    });

    req.on('error', err => {
      console.error('[-] 拉题请求错误:', err);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}
