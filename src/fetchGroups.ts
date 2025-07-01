import https from 'https'
import { JSDOM } from 'jsdom'
import zlib from 'zlib'

export async function fetchGroups(cookieHeader: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const options = {
      hostname: 'codeforces.com',
      path: '/groups/my',
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://codeforces.com/',
        'Upgrade-Insecure-Requests': '1'
      }
    }

    const req = https.request(options, res => {
      const chunks: any[] = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const encoding = res.headers['content-encoding']
        let html: string
  
        if (encoding === 'br') {
          html = zlib.brotliDecompressSync(buffer).toString()
        } else if (encoding === 'gzip') {
          html = zlib.gunzipSync(buffer).toString()
        } else if (encoding === 'deflate') {
          html = zlib.inflateSync(buffer).toString()
        } else {
          html = buffer.toString()
        }
  
        const dom = new JSDOM(html)
        const document = dom.window.document
        const pageContent = document.querySelector('#pageContent')
        const tbodys = pageContent?.querySelectorAll('tbody')
        const targetDiv = tbodys?.[0]
  
        if (targetDiv) {
          const inner = targetDiv.innerHTML
          console.log('[+] 成功提取 group innerHTML')
          console.log(targetDiv.innerHTML)
          resolve(inner) // 返回 innerHTML
        } else {
          console.error('[-] 未找到目标 tbody')
          resolve('<p>未能获取到 Group 信息</p>')
        }
      })
    })

    req.on('error', err => {
      console.error('[-] 请求错误:', err)
      reject(err)
    })

    req.end()
  })
}
