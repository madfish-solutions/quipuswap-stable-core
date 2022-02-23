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
