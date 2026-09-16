(function(){
  const SUPABASE_URL='https://yemzdwxtyosuaczsqwea.supabase.co';
  const SUPABASE_KEY='sb_publishable_7b4hgNL68yiYbec7fXToYQ_UxPE4sEB';
  const DEFAULT_MESSAGE='官網目前正在維護中，請稍後再回來。';
  try{
    const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    sb.from('site_maintenance').select('enabled,message').eq('id',1).maybeSingle().then(({data})=>{
      if(!data?.enabled)return;
      document.documentElement.style.background='#f7f1e9';
      document.body.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f7f1e9;color:#2d241e;font-family:-apple-system,BlinkMacSystemFont,\'PingFang TC\',\'Noto Sans TC\',sans-serif;text-align:center"><section style="width:min(560px,100%);background:#fff;border:1px solid #e7ddd2;border-radius:28px;padding:42px 26px;box-shadow:0 12px 36px #00000012"><div style="font-size:58px;margin-bottom:14px">🔧</div><div style="font-size:13px;letter-spacing:5px;color:#a27459;font-weight:900">LAODIE · MAINTENANCE</div><h1 style="font-family:Georgia,\'Noto Serif TC\',serif;font-size:clamp(34px,8vw,52px);margin:14px 0 12px">官網維護中</h1><p style="font-size:18px;line-height:1.8;color:#705f53;margin:0">'+escapeHtml(data.message||DEFAULT_MESSAGE)+'</p><div style="margin-top:26px;padding:12px 16px;border-radius:999px;background:#f4ebe3;color:#6c4b39;font-weight:800">請稍後再回來，謝謝您的耐心等候 ❤️</div></section></main>';
      document.title='官網維護中｜老爹・涼糕';
    }).catch(()=>{});
  }catch(e){}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
})();
