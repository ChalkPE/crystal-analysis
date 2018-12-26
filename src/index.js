const opn = require('opn')
const fs = require('fs').promises
const inquirer = require('inquirer')
const puppeteer = require('puppeteer')

const CAPTCHA_PATH = 'captcha.png'
const ENTRY_URL = 'https://www.ff14.co.kr/main'
const LIST_URL = 'https://www.ff14.co.kr/shop/myShop/MyList?Type=C'
const LIST_API = 'https://www.ff14.co.kr/shop/MyShop/MyListAction'

const LOGIN_BUTTON = '.login_ok'
const GOTO_LOGIN_BUTTON = '.btn_login'
const LOGIN_FORM = '.login_form'
const CAPTCHA_IMG = '#WebLoginCaptcha_CaptchaImage'
const USERNAME_INPUT = '#memberID'
const PASSWORD_INPUT = '#passWord'
const CAPTCHA_INPUT = '#CaptchaCode'
const NICKNAME_DIV = '.nickname'

const TYPES = {
  C: '크리스탈 충전',
  U: '상품 구매',
  B: '이용권 구매',
  G: '선물 발송'
}

async function main() {
  console.log('브라우저 켜는 중...')
  const browser = await puppeteer.launch({
    // 이거 없으면 엘레멘트들 겹쳐져서 버튼 못 누름
    defaultViewport: { width: 1920, height: 1080 }
  })

  console.log('파판14 홈페이지 접속 중...')
  const page = await browser.newPage()
  await page.goto(ENTRY_URL)
  await page.waitFor(GOTO_LOGIN_BUTTON)

  console.log('로그인 창 여는 중...')
  await page.click(GOTO_LOGIN_BUTTON)
  await page.waitFor(LOGIN_FORM)

  const { username, password } = await inquirer.prompt([
    { name: 'username', type: 'input' },
    { name: 'password', type: 'password' }
  ])
  await page.type(USERNAME_INPUT, username, { delay: 100 })
  await page.type(PASSWORD_INPUT, password, { delay: 100 })

  console.log('캡챠 이미지 가져오는 중...')
  await page.waitFor(CAPTCHA_IMG)
  const img = await page.$(CAPTCHA_IMG)
  await img.screenshot({ path: CAPTCHA_PATH })
  await opn(CAPTCHA_PATH)

  const { captcha } = await inquirer.prompt([{ name: 'captcha' }])
  await page.type(CAPTCHA_INPUT, captcha, { delay: 100 })

  console.log('로그인 중....')
  await page.click(LOGIN_BUTTON)
  await page.waitFor('.user_info')

  const nickname = await page.$eval(NICKNAME_DIV, div => div.textContent)
  console.log(`${nickname}님의 데이터 가져오는 중...`)
  await page.goto(LIST_URL)

  const list = []
  const now = new Date().getFullYear()
  for (let [type, typeName] of Object.entries(TYPES)) {
    console.log(`${typeName} 내역 가져오는 중...`)
    
    for (let year = now - 4; year <= now; year++) {
      for (let month = 1; month <= 12; month++) {
        const result = await page.evaluate((url, type, year, month) => {
          const body = new FormData()
          body.append('Type', type)
          body.append('StartYear', year)
          body.append('StartMonth', month)

          return fetch(url, { method: 'POST', body }).then(r => r.json())
        }, LIST_API, type, year, month)

        list.push({ type, year, month, result })
      }
    }
  }

  console.log('결과 저장하는 중...')
  await fs.writeFile('result.json', JSON.stringify(list, null, 2))
  await browser.close()
}

main()
  .then(() => console.log('끝났습니다!'))
  .catch(err => console.error(err))