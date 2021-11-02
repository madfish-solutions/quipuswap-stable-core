(* define noop for readability *)
[@inline]
const no_operations     : list(operation) = nil;

const dex_func_count    : nat = 21n;
const token_func_count  : nat = 5n;

(* StableSwap constants *)
const max_tokens_index  : nat = 3n; (* Max available tokens in pair *)

const precision         : nat = 1_000_000_000_000_000_000n; (* 10e18 The precision to convert to *)

const a_precision       : nat = 100n;

const rate_precision    : nat = 100_00000n;

(* Fee constants *)

const fee_denominator   : nat = 10_000_000_000n;

const max_admin_fee     : nat = 10_000_000_000n;

const max_fee           : nat = 6_000_000_000n;

(* A - constant variables *)

const max_a             : nat = 1_000_000n;

const max_a_change      : nat = 10n;

(* Timings *)

const min_ramp_time     : int = 86400; (* 1 day *)