let dailySessionId=null,dailyRows=[],dailyFlavors=[];
async function dailyInit(){
 if(!window.db && typeof db==='undefined')return;
 const f=await db.from('flavors').select('id,name,price,enabled').eq('enabled',true).order('name');
 if(f.error){$('dailySessionStatus').textContent='口味讀取失敗：'+f.error.message;return}
 dailyFlavors=f.data||[];
 $('dailyFlavorSelect').innerHTML='<option value="">選擇口味</option>'+dailyFlavors.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'｜預設 $'+Number(x.price||0)+'</option>').join('');
 const today=new Date().toLocaleDateString('en-CA');
 const s=await db.from('food_truck_sessions').select('id,session_date,title,location,status').eq('session_date',today).eq('status','open').order('id',{ascending:false});
 if(s.error){$('dailySessionStatus').textContent='場次讀取失敗：'+s.error.message;return}
 const rows=s.data||[];
 $('dailySessionSelect').innerHTML='<option value="">選擇今天場次</option>'+rows.map(x=>'<option value="'+x.id+'">'+esc(x.location||x.title||'餐車')+'</option>').join('');
 if(rows.length){$('dailySessionSelect').value=String(rows[0].id);await dailySelectSession(rows[0].id)}
 else{$('dailySessionStatus').textContent='今天尚未建立場次';$('dailyFlavorArea').classList.add('hidden')}
}
async function dailyCreateSession(){
 const today=new Date().toLocaleDateString('en-CA'),location=$('dailySessionLocation').value.trim()||'餐車';
 const r=await db.from('food_truck_sessions').insert({session_date:today,title:'餐車營業場次',location,status:'open'}).select('id').single();
 if(r.error){$('dailySessionStatus').textContent='建立失敗：'+r.error.message;return}
 await dailyInit();$('dailySessionSelect').value=String(r.data.id);await dailySelectSession(r.data.id);
}
async function dailySelectSession(id){
 dailySessionId=id?Number(id):null;dailyRows=[];clearProduct();
 if(!dailySessionId){$('dailyFlavorArea').classList.add('hidden');return}
 const s=await db.from('food_truck_sessions').select('id,session_date,location,status').eq('id',dailySessionId).maybeSingle();
 if(s.error||!s.data||s.data.status!=='open'){dailySessionId=null;$('dailySessionStatus').textContent='場次不存在或已結束';$('dailyFlavorArea').classList.add('hidden');return}
 $('dailySessionStatus').textContent='目前場次：'+(s.data.location||'餐車')+'｜'+s.data.session_date;
 $('dailyFlavorArea').classList.remove('hidden');
 $('dailyProductSelect').innerHTML='<option value="">選擇商品</option>'+products.filter(p=>p.active!==false).map(p=>'<option value="'+p.id+'">'+esc(p.product_name)+'｜'+esc(p.flavor||'')+'</option>').join('');
 const r=await db.from('food_truck_session_flavors').select('*').eq('session_id',dailySessionId).order('id');
 if(r.error){$('dailyFlavorList').textContent=r.error.message;return}
 dailyRows=r.data||[];dailyRender();
}
function dailyApplyFlavor(){
 const f=dailyFlavors.find(x=>Number(x.id)===Number($('dailyFlavorSelect').value));if(!f)return;
 $('dailyPriceInput').value=Number(f.price||0);
 const p=products.find(x=>x.active!==false&&String(x.flavor||'').trim()===String(f.name||'').trim());if(p)$('dailyProductSelect').value=String(p.id);
}
async function dailyAddFlavor(){
 const flavor_id=Number($('dailyFlavorSelect').value),product_id=Number($('dailyProductSelect').value),price=Number($('dailyPriceInput').value);
 if(!dailySessionId||!flavor_id||!product_id||!Number.isInteger(price)||price<0){alert('請選口味、商品及有效價格');return}
 const r=await db.from('food_truck_session_flavors').insert({session_id:dailySessionId,flavor_id,product_id,price});
 if(r.error){alert('加入失敗：'+r.error.message);return}await dailySelectSession(dailySessionId);
}
function dailyRender(){
 $('dailyFlavorList').innerHTML=dailyRows.map(r=>{const f=dailyFlavors.find(x=>Number(x.id)===Number(r.flavor_id)),p=products.find(x=>Number(x.id)===Number(r.product_id));return '<div class="item"><div><b>'+esc(f?.name||p?.flavor||'口味')+'</b><small>'+esc(p?.product_name||'')+'｜$'+Number(r.price)+'</small></div><button class="btn" style="width:auto" onclick="dailyChangePrice('+r.id+')">改價格</button></div>'}).join('')||'<div class="muted">今天尚未設定口味</div>';
}
async function dailyChangePrice(id){
 const row=dailyRows.find(x=>Number(x.id)===Number(id));if(!row)return;
 const raw=prompt('輸入今天售價',String(row.price));if(raw===null)return;const price=Number(raw);
 if(!Number.isInteger(price)||price<0){alert('請輸入有效價格');return}
 const r=await db.from('food_truck_session_flavors').update({price}).eq('id',id);if(r.error){alert(r.error.message);return}await dailySelectSession(dailySessionId);
}
const dailyShowProduct=showProduct;
showProduct=function(p){
 if(!dailySessionId){$('hint').textContent='請先建立或選擇今天場次';clearProduct();return}
 const row=dailyRows.find(x=>Number(x.product_id)===Number(p.id));
 if(!row){$('hint').textContent='商品尚未加入今天販售清單';clearProduct();return}
 dailyShowProduct({...p,price:Number(row.price)});
};
const dailySell=sell;
sell=async function(){
 if(!selected||!dailySessionId){alert('請先選擇今天場次及商品');return}
 const r=await db.rpc('food_truck_scan_sale',{p_barcode:selected.barcode,p_quantity:qty,p_business_session_id:dailySessionId});
 if(r.error){$('result').innerHTML='<div class="notice">❌ '+esc(r.error.message)+'</div>';return}
 const row=Array.isArray(r.data)?r.data[0]:r.data;
 $('result').innerHTML='<div class="success">銷售完成｜單價 $'+Number(row.unit_price)+'｜剩餘 '+Number(row.remaining_stock)+' 盒</div>';
 selected.stock=Number(row.remaining_stock);$('pstock').textContent='目前庫存：'+selected.stock+' 盒';
 await loadProducts();await loadHistory();await loadTodaySummary();setTimeout(clearProduct,1500);
};
db.auth.onAuthStateChange((event,session)=>{if(session&&['SIGNED_IN','INITIAL_SESSION','TOKEN_REFRESHED'].includes(event))setTimeout(()=>{if($('app').style.display!=='none')dailyInit()},400)});
