const fs = require('fs')
const util = require('util')
const opn = require('opn')
const sharp = require('sharp')
const inquirer = require('inquirer')
const puppeteer = require('puppeteer')
const print = util.promisify(require('console-png'))

const ENTRY_URL = 'https://www.ff14.co.kr/main'
const LIST_URL = 'https://www.ff14.co.kr/shop/myShop/MyList?Type=C'
const LIST_ACTION_URL = 'https://www.ff14.co.kr/shop/MyShop/MyListAction'

const NICKNAME_DIV = '.nickname'
const LOGIN_BUTTON = '.login_ok'
const AUTH_BUTTON = '.btn_login'
const USERNAME_INPUT = '#memberID'
const PASSWORD_INPUT = '#passWord'
const CAPTCHA_INPUT = '#CaptchaCode'
const CAPTCHA_IMG = '#WebLoginCaptcha_CaptchaImage'

const CLIP = { left: 10, top: 0, width: 267, height: 63 }
const TYPES = {
  C: '크리스탈 충전',
  U: '상품 구매',
  B: '이용권 구매',
  G: '선물 발송'
}

async function req ({ type, year, month, url }) {
  const body = new FormData()
  body.append('Type', type)
  body.append('StartYear', year)
  body.append('StartMonth', month)

  return fetch(url, { body, method: 'POST' }).then(r => r.json())
}

async function main() {
  console.log('브라우저 켜는 중...')
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1920, height: 1080 }
  })

  console.log('파판14 홈페이지 접속 중...')
  const page = await browser.newPage()
  await page.goto(ENTRY_URL)
  await page.waitFor(AUTH_BUTTON)

  console.log('로그인 페이지 여는 중...')
  await page.click(AUTH_BUTTON)
  await page.waitFor(CAPTCHA_IMG)

  console.log('캡챠 이미지 가져오는 중...')
  console.log(await page.$(CAPTCHA_IMG)
    .then(i => i.screenshot({ type: 'png' }))
    .then(i => sharp(i).extract(CLIP).resize(200).toBuffer())
    .then(print))

  const answers = await inquirer.prompt([
    { name: 'username' },
    { name: 'password', type: 'password' },
    { name: 'captcha' }
  ])

  await page.type(USERNAME_INPUT, answers.username)
  await page.type(PASSWORD_INPUT, answers.password)
  await page.type(CAPTCHA_INPUT, answers.captcha)

  console.log('로그인 중....')
  await page.click(LOGIN_BUTTON)
  await page.waitFor(NICKNAME_DIV)

  const nickname = await page.$eval(NICKNAME_DIV, n => n.textContent)
  console.log(`${nickname}님의 데이터를 찾는 중...`)
  await page.goto(LIST_URL)

  const list = []
  const Y = new Date().getFullYear()
  const M = 1 + new Date().getMonth()

  console.log('이용권 구매 내역을 가져오는 중...')
  const bParams = { type: 'B', year: Y, month: M, url: LIST_ACTION_URL }
  const bResult = (await page.evaluate(req, bParams)).ShopList.reverse()
  bResult.forEach(item => {
    const [year, month] = item.buydate.split('.').map(v => parseInt(v, 10))
    const m = list.find(l => l.type === 'B' && l.year === year && l.month === month)
    if (m) m.data.push(item)
    return list
  })

  const firstYear = +bResult[0].buydate.split('.')[0]
  for (let year = firstYear; year <= Y; year++) {
    console.log(`${year}년 데이터를 가져오는 중...`)

    for (let month = 1; month <= (year === Y ? M : 12); month++) {
      for (let type of Object.keys(TYPES)) {
        if (type === 'B') {
          list.push({ type, year, month, data: [] })
          continue
        }

        const p = { type, year, month, url: LIST_ACTION_URL }
        list.push({ type, year, month, data: (await page.evaluate(req, p)).ShopList })
      }

    }
  }



  console.log('결과 저장하는 중...')
  fs.writeFileSync('result.json', JSON.stringify(list, null, 2))
  
  await browser.close()
  await opn('index.html')
}

main()
  .then(() => console.log('끝났습니다!'))
  .catch(err => console.error(err))