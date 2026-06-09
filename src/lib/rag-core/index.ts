// @teras/rag-core — provider-agnostic RAG primitives shared by Gemswell MIS and MDL Patrimonio.
// Pure TypeScript: NO Supabase/RPC/DB/governance-enum coupling. App-specific behaviour (governance
// mapping, RPC names, embedding model) is INJECTED by the host app, never assumed here. See README.md.
export * from './injection'
export * from './rank'
