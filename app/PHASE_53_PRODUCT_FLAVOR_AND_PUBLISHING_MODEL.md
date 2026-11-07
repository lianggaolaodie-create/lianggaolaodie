# Phase 53 — 商品／口味管理、餐車擺攤發布與官網 App 共用快照

## 交付範圍
- 老闆／管理員商品管理 reference model：建立、編輯、版本衝突保護。
- 涼糕與蘿蔔糕使用不同 type，商品與口味關聯不混用。
- 口味管理：啟用／停用、所屬商品類型與版本。
- 商品價格使用 TWD 整數最小單位；缺價、無效價格或未開啟線上販售不可發布。
- 商品狀態 draft／published／paused／sold_out 與 onlineEnabled 分離。
- 餐車 food_truck 與擺攤 stall 分開管理；排程包含日期、地區、地點、地址、時間與口味。
- 餐車公開菜單可帶場次價格；擺攤公開菜單不輸出價格。
- 官網與 App 讀取同一個已發布 snapshot revision；草稿／取消場次不公開。
- 管理操作留下 audit trail；公開資料不含內部稽核欄位。

## 新增檔案
- `app/mock-api/product-admin-model.js`
- `app/mock-api/product-admin-model.test.js`
- `app/PHASE_53_PRODUCT_FLAVOR_AND_PUBLISHING_MODEL.md`

## 驗收案例
1. 非 owner/admin 不可修改商品或口味。
2. 涼糕與蘿蔔糕商品類型分離。
3. 草稿不公開；發布後官網與 App 指向相同快照。
4. 缺價／未開啟線上販售／舊版本寫入均拒絕。
5. 口味只能掛在同一商品類型，不可混入錯誤場次。
6. 餐車場次可發布場次價；擺攤永遠不公開價格。
7. 草稿／取消場次不公開。
8. 發布快照有 revision，官網與 App 讀取同版資料。
9. 稽核紀錄不出現在公開 payload。

## 自動化測試結果
- GitHub Actions：9 tests passed，0 failed。
- Run： https://github.com/lianggaolaodie-create/lianggaolaodie/actions/runs/42406974617
- 僅驗證 Phase 53 純 Node 合成資料模型，不代表正式資料庫或官網串接完成。

## 限制與未完成
- 純 Node in-memory reference model 與合成測試，不是正式後台 UI 或正式資料庫。
- 尚未核對並映射既有 Supabase 欄位、RPC、RLS 與官網實際讀取路徑。
- 尚未建立正式商品圖片上傳、實際價格維護 API、真實發布 API 或跨端即時推播。
- 本階段不修改正式 Supabase、正式官網、Edge Functions、Secrets，不產生真實訂單。
- 正式環境需以 DB transaction、管理角色授權、版本欄位／唯一約束、稽核表及單一公開 API 落地。

## 下一階段
Phase 54：商品與場次資料的既有 schema／API adapter 對照，列出可沿用欄位、缺漏欄位、公開 payload 白名單與衝突策略；仍先做唯讀盤點及 mock 驗收，不執行正式 migration。
