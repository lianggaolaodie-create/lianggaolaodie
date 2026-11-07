# Phase 60｜老闆後台訂單管理參考模型

## 交付內容
- 線上訂單／現場訂單分流列表與篩選。
- 涼糕／蘿蔔糕商品類型分流。
- 付款證明審核：僅 proof_submitted 可確認或駁回。
- 備貨、備妥、出貨、送達狀態與付款前置條件。
- 取消規則：已付款需先退款；已出貨不得整單取消。
- 管理角色驗證、版本衝突、冪等 key 與 audit log。
- 擺攤場次列表不輸出商品單價或明細價格；個資依角色遮罩。

## 新增檔案
- app/mock-api/owner-order-admin-model.js
- app/mock-api/owner-order-admin-model.test.js
- app/PHASE_60_OWNER_ORDER_ADMIN.md

## 限制
本階段為記憶體合成資料模型，沒有後台 UI、正式 API、真實付款審核、退款、庫存或物流操作。正式版仍需 Supabase Auth、server-side role/RLS、資料庫交易與稽核表。擺攤不顯示價格是公開排程規則；後台內部金額欄位仍須依實際業務權限設計。
