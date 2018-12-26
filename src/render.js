const TYPES = {
  C: '크리스탈 충전',
  U: '상품 구매',
  B: '이용권 구매',
  G: '선물 발송'
}

const chart = document.querySelector('#chart')
const key = r => `${r.year}-${r.month.toString().padStart(2, '0')}`

const price = p => isNaN(p.price) ? parseInt(p.paidCash.replace(/,/g, '')) : p.price
const total = p => p.map(price).reduce((a, b) => a + b, 0)

function findLastIndex (arr, predicate) {
  for (let i = arr.length - 1; i > -1; i--) {
    if (predicate(arr[i], i, arr)) return i
  }
  return -1
}

function trim (opts) {
  const first = Math.min(...opts.series.map(s => s.data.findIndex(d => d > 0)).filter(v => v > -1))
  const last = Math.max(...opts.series.map(s => findLastIndex(s.data, d => d > 0)).filter(v => v > -1))

  const start = Math.max(0, first - 1)
  const end = Math.min(opts.xaxis.categories.length, last + 2)

  return {
    ...opts,
    xaxis: { categories: opts.xaxis.categories.slice(start, end) },
    series: opts.series.map(s => ({ ...s, data: s.data.slice(start, end) }))
  }
}

async function render () {
  const raw = await fetch('result.json').then(r => r.json())
  const result = raw.reduce((o, r, i, a, k = key(r)) =>
    void ((o[r.type] = o[r.type] || {})[k] = r.data) || o, {})

  console.log(result)

  const opts = {
    dataLabels: { enabled: false },
    chart: { type: 'line', height: '100%' },
    series: Object.entries(result).map(([type, list]) => ({
      name: TYPES[type],
      type: type === 'C' ? 'line' : 'column',
      data: Object.values(list).map(total)
    })),

    xaxis: {
      categories: Object.keys(result['C'])
    }
  }

  new ApexCharts(chart, trim(opts)).render()
}

render()
  .then(() => console.log('render finished!'))
  .catch(err => console.error(err))