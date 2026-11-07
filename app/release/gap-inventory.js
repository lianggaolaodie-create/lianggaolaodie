/**
 * Phase 82 repository-evidence gap inventory.
 * Evidence describes files present on app/phase-1-planning only.
 * It does not inspect deployment state or prove production behavior.
 */
export const inventory = Object.freeze([
 {id:'GAP-001',area:'原生／跨平台 App 工程',status:'MISSING_EVIDENCE',priority:'P0',evidence:['repository root has no package.json / native app project in inspected root listing','app/README.md describes planning'],next:'選定 React Native／Flutter 等技術並建立可建置工程、路由與環境設定'},
 {id:'GAP-002',area:'顧客端 UI',status:'PROTOTYPE_ONLY',priority:'P1',evidence:['app/customer-app-preview.html','app/customer-flow-preview-v2.html'],next:'將原型拆成正式元件、路由、狀態管理與 API data binding'},
 {id:'GAP-003',area:'老闆後台 UI',status:'PROTOTYPE_ONLY',priority:'P1',evidence:['app/owner-admin-preview.html','app/owner-order-preview.html','app/owner-catalog-preview.html'],next:'接入正式授權 API、錯誤狀態、審計與資料持久化'},
 {id:'GAP-004',area:'會員 Auth',status:'SPEC_ONLY',priority:'P0',evidence:['app/README.md describes planned new Supabase Auth'],next:'建立 staging Auth、註冊登入重設流程、session lifecycle 與 RLS 測試'},
 {id:'GAP-005',area:'商品／口味公開 API',status:'MOCK_ONLY',priority:'P1',evidence:['app/mock-api/public-read-api.js','app/mock-api/production-read-adapters.js'],next:'完成真實 staging adapter、schema 對照、快取及匿名讀取驗收'},
 {id:'GAP-006',area:'購物車與報價',status:'MODEL_AND_MOCK',priority:'P1',evidence:['app/mock-api/cart-model.js','app/mock-api/quote-model.js','app/mock-api/checkout-gate.js'],next:'後端重算報價、價格版本、有效期限與真實整合測試'},
 {id:'GAP-007',area:'訂單建立／查詢',status:'MOCK_ONLY',priority:'P0',evidence:['app/mock-api/order-flow-model.js','app/mock-api/member-order-model.js','app/mock-api/workflow-http-server.js'],next:'建立 staging API、訪客 claim、會員 ownership、冪等與跨來源訂單驗收'},
 {id:'GAP-008',area:'付款／Webhook',status:'MODEL_ONLY',priority:'P0',evidence:['app/mock-api/payment-model.js','app/mock-api/refund-model.js'],next:'選定金流商並建立 sandbox webhook 驗簽、對帳與重送測試'},
 {id:'GAP-009',area:'退款／取消',status:'MODEL_ONLY',priority:'P1',evidence:['app/mock-api/refund-model.js','app/mock-api/cancellation-model.js'],next:'定義真實付款狀態與退款 API，於金流 sandbox 驗收'},
 {id:'GAP-010',area:'物流／出貨',status:'MODEL_ONLY',priority:'P1',evidence:['app/mock-api/fulfillment-model.js','app/DELIVERY_AND_CHECKOUT_SPEC.md'],next:'確認物流供應商 API、標籤、追蹤及異常流程'},
 {id:'GAP-011',area:'會員通知／LINE',status:'AUDIT_AND_TEST_ONLY',priority:'P1',evidence:['app/tests/notification-security.test.js','app/PHASE_16_NOTIFICATION_CALLER_INVENTORY.md'],next:'修補 caller/token/payload 邊界並在測試環境驗證實際發送'},
 {id:'GAP-012',area:'老闆商品／訂單管理 API',status:'MOCK_ONLY',priority:'P1',evidence:['app/mock-api/product-admin-model.js','app/mock-api/owner-order-admin-model.js'],next:'建立後端角色授權、欄位白名單、稽核與 staging 整合'},
 {id:'GAP-013',area:'餐車／擺攤發布',status:'SPEC_AND_EXISTING_SITE',priority:'P1',evidence:['app/PHASE_32_EXISTING_SITE_TO_APP_REUSE_MATRIX.md','existing schedule pages and tables are documented'],next:'建立共用發布 API 並驗收餐車顯示價格、擺攤隱藏價格'},
 {id:'GAP-014',area:'PDA 掃碼／員工作業',status:'DEFERRED',priority:'P2',evidence:['app/PHASE_31_APP_ENGINEERING_GAP_AUDIT.md says employee PDA deferred'],next:'先完成顧客與老闆端，再獨立定義員工角色及掃碼作業'},
 {id:'GAP-015',area:'優惠券／刮刮樂',status:'SPEC_ONLY',priority:'P2',evidence:['app/FULL_SYSTEM_ARCHITECTURE.md planning references'],next:'定義活動規則、兌換防重複、庫存與稽核 API'},
 {id:'GAP-016',area:'正式資料庫／RLS／Storage',status:'NOT_INTEGRATED',priority:'P0',evidence:['Phase 75 SQL is read-only inventory draft; no staging execution recorded'],next:'先建立 staging 與 metadata snapshot，再依 Phase 79 gate 審查修補'},
 {id:'GAP-017',area:'CI 純函式測試',status:'AUTOMATED_TESTS_PRESENT',priority:'P2',evidence:['.github/workflows/pure-node-safety-tests.yml','app/mock-api and app/security tests'],next:'保留現有測試，補上 staging integration and end-to-end suites'},
 {id:'GAP-018',area:'iOS／Android 建置與商店上架',status:'MISSING_EVIDENCE',priority:'P0',evidence:['no native build/signing or store submission artifacts in inspected paths','app/README.md says iOS + Android are target platforms'],next:'選定工程、配置簽章與建置管線，取得可安裝 build 後再辦商店素材及審核'},
 {id:'GAP-019',area:'既有官網',status:'EXISTING_WEBSITE',priority:'P2',evidence:['root index.html exists','deploy-pages workflow exists'],next:'官網保持現況；共用 API 通過回歸後才考慮逐步整合'},
 {id:'GAP-020',area:'版本監控／備份／正式回復',status:'SPEC_ONLY',priority:'P1',evidence:['release and rollback plans exist as documents'],next:'建立監控告警、備份還原演練、版本回復 runbook'}
]);
export const statusDefinitions = Object.freeze({
 MISSING_EVIDENCE:'未找到可證明工程或交付存在的檔案',
 PROTOTYPE_ONLY:'只有可檢視的畫面原型，未證明已串接正式服務',
 SPEC_ONLY:'只有規格／設計文件',
 MOCK_ONLY:'只有模擬服務或合成資料',
 MODEL_AND_MOCK:'有模型與 mock，但未證明真實後端整合',
 MODEL_ONLY:'只有狀態模型，未連接外部供應商',
 AUDIT_AND_TEST_ONLY:'只有盤點／安全測試文件',
 SPEC_AND_EXISTING_SITE:'有規格與既有網站功能，App 共用流程未驗收',
 DEFERRED:'明確暫緩',
 NOT_INTEGRATED:'未完成真實資料庫整合驗收',
 AUTOMATED_TESTS_PRESENT:'有自動化測試，不代表產品端到端通過',
 EXISTING_WEBSITE:'既有網站檔案存在，不等於 App 完成'
});
export function summarizeInventory(items=inventory) {
 const counts={};
 for(const item of items) counts[item.status]=(counts[item.status]||0)+1;
 const p0=items.filter(x=>x.priority==='P0');
 return Object.freeze({total:items.length,counts,p0:p0.map(x=>x.id),releaseDecision:'NOT_READY',note:'Repository evidence only; no live deployment or production behavior inferred.'});
}
