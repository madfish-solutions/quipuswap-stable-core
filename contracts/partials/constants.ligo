(* define noop for readability *)
[@inline] const no_operations: list(operation) = nil;

const dex_func_count    : nat   = 8n;
const dev_func_count    : nat   = 2n;
const token_func_count  : nat   = 5n;
#if !FACTORY
const admin_func_count  : nat   = 8n;
#else
const admin_func_count  : nat   = 7n;
#endif

(* StableSwap constants *)
const max_tokens_count  : nat   = 4n; (* Max available tokens in pool *)
const min_tokens_count  : nat   = 2n; (* Min available tokens in pool *)

const precision         : nat   = 1_000_000_000_000_000_000n; (* 10e18 The precision to convert to *)

const a_precision       : nat   = 100n;

const rate_precision    : nat   = 100_00000n;

const proxy_limit       : nat   = 100_000_000n; (* 100% of liquidity *)

(* Fee constants *)

const accum_precision   : nat   = 10_000_000_000n;

const fee_denominator   : nat   = 10_000_000_000n;

const max_admin_fee     : nat   = 10_000_000_000n;

const max_fee           : nat   = 6_000_000_000n;

(* A - constant variables *)

const max_a             : nat   = 1_000_000n;

const max_a_change      : nat   = 10n;

(* Timings *)

const min_ramp_time     : int   = 86400;

const burn_rate_precision: nat  = 100_0000n;

const burn_address      : address = ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : address);


const default_token_metadata: map(string, bytes) = map [
  "name" -> Bytes.pack("Stable DEX QuipuSwap LP token");
  "symbol" -> Bytes.pack("sdQPLP");
  "decimals" -> Bytes.pack(precision);
  "description" -> Bytes.pack("Liquidity Pool token of QuipuSwap Stable DEX");
  "shouldPreferSymbol" -> Bytes.pack(True);
  "thumbnailUri" -> Bytes.pack("ipfs://QmUXFJxwGEjknP5DKNwMwsWXvrY8G2jUMbxjdBE3ekP8DP");
];

[@inline] const default_dex_metadata: bytes = 0x7b226e616d65223a2251756970755377617020537461626c652044455820706f6f6c222c2276657273696f6e223a2276312e302e30222c226465736372697074696f6e223a22506f6f6c20666f72207377617070696e6720746f6b656e732077697468206c6f7720736c697070616765222c22617574686f7273223a5b224d6164666973682e536f6c7574696f6e73203c68747470733a2f2f7777772e6d6164666973682e736f6c7574696f6e733e225d2c22736f75726365223a7b22746f6f6c73223a5b224c69676f222c22466c657874657361225d2c226c6f636174696f6e223a2268747470733a2f2f6769746875622e636f6d2f6d6164666973682d736f6c7574696f6e732f7175697075737761702d737461626c652d636f72652f626c6f622f6d61696e2f636f6e7472616374732f6d61696e2f6465782e6c69676f227d2c22686f6d6570616765223a2268747470733a2f2f7175697075737761702e636f6d222c22696e7465726661636573223a5b22545a49502d313220676974203137323866636665222c22545a49502d3136225d2c226572726f7273223a5b5d2c227669657773223a5b5d7d;