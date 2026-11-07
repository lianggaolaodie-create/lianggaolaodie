/**
 * Phase 75 SQL static guard. This does not parse PostgreSQL fully or execute SQL.
 * It rejects obvious mutation statements and requires a read-only transaction wrapper.
 */
export function validateReadOnlyInventorySql(source) {
 const errors=[];
 const sql=String(source||'');
 if (!/^\s*--[\s\S]*?BEGIN\s+TRANSACTION\s+READ\s+ONLY\s*;/i.test(sql)) errors.push('missing READ ONLY transaction');
 if (!/\bROLLBACK\s*;\s*$/i.test(sql.trim())) errors.push('missing final ROLLBACK');
 const stripped=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
 if (/\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO)\b/i.test(stripped)) errors.push('mutation or executable block keyword detected');
 if (/\bSELECT\s+\*\s+FROM\s+(public\.)?(orders|order_items|transfer_proofs)\b/i.test(stripped)) errors.push('business row query detected');
 return {valid:errors.length===0,errors};
}
