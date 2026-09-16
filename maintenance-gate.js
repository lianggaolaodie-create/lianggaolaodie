(function(){
  if (location.pathname.endsWith('/maintenance-admin.html')) return;
  document.documentElement.style.visibility='hidden';
  var API='https://yemzdwxtyosuaczsqwea.supabase.co/rest/v1/site_maintenance?id=eq.1&select=enabled,message';
  var KEY='sb_publishable_7b4hgNL68yiYbec7fXToYQ_UxPE4sEB';
  function showMaintenance(message){
    document.documentElement.style.visibility='visible';
    document.body.innerHTML='';
    document.body.style.margin='0';
    document.body.style.background='#f6eee3';
    document.body.style.color='#3e2116';
    document.body.style.fontFamily='-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
    var wrap=document.createElement('main');
    wrap.style.cssText='min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;text-align:center';
    wrap.innerHTML='<section style="width:min(560px,100%);background:#fffaf3;border:1px solid #eadbcb;border-radius:28px;padding:44px 24px;box-shadow:0 14px 45px #462d1918"><div style="font-size:54px;margin-bottom:12px">🔧</div><h1 style="font-family:serif;font-size:34px;margin:0 0 14px">官網維護中</h1><p id="maintenanceMessage" style="font-size:17px;line-height:1.8;color:#765e51;margin:0">'+String(message||'官網目前正在維護中，請稍後再回來。').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})+'</p><div style="margin-top:24px;font-size:13px;color:#9b5c38">老爹・涼糕｜LAODAD RICE CAKE</div></section>';
    document.body.appendChild(wrap);
  }
  function openSite(){document.documentElement.style.visibility='visible';}
  fetch(API,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('maintenance check failed');return r.json();})
    .then(function(rows){var row=rows&&rows[0];if(row&&row.enabled)showMaintenance(row.message);else openSite();})
    .catch(function(){openSite();});
})();
