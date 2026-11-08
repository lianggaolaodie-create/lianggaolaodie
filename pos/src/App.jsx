import React, { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const money = value => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value || 0)

export default function App() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [barcode, setBarcode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [mode, setMode] = useState('cashier')
  const [stallSchedules, setStallSchedules] = useState([])
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [stallFlavors, setStallFlavors] = useState([])
  const [priceDrafts, setPriceDrafts] = useState({})
  const [stallLoading, setStallLoading] = useState(false)
  const scanRef = useRef(null)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (user) { loadProducts(); loadStallSchedules() } }, [user])
  useEffect(() => { if (user && selectedSchedule) loadStallFlavors(selectedSchedule) }, [user, selectedSchedule])

  async function loadStallSchedules() {
    const { data, error } = await supabase.from('food_truck_schedules')
      .select('id,schedule_date,region,start_time,end_time,enabled')
      .eq('schedule_type', 'stall').order('schedule_date', { ascending: false })
    if (error) { setNotice('擺攤場次讀取失敗：' + error.message); return }
    setStallSchedules(data ?? [])
    if (!selectedSchedule && data?.length) setSelectedSchedule(String(data[0].id))
  }

  async function loadStallFlavors(scheduleId) {
    setStallLoading(true)
    const { data, error } = await supabase.from('food_truck_schedule_flavors')
      .select('schedule_id,flavor_id,price_per_box,price,unit_price,flavors(id,name,price,enabled)')
      .eq('schedule_id', scheduleId)
    setStallLoading(false)
    if (error) { setNotice('擺攤口味讀取失敗：' + error.message); return }
    const rows = (data ?? []).map(row => ({
      ...row,
      flavorName: row.flavors?.name ?? ('口味 #' + row.flavor_id),
      currentPrice: row.price_per_box ?? row.price ?? row.unit_price ?? row.flavors?.price ?? 0
    }))
    setStallFlavors(rows)
    setPriceDrafts(Object.fromEntries(rows.map(row => [row.flavor_id, String(row.currentPrice)])))
  }

  async function saveStallPrice(row) {
    const value = Number(priceDrafts[row.flavor_id])
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      setNotice('價格請輸入 0 以上的整數'); return
    }
    setBusy(true); setNotice('')
    const { error } = await supabase.from('food_truck_schedule_flavors')
      .update({ price_per_box: value, price: value, unit_price: value })
      .eq('schedule_id', selectedSchedule).eq('flavor_id', row.flavor_id)
    setBusy(false)
    if (error) { setNotice('價格儲存失敗：' + error.message); return }
    setStallFlavors(current => current.map(item => item.flavor_id === row.flavor_id ? { ...item, currentPrice: value } : item))
    setNotice(row.flavorName + ' 價格已更新為 ' + money(value))
  }

  async function loadProducts() {
    const { data, error } = await supabase.from('food_truck_products')
      .select('id, product_name, price, barcode, stock, active, flavor')
      .eq('active', true).order('product_name')
    if (error) setNotice('商品讀取失敗：' + error.message)
    else setProducts(data ?? [])
  }

  async function signIn(event) {
    event.preventDefault()
    setBusy(true); setNotice('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setNotice('登入失敗：' + error.message)
  }

  function addProduct(product) {
    setCart(current => {
      const found = current.find(item => item.id === product.id)
      if (found) return current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { id: product.id, name: product.product_name, barcode: product.barcode, price: product.price, quantity: 1 }]
    })
    setNotice('已加入：' + product.product_name)
    setBarcode('')
    scanRef.current?.focus()
  }

  function scan(event) {
    event.preventDefault()
    const code = barcode.trim()
    if (!code) return
    const product = products.find(item => item.barcode === code)
    if (!product) { setNotice('找不到條碼：' + code); setBarcode(''); return }
    addProduct(product)
  }

  function changeQty(id, delta) {
    setCart(current => current.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
  }

  async function checkout() {
    if (!cart.length || busy) return
    setBusy(true); setNotice('')
    const rows = cart.map(item => ({ product_id: item.id, barcode: item.barcode, product_name: item.name, quantity: item.quantity, unit_price: item.price, total_amount: item.price * item.quantity }))
    const { error } = await supabase.from('food_truck_sales').insert(rows)
    setBusy(false)
    if (error) { setNotice('結帳未完成，資料未寫入：' + error.message); return }
    setNotice('結帳成功，準備列印收據')
    printReceipt()
    setCart([])
  }

  function printReceipt() {
    const lines = cart.map(item => `<tr><td>${escapeHtml(item.name)} × ${item.quantity}</td><td>${money(item.price * item.quantity)}</td></tr>`).join('')
    const w = window.open('', '_blank', 'width=360,height=640')
    if (!w) { setNotice('瀏覽器封鎖列印視窗，請允許彈出視窗後重試'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>老爹涼糕收據</title><style>@page{size:58mm auto;margin:2mm}body{width:54mm;font:12px/1.5 monospace;color:#000}h2,p{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}td{padding:3px 0;border-bottom:1px dashed #999}td:last-child{text-align:right}.total{font-size:16px;font-weight:bold;text-align:right;margin-top:8px}</style></head><body><h2>老爹．涼糕</h2><p>餐車銷售明細</p><p>${new Date().toLocaleString('zh-TW')}</p><hr><table>${lines}</table><div class="total">合計：${money(total)}</div><p>謝謝光臨</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`)
    w.document.close()
  }

  if (!isSupabaseConfigured) return <main className="setup"><h1>老爹 POS</h1><p>尚未設定 Supabase。請在 Vercel 的 POS 專案環境變數加入：</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><p>請勿將 service_role key 放進前端。</p></main>
  if (!user) return <main className="login"><div className="brand">老爹<span>POS</span></div><h1>管理員登入</h1><form onSubmit={signIn}><label>管理員 Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" /></label><label>密碼<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label><button disabled={busy}>{busy ? '登入中…' : '登入'}</button></form>{notice && <p className="notice">{notice}</p>}</main>

  return <main className="app">
    <header><div><div className="brand">老爹<span>POS</span></div><small>{mode === 'cashier' ? '餐車模式 · 收銀' : '擺攤管理 · 口味價格'}</small></div><button className="ghost" onClick={()=>supabase.auth.signOut()}>登出</button></header>
    <nav className="modeSwitch"><button className={mode === 'cashier' ? 'modeActive' : ''} onClick={()=>setMode('cashier')}>餐車收銀</button><button className={mode === 'stall' ? 'modeActive' : ''} onClick={()=>setMode('stall')}>擺攤管理</button></nav>
    {notice && <p className="notice">{notice}</p>}
    {mode === 'stall' ? <section className="catalog stallPanel">
      <h2>擺攤口味價格設定</h2>
      <label className="fieldLabel">選擇擺攤場次</label>
      <select className="scheduleSelect" value={selectedSchedule} onChange={e=>setSelectedSchedule(e.target.value)}>
        {stallSchedules.map(s=><option key={s.id} value={s.id}>{s.schedule_date}｜{s.region}</option>)}
      </select>
      {!stallSchedules.length && <p className="muted">目前沒有擺攤場次資料</p>}
      {stallLoading ? <p>讀取口味中…</p> : stallFlavors.map(row=><div className="priceEditor" key={row.flavor_id}>
        <div><b>{row.flavorName}</b><small>目前價格：{money(row.currentPrice)}</small></div>
        <input aria-label={row.flavorName + '價格'} type="number" min="0" step="1" value={priceDrafts[row.flavor_id] ?? ''} onChange={e=>setPriceDrafts(current=>({...current,[row.flavor_id]:e.target.value}))}/>
        <button disabled={busy || Number(priceDrafts[row.flavor_id]) === Number(row.currentPrice)} onClick={()=>saveStallPrice(row)}>儲存</button>
      </div>)}
      {!!selectedSchedule && !stallLoading && !stallFlavors.length && <p className="muted">這場擺攤尚未設定販售口味</p>}
      <p className="muted">每場擺攤的口味價格獨立保存，不會更動餐車價格或其他場次。</p>
    </section> : <>
      <section className="scanner"><label htmlFor="barcode">掃描商品條碼</label><form onSubmit={scan}><input ref={scanRef} id="barcode" value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="掃碼槍掃描後按 Enter" autoFocus/><button>加入</button></form><small>支援 USB／藍牙鍵盤型掃碼槍</small></section>
      <section className="catalog"><h2>商品快速加入</h2><div className="products">{products.map(p=><button className="product" key={p.id} onClick={()=>addProduct(p)}><b>{p.product_name}</b><span>{money(p.price)}</span></button>)}</div>{!products.length && <p className="muted">目前沒有啟用中的餐車商品</p>}</section>
      <section className="order"><div className="orderTitle"><h2>本筆訂單</h2><button className="ghost" onClick={()=>setCart([])}>清空</button></div>{cart.length ? cart.map(item=><div className="line" key={item.id}><div><b>{item.name}</b><small>{money(item.price)}／盒</small></div><div className="qty"><button onClick={()=>changeQty(item.id,-1)}>−</button><strong>{item.quantity}</strong><button onClick={()=>changeQty(item.id,1)}>＋</button></div><b>{money(item.price*item.quantity)}</b></div>) : <p className="empty">掃描條碼或點選商品開始結帳</p>}</section>
      <footer><div className="sum"><span>應收總額</span><strong>{money(total)}</strong></div><button className="checkout" disabled={!cart.length || busy} onClick={checkout}>{busy ? '處理中…' : '結帳並列印 58mm 收據'}</button><button className="print" disabled={!cart.length} onClick={printReceipt}>只列印預覽</button></footer>
    </>}
  </main>
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]))
}