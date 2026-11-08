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
  const [stallCart, setStallCart] = useState([])
  const [stallSales, setStallSales] = useState([])
  const [stallSalesLoading, setStallSalesLoading] = useState(false)
  const [onlineOrders, setOnlineOrders] = useState([])
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [dailyStats, setDailyStats] = useState({ cashier: { boxes: 0, amount: 0 }, stall: { boxes: 0, amount: 0 }, online: { boxes: 0, amount: 0, storage: 0 } })
  const [statsLoading, setStatsLoading] = useState(false)
  const scanRef = useRef(null)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (user) { loadProducts(); loadStallSchedules(); loadDailyStats() } }, [user])
  useEffect(() => { if (user && selectedSchedule) { loadStallFlavors(selectedSchedule); loadStallSales(selectedSchedule); setStallCart([]) } }, [user, selectedSchedule])
  useEffect(() => { if (user && mode === 'online') loadOnlineOrders() }, [user, mode])

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

  async function loadStallSales(scheduleId) {
    setStallSalesLoading(true)
    const { data, error } = await supabase.from('stall_sales').select('id,schedule_id,receipt_number,items,total_amount,sold_at').eq('schedule_id', scheduleId).order('sold_at', { ascending: false }).limit(30)
    setStallSalesLoading(false)
    if (error) { setNotice('擺攤交易紀錄讀取失敗：' + error.message); return }
    setStallSales(data ?? [])
  }
  function addStallItem(row) {
    const price = Number(priceDrafts[row.flavor_id] ?? row.currentPrice)
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) { setNotice('請先確認商品價格'); return }
    setStallCart(current => { const found=current.find(item=>item.flavor_id===row.flavor_id); return found ? current.map(item=>item.flavor_id===row.flavor_id?{...item,quantity:item.quantity+1}:item) : [...current,{flavor_id:row.flavor_id,name:row.flavorName,price,quantity:1}] })
    setNotice('已加入擺攤訂單：' + row.flavorName)
  }
  function changeStallQty(flavorId,delta) { setStallCart(current=>current.map(item=>item.flavor_id===flavorId?{...item,quantity:Math.max(1,item.quantity+delta)}:item)) }
  function printStallReceipt(sale, openedWindow = null) {
    const items=Array.isArray(sale.items)?sale.items:[]
    const rows=items.map(item=>`<tr><td>${escapeHtml(item.name)} × ${Number(item.quantity)}</td><td>${money(Number(item.price)*Number(item.quantity))}</td></tr>`).join('')
    const w=openedWindow || window.open('','_blank','width=360,height=640')
    if(!w){setNotice('瀏覽器封鎖列印視窗，請允許彈出視窗後再試');return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>老爹涼糕擺攤收據</title><style>@page{size:58mm auto;margin:2mm}*{box-sizing:border-box}body{width:54mm;margin:0;font:12px/1.55 monospace;color:#000}h1,h2,p{text-align:center;margin:4px 0}h1{font-size:20px;font-weight:900}h2{font-size:15px;letter-spacing:2px}.sub{font-size:10px}.rule{border:0;border-top:1px dashed #333;margin:8px 0}.meta{font-size:11px;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td{padding:5px 0;border-bottom:1px dashed #aaa;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}.total{font-size:18px;font-weight:900;text-align:right;margin-top:10px}.thanks{font-weight:bold;font-size:14px;margin-top:12px}</style></head><body><h1>老爹．涼糕</h1><h2>擺 攤 銷 貨 收 據</h2><p class="sub">感謝您的支持與購買</p><hr class="rule"><p class="meta">收據編號：${escapeHtml(sale.receipt_number)}</p><p class="meta">交易日期：${new Date(sale.sold_at).toLocaleString('zh-TW')}</p><hr class="rule"><p><b>商品明細</b></p><table>${rows}</table><div class="total">應付總額：${money(sale.total_amount)}</div><hr class="rule"><p class="thanks">謝謝光臨！</p><p class="sub">老爹．涼糕 敬上</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`)
    w.document.close()
  }
  async function checkoutStall() {
    if(!stallCart.length||busy||!selectedSchedule)return
    const items=stallCart.map(item=>({flavor_id:item.flavor_id,name:item.name,price:Number(item.price),quantity:Number(item.quantity)}))
    const amount=items.reduce((sum,item)=>sum+item.price*item.quantity,0)
    const receiptNumber='ST'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+Date.now().toString().slice(-6)
    // iOS Safari blocks popups opened after an awaited network request. Open synchronously from the tap.
    const printWindow=window.open('about:blank','_blank')
    if(printWindow){printWindow.document.write('<!doctype html><html><head><meta charset="utf-8"><title>收據準備中</title></head><body style="font:16px sans-serif;padding:24px">收據準備中，請稍候…</body></html>');printWindow.document.close()}
    setBusy(true);setNotice('')
    const {data,error}=await supabase.from('stall_sales').insert({schedule_id:Number(selectedSchedule),receipt_number:receiptNumber,items,total_amount:amount}).select('id,schedule_id,receipt_number,items,total_amount,sold_at').single()
    setBusy(false)
    if(error){if(printWindow)printWindow.close();setNotice('擺攤結帳失敗，未建立交易：'+error.message);return}
    setStallCart([])
    if(printWindow){setNotice('擺攤結帳成功，正在列印收據');printStallReceipt(data,printWindow)}
    else{setNotice('結帳已成功並保存。iPhone 擋住列印視窗，請在「最近擺攤交易」按「重新列印」')}
    loadStallSales(selectedSchedule)
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

  async function loadDailyStats() {
    if (!supabase) return
    setStatsLoading(true)
    const now = new Date()
    const start = new Date(now); start.setHours(0,0,0,0)
    const end = new Date(now); end.setHours(23,59,59,999)
    const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0')
    const paidStatuses = new Set(['paid','stored','preparing','shipping','delivering','delivered','completed','已付款','已寄放','製作中','配送中','已送達','已完成'])
    const [cashierResult, stallResult, onlineResult] = await Promise.all([
      supabase.from('food_truck_sales').select('quantity,total_amount').gte('sold_at',start.toISOString()).lte('sold_at',end.toISOString()),
      supabase.from('stall_sales').select('items,total_amount').gte('sold_at',start.toISOString()).lte('sold_at',end.toISOString()),
      supabase.from('cooling_pickup_orders').select('order_date,status,merchandise_total,storage_fee,cooling_pickup_order_items(quantity)').eq('order_date',today)
    ])
    const errors = [cashierResult.error,stallResult.error,onlineResult.error].filter(Boolean)
    if (errors.length) setNotice('今日銷售統計讀取提醒：' + errors.map(e=>e.message).join('；'))
    const cashierRows = cashierResult.data ?? []
    const stallRows = stallResult.data ?? []
    const onlineRows = (onlineResult.data ?? []).filter(order=>paidStatuses.has(String(order.status || '').trim().toLowerCase()))
    const cashier = { boxes: cashierRows.reduce((n,row)=>n+Number(row.quantity||0),0), amount: cashierRows.reduce((n,row)=>n+Number(row.total_amount||0),0) }
    const stall = { boxes: stallRows.reduce((n,row)=>n+(Array.isArray(row.items)?row.items.reduce((m,item)=>m+Number(item.quantity||0),0):0),0), amount: stallRows.reduce((n,row)=>n+Number(row.total_amount||0),0) }
    const online = { boxes: onlineRows.reduce((n,order)=>n+(order.cooling_pickup_order_items||[]).reduce((m,item)=>m+Number(item.quantity||0),0),0), amount: onlineRows.reduce((n,order)=>n+Number(order.merchandise_total||0),0), storage: onlineRows.reduce((n,order)=>n+Number(order.storage_fee||0),0) }
    setDailyStats({cashier,stall,online})
    setStatsLoading(false)
  }
  async function loadOnlineOrders() {
    setOnlineLoading(true)
    const { data, error } = await supabase.from('cooling_pickup_orders')
      .select('id,order_number,order_date,convenience_store,store_name,merchandise_total,storage_fee,total_amount,status,created_at,cooling_pickup_order_items(id,product_name,flavor_name,unit_price,quantity,line_total)')
      .order('created_at', { ascending: false }).limit(100)
    setOnlineLoading(false)
    if (error) { setNotice('線上訂單讀取失敗：' + error.message); return }
    setOnlineOrders(data ?? [])
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
    loadDailyStats()
  }

  function printOnlineReceipt(order) {
    const items = order.cooling_pickup_order_items || []
    const itemRows = items.map(item => `<tr><td>${escapeHtml(item.product_name || item.flavor_name || '商品')} × ${Number(item.quantity || 0)}</td><td>${money(item.line_total ?? Number(item.unit_price || 0) * Number(item.quantity || 0))}</td></tr>`).join('')
    const w = window.open('', '_blank', 'width=360,height=640')
    if (!w) { setNotice('瀏覽器封鎖列印視窗，請允許彈出視窗後再按列印'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>老爹涼糕線上訂單收據</title><style>@page{size:58mm auto;margin:2mm}body{width:54mm;font:12px/1.55 monospace;color:#000}h2,p{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px dashed #999}td:last-child{text-align:right}.total{font-size:16px;font-weight:bold;text-align:right;margin-top:8px}.meta{overflow-wrap:anywhere}</style></head><body><h2>老爹．涼糕</h2><p>線上冷藏店到店訂單</p><p class="meta">${escapeHtml(order.order_number || '')}</p><p>${escapeHtml(order.order_date || new Date(order.created_at).toLocaleDateString('zh-TW'))}</p><hr><p>${escapeHtml(order.convenience_store || '')} ${escapeHtml(order.store_name || '')}</p><table>${itemRows}</table><p class="total">商品：${money(order.merchandise_total)}</p><p class="total">寄放：${money(order.storage_fee)}</p><p class="total">合計：${money(order.total_amount)}</p><p>訂單狀態：${escapeHtml(order.status || '未提供')}</p><p>謝謝支持老爹．涼糕</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`)
    w.document.close()
  }

  function printReceipt() {
    const lines = cart.map(item => `<tr><td>${escapeHtml(item.name)} × ${item.quantity}</td><td>${money(item.price * item.quantity)}</td></tr>`).join('')
    const w = window.open('', '_blank', 'width=360,height=640')
    if (!w) { setNotice('瀏覽器封鎖列印視窗，請允許彈出視窗後重試'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>老爹涼糕銷貨收據</title><style>@page{size:58mm auto;margin:2mm}*{box-sizing:border-box}body{width:54mm;margin:0;font:12px/1.55 monospace;color:#000}h1,h2,p{text-align:center;margin:4px 0}h1{font-size:20px;font-weight:900}h2{font-size:15px;letter-spacing:2px}.sub{font-size:10px}.rule{border:0;border-top:1px dashed #333;margin:8px 0}.meta{font-size:11px}table{width:100%;border-collapse:collapse}td{padding:5px 0;border-bottom:1px dashed #aaa;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}.total{font-size:18px;font-weight:900;text-align:right;margin-top:10px}.thanks{font-weight:bold;font-size:14px;margin-top:12px}</style></head><body><h1>老爹．涼糕</h1><h2>銷 貨 收 據</h2><p class="sub">感謝您的支持與購買</p><hr class="rule"><p class="meta">交易日期：${new Date().toLocaleString('zh-TW')}</p><p class="meta">交易類型：餐車現場銷售</p><hr class="rule"><p><b>商品明細</b></p><table>${lines}</table><div class="total">應付總額：${money(total)}</div><hr class="rule"><p class="thanks">謝謝光臨！</p><p class="sub">老爹．涼糕 敬上</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`)
    w.document.close()
  }

  if (!isSupabaseConfigured) return <main className="setup"><h1>老爹 POS</h1><p>尚未設定 Supabase。請在 Vercel 的 POS 專案環境變數加入：</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><p>請勿將 service_role key 放進前端。</p></main>
  if (!user) return <main className="login"><div className="brand">老爹<span>POS</span></div><h1>管理員登入</h1><form onSubmit={signIn}><label>管理員 Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" /></label><label>密碼<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label><button disabled={busy}>{busy ? '登入中…' : '登入'}</button></form>{notice && <p className="notice">{notice}</p>}</main>

  return <main className="app">
    <header><div><div className="brand">老爹<span>POS</span></div><small>{mode === 'cashier' ? '餐車模式 · 收銀' : mode === 'stall' ? '擺攤管理 · 口味價格' : '線上訂單 · 冷藏店到店'}</small></div><button className="ghost" onClick={()=>supabase.auth.signOut()}>登出</button></header>
    <nav className="modeSwitch"><button className={mode === 'cashier' ? 'modeActive' : ''} onClick={()=>setMode('cashier')}>餐車收銀</button><button className={mode === 'stall' ? 'modeActive' : ''} onClick={()=>setMode('stall')}>擺攤管理</button><button className={mode === 'online' ? 'modeActive' : ''} onClick={()=>setMode('online')}>線上訂單</button></nav>
    {notice && <p className="notice">{notice}</p>}
    <section className="dailyStats">
      <div className="dailyStatsHead"><b>今日銷售統計</b><button className="ghost" onClick={loadDailyStats} disabled={statsLoading}>{statsLoading ? '更新中…' : '更新統計'}</button></div>
      {mode === 'cashier' ? <div className="statGrid"><article><small>餐車銷售盒數</small><strong>{dailyStats.cashier.boxes} 盒</strong></article><article><small>餐車銷售金額</small><strong>{money(dailyStats.cashier.amount)}</strong></article></div> : mode === 'stall' ? <div className="statGrid"><article><small>擺攤銷售盒數</small><strong>{dailyStats.stall.boxes} 盒</strong></article><article><small>擺攤銷售金額</small><strong>{money(dailyStats.stall.amount)}</strong></article></div> : <div className="statGrid"><article><small>線上已付款盒數</small><strong>{dailyStats.online.boxes} 盒</strong></article><article><small>線上商品銷售額（不含寄放）</small><strong>{money(dailyStats.online.amount)}</strong></article><article><small>寄放費（另計）</small><strong>{money(dailyStats.online.storage)}</strong></article></div>}
      <small className="statsFoot">統計日期：{new Date().toLocaleDateString('zh-TW')}｜線上統計只計已付款及後續處理中的訂單</small>
    </section>
    {mode === 'online' ? <section className="catalog onlinePanel"><div className="orderTitle"><h2>冷藏店到店訂單</h2><button className="ghost" onClick={loadOnlineOrders} disabled={onlineLoading}>{onlineLoading ? '更新中…' : '重新整理'}</button></div><p className="muted">這裡只顯示冷藏店到店訂單，不包含宅配及餐車現場收銀。</p>{onlineLoading ? <p>讀取線上訂單中…</p> : onlineOrders.length ? onlineOrders.map(order => <article className="onlineOrder" key={order.id}><div className="orderTitle"><b>{order.order_number}</b><strong>{order.status || '待確認'}</strong></div><small>{order.order_date || new Date(order.created_at).toLocaleDateString('zh-TW')}｜{order.convenience_store || ''} {order.store_name || ''}</small>{(order.cooling_pickup_order_items || []).map(item => <div className="line" key={item.id}><span>{item.product_name || item.flavor_name} × {item.quantity}</span><b>{money(item.line_total ?? item.unit_price * item.quantity)}</b></div>)}<div className="sum"><span>商品 {money(order.merchandise_total)}＋寄放 {money(order.storage_fee)}</span><strong>{money(order.total_amount)}</strong></div><button className="checkout onlinePrint" onClick={()=>printOnlineReceipt(order)}>列印／重新列印 58mm 收據</button><p className="muted">列印紙本不會重複建立銷售紀錄；線上訂單匯入 POS 的付款確認及防重複機制仍獨立處理。</p></article>) : <p className="muted">目前沒有線上冷藏店到店訂單</p>}</section> : mode === 'stall' ? <section className="catalog stallPanel">
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
        <button className="stallAdd" disabled={busy} onClick={()=>addStallItem(row)}>加入</button>
      </div>)}
      {!!selectedSchedule && !stallLoading && !stallFlavors.length && <p className="muted">這場擺攤尚未設定販售口味</p>}
      <p className="muted">每場擺攤的口味價格獨立保存，不會更動餐車價格或其他場次。</p>
      <section className="stallCheckout"><div className="orderTitle"><h2>擺攤本筆交易</h2><button className="ghost" onClick={()=>setStallCart([])}>清空</button></div>
        {stallCart.length ? stallCart.map(item=><div className="line" key={item.flavor_id}><div><b>{item.name}</b><small>{money(item.price)}／盒</small></div><div className="qty"><button onClick={()=>changeStallQty(item.flavor_id,-1)}>−</button><strong>{item.quantity}</strong><button onClick={()=>changeStallQty(item.flavor_id,1)}>＋</button></div><b>{money(item.price*item.quantity)}</b></div>) : <p className="empty">按各口味旁的「加入」開始擺攤結帳</p>}
        <div className="sum"><span>應收總額</span><strong>{money(stallCart.reduce((sum,item)=>sum+item.price*item.quantity,0))}</strong></div>
        <button className="checkout" disabled={!stallCart.length || busy} onClick={checkoutStall}>{busy ? '處理中…' : '擺攤結帳並列印 58mm 收據'}</button></section>
      <section className="stallHistory"><div className="orderTitle"><h2>最近擺攤交易</h2><button className="ghost" onClick={()=>loadStallSales(selectedSchedule)} disabled={stallSalesLoading}>{stallSalesLoading ? '更新中…' : '重新整理'}</button></div>
        {stallSalesLoading ? <p>讀取交易紀錄中…</p> : stallSales.length ? stallSales.map(sale=><article className="onlineOrder" key={sale.id}><div className="orderTitle"><b>{sale.receipt_number}</b><strong>{money(sale.total_amount)}</strong></div><small>{new Date(sale.sold_at).toLocaleString('zh-TW')}</small><button className="checkout onlinePrint" onClick={()=>printStallReceipt(sale)}>重新列印 58mm 收據</button></article>) : <p className="muted">這個場次還沒有擺攤交易</p>}</section>
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